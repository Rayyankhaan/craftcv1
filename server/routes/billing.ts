import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { Router } from 'express';
import { db, getPlatformSetting, logAudit } from '../db.ts';
import { AuthenticatedRequest, requireAuth } from '../services/auth.ts';
import { getUserEntitlements } from '../services/entitlements.ts';

export const billingRouter = Router();

function getRazorpayInstance(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function computePeriodEnd(interval: string): string | null {
  const now = new Date();
  if (interval === 'monthly') {
    now.setMonth(now.getMonth() + 1);
    return now.toISOString();
  }
  if (interval === 'yearly') {
    now.setFullYear(now.getFullYear() + 1);
    return now.toISOString();
  }
  return null; // lifetime / one_time
}

function activateSubscriptionForPayment(
  userId: string,
  paymentId: string,
  razorpayPaymentId: string,
  method: string
) {
  const now = new Date().toISOString();
  const billingInterval = getPlatformSetting<string>('billingInterval', 'monthly');
  const periodEnd = computePeriodEnd(billingInterval);

  db.exec('BEGIN');
  try {
    // Check idempotency
    const existingPay = db
      .prepare(`SELECT status FROM payments WHERE id = ?`)
      .get(paymentId) as { status: string } | undefined;
    if (existingPay?.status === 'paid') {
      db.exec('COMMIT');
      return;
    }

    const subId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO subscriptions (
        id, user_id, plan_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
      ) VALUES (?, ?, 'premium', 'active', ?, ?, ?, 0, ?, ?)
    `).run(subId, userId, billingInterval, now, periodEnd, now, now);

    db.prepare(`
      UPDATE payments
      SET subscription_id = ?, razorpay_payment_id = ?, status = 'paid', method = ?, updated_at = ?
      WHERE id = ?
    `).run(subId, razorpayPaymentId, method, now, paymentId);

    db.prepare(`
      INSERT INTO subscription_events (id, user_id, event_type, payload_json, created_at)
      VALUES (?, ?, 'subscription.activated', ?, ?)
    `).run(crypto.randomUUID(), userId, JSON.stringify({ subId, billingInterval }), now);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

billingRouter.get('/overview', requireAuth, (req: AuthenticatedRequest, res) => {
  const entitlements = getUserEntitlements(req.user!.id);
  const payments = db
    .prepare(`SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user!.id) as Record<string, unknown>[];

  res.json({
    entitlements,
    razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
    payments: payments.map((p) => ({
      id: String(p.id),
      razorpayOrderId: String(p.razorpay_order_id),
      razorpayPaymentId: p.razorpay_payment_id ? String(p.razorpay_payment_id) : null,
      amountInr: Number(p.amount_inr),
      currency: String(p.currency),
      status: String(p.status),
      method: p.method ? String(p.method) : null,
      receiptNumber: String(p.receipt_number),
      createdAt: String(p.created_at),
    })),
  });
});

billingRouter.post('/validate-coupon', requireAuth, (req: AuthenticatedRequest, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const basePrice = getPlatformSetting<number>('premiumPriceInr', 99);
  if (!code) {
    res.status(400).json({ error: 'Enter a coupon code.' });
    return;
  }
  const coupon = db
    .prepare(`SELECT * FROM coupons WHERE code = ? AND is_active = 1`)
    .get(code) as { code: string; discount_percent: number; max_uses: number; used_count: number; expires_at: string | null } | undefined;

  if (!coupon || coupon.used_count >= coupon.max_uses || (coupon.expires_at && coupon.expires_at < new Date().toISOString())) {
    res.status(404).json({ error: 'Coupon is invalid or expired.' });
    return;
  }

  const finalPrice = Math.max(1, Math.round(basePrice * (1 - coupon.discount_percent / 100)));
  res.json({
    valid: true,
    code: coupon.code,
    discountPercent: coupon.discount_percent,
    originalPriceInr: basePrice,
    finalPriceInr: finalPrice,
  });
});

billingRouter.post('/create-order', requireAuth, async (req: AuthenticatedRequest, res) => {
  const basePrice = getPlatformSetting<number>('premiumPriceInr', 99);
  const billingInterval = getPlatformSetting<string>('billingInterval', 'monthly');
  const couponCode = String(req.body?.couponCode || '').trim().toUpperCase();

  let finalAmountInr = basePrice;
  let appliedCoupon: string | null = null;
  if (couponCode) {
    const coupon = db
      .prepare(`SELECT * FROM coupons WHERE code = ? AND is_active = 1`)
      .get(couponCode) as { discount_percent: number; max_uses: number; used_count: number } | undefined;
    if (coupon && coupon.used_count < coupon.max_uses) {
      finalAmountInr = Math.max(1, Math.round(basePrice * (1 - coupon.discount_percent / 100)));
      appliedCoupon = couponCode;
    }
  }

  const receiptNumber = `RCPT-${Date.now()}-${crypto.randomInt(100, 999)}`;
  const now = new Date().toISOString();
  const razorpay = getRazorpayInstance();

  if (!razorpay) {
    // Sandbox fallback order (only active when Razorpay keys are unconfigured; clearly marked)
    const sandboxOrderId = `order_sandbox_${crypto.randomBytes(6).toString('hex')}`;
    const paymentId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO payments (id, user_id, razorpay_order_id, amount_inr, currency, status, coupon_code, receipt_number, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'INR', 'created', ?, ?, ?, ?)
    `).run(paymentId, req.user!.id, sandboxOrderId, finalAmountInr, appliedCoupon, receiptNumber, now, now);

    res.json({
      mode: 'sandbox_unconfigured',
      razorpayConfigured: false,
      orderId: sandboxOrderId,
      amountInr: finalAmountInr,
      amountPaise: finalAmountInr * 100,
      currency: 'INR',
      billingInterval,
      receiptNumber,
      notice: 'Razorpay live/test API keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured. Use Sandbox Verification below for local evaluation.',
    });
    return;
  }

  try {
    const order = await razorpay.orders.create({
      amount: finalAmountInr * 100,
      currency: 'INR',
      receipt: receiptNumber,
      notes: {
        userId: req.user!.id,
        billingInterval,
        couponCode: appliedCoupon || '',
      },
    });

    const paymentId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO payments (id, user_id, razorpay_order_id, amount_inr, currency, status, coupon_code, receipt_number, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'INR', 'created', ?, ?, ?, ?)
    `).run(paymentId, req.user!.id, order.id, finalAmountInr, appliedCoupon, receiptNumber, now, now);

    res.json({
      mode: 'razorpay',
      razorpayConfigured: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amountInr: finalAmountInr,
      amountPaise: finalAmountInr * 100,
      currency: 'INR',
      billingInterval,
      receiptNumber,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create Razorpay order.' });
  }
});

billingRouter.post('/verify-payment', requireAuth, (req: AuthenticatedRequest, res) => {
  const orderId = String(req.body?.razorpay_order_id || '');
  const paymentId = String(req.body?.razorpay_payment_id || '');
  const signature = String(req.body?.razorpay_signature || '');
  const method = String(req.body?.method || 'upi');
  const sandboxConfirm = Boolean(req.body?.sandboxConfirm);

  const paymentRow = db
    .prepare(`SELECT * FROM payments WHERE razorpay_order_id = ? AND user_id = ?`)
    .get(orderId, req.user!.id) as Record<string, unknown> | undefined;

  if (!paymentRow) {
    res.status(404).json({ error: 'Payment order not found.' });
    return;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    if (!sandboxConfirm || !orderId.startsWith('order_sandbox_')) {
      res.status(400).json({ error: 'Razorpay credentials not configured for live signature verification.' });
      return;
    }
    const sandboxPayId = `pay_sandbox_${crypto.randomBytes(6).toString('hex')}`;
    activateSubscriptionForPayment(req.user!.id, String(paymentRow.id), sandboxPayId, method);
    if (paymentRow.coupon_code) {
      db.prepare(`UPDATE coupons SET used_count = used_count + 1 WHERE code = ?`).run(String(paymentRow.coupon_code));
    }
    logAudit(req.user!.id, 'SUBSCRIPTION_SANDBOX_ACTIVATED', 'payment', String(paymentRow.id));
    res.json({ verified: true, entitlements: getUserEntitlements(req.user!.id) });
    return;
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    db.prepare(`UPDATE payments SET status = 'failed', updated_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      String(paymentRow.id)
    );
    res.status(400).json({ error: 'Invalid Razorpay payment signature.' });
    return;
  }

  activateSubscriptionForPayment(req.user!.id, String(paymentRow.id), paymentId, method);
  if (paymentRow.coupon_code) {
    db.prepare(`UPDATE coupons SET used_count = used_count + 1 WHERE code = ?`).run(String(paymentRow.coupon_code));
  }
  logAudit(req.user!.id, 'PAYMENT_VERIFIED', 'payment', String(paymentRow.id), { razorpayPaymentId: paymentId });
  res.json({ verified: true, entitlements: getUserEntitlements(req.user!.id) });
});

billingRouter.post('/webhook', (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = String(req.headers['x-razorpay-signature'] || '');
  const rawBody = (req as unknown as { rawBody?: string }).rawBody || JSON.stringify(req.body);

  if (!webhookSecret) {
    res.status(501).json({ error: 'RAZORPAY_WEBHOOK_SECRET is not configured.' });
    return;
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    res.status(400).json({ error: 'Invalid webhook signature.' });
    return;
  }

  const event = req.body?.event as string;
  const entity = req.body?.payload?.payment?.entity as { id?: string; order_id?: string; method?: string } | undefined;

  if (event === 'payment.captured' && entity?.order_id && entity?.id) {
    const paymentRow = db
      .prepare(`SELECT * FROM payments WHERE razorpay_order_id = ?`)
      .get(entity.order_id) as Record<string, unknown> | undefined;
    if (paymentRow) {
      activateSubscriptionForPayment(
        String(paymentRow.user_id),
        String(paymentRow.id),
        entity.id,
        entity.method || 'razorpay'
      );
    }
  } else if (event === 'payment.failed' && entity?.order_id) {
    db.prepare(`UPDATE payments SET status = 'failed', updated_at = ? WHERE razorpay_order_id = ?`).run(
      new Date().toISOString(),
      entity.order_id
    );
  } else if (event === 'refund.processed' && entity?.id) {
    db.prepare(`UPDATE payments SET status = 'refunded', updated_at = ? WHERE razorpay_payment_id = ?`).run(
      new Date().toISOString(),
      entity.id
    );
  }

  res.json({ received: true });
});

billingRouter.post('/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
  const sub = db
    .prepare(`SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`)
    .get(req.user!.id) as { id: string } | undefined;

  if (!sub) {
    res.status(404).json({ error: 'No active subscription found.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 1, updated_at = ? WHERE id = ?`).run(
    now,
    sub.id
  );
  db.prepare(`INSERT INTO subscription_events (id, user_id, event_type, payload_json, created_at) VALUES (?, ?, 'subscription.cancelled', ?, ?)`).run(
    crypto.randomUUID(),
    req.user!.id,
    JSON.stringify({ subId: sub.id }),
    now
  );

  res.json({ cancelled: true, entitlements: getUserEntitlements(req.user!.id) });
});
