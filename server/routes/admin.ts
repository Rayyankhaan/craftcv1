import { Router } from 'express';
import { db, getPlatformSetting, setPlatformSetting, logAudit } from '../db.ts';
import { AuthenticatedRequest, requireAdmin } from '../services/auth.ts';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get('/overview', (_req: AuthenticatedRequest, res) => {
  const totalUsers = (db.prepare(`SELECT COUNT(*) as c FROM profiles`).get() as { c: number }).c;
  const totalResumes = (db.prepare(`SELECT COUNT(*) as c FROM resumes`).get() as { c: number }).c;
  const fresherResumes = (db.prepare(`SELECT COUNT(*) as c FROM resumes WHERE builder_type = 'fresher'`).get() as { c: number }).c;
  const activePremium = (
    db.prepare(`SELECT COUNT(DISTINCT user_id) as c FROM subscriptions WHERE status = 'active'`).get() as { c: number }
  ).c;
  const totalRevenueRow = db
    .prepare(`SELECT COALESCE(SUM(amount_inr), 0) as total, COUNT(*) as count FROM payments WHERE status = 'paid'`)
    .get() as { total: number; count: number };
  const aiRequestsTotal = (db.prepare(`SELECT COUNT(*) as c FROM ai_usage_logs`).get() as { c: number }).c;
  const aiRequestsFailed = (db.prepare(`SELECT COUNT(*) as c FROM ai_usage_logs WHERE status = 'error'`).get() as { c: number }).c;
  const atsChecksTotal = (db.prepare(`SELECT COUNT(*) as c FROM ats_analyses`).get() as { c: number }).c;
  const openTickets = (db.prepare(`SELECT COUNT(*) as c FROM support_tickets WHERE status = 'open'`).get() as { c: number }).c;

  const templateUsage = db
    .prepare(`SELECT template_id, COUNT(*) as count FROM resumes GROUP BY template_id ORDER BY count DESC LIMIT 12`)
    .all() as { template_id: string; count: number }[];

  const users = db
    .prepare(`
      SELECT p.id, p.email, p.phone, p.full_name, p.role, p.career_stage, p.is_suspended, p.created_at,
        u.resumes_created_count, u.ai_generations_used, u.ats_checks_used,
        (SELECT status FROM subscriptions s WHERE s.user_id = p.id ORDER BY s.created_at DESC LIMIT 1) as sub_status
      FROM profiles p
      LEFT JOIN user_usage u ON u.user_id = p.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `)
    .all();

  const payments = db
    .prepare(`
      SELECT pay.*, p.email as user_email, p.full_name as user_name
      FROM payments pay
      LEFT JOIN profiles p ON p.id = pay.user_id
      ORDER BY pay.created_at DESC
      LIMIT 50
    `)
    .all();

  const tickets = db.prepare(`SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 50`).all();
  const coupons = db.prepare(`SELECT * FROM coupons ORDER BY created_at DESC`).all();

  res.json({
    metrics: {
      totalUsers,
      freeUsers: Math.max(0, totalUsers - activePremium),
      premiumUsers: activePremium,
      totalResumes,
      fresherResumes,
      totalRevenueInr: totalRevenueRow.total,
      paidOrders: totalRevenueRow.count,
      aiRequestsTotal,
      aiRequestsFailed,
      atsChecksTotal,
      openTickets,
    },
    templateUsage,
    users,
    payments,
    tickets,
    coupons,
    settings: {
      premiumPriceInr: getPlatformSetting<number>('premiumPriceInr', 99),
      billingInterval: getPlatformSetting<string>('billingInterval', 'monthly'),
      freeResumeLimit: getPlatformSetting<number>('freeResumeLimit', 1),
      freeAiLimit: getPlatformSetting<number>('freeAiLimit', 1),
      freeAtsLimit: getPlatformSetting<number>('freeAtsLimit', 1),
      premiumFeaturesEnabled: getPlatformSetting<boolean>('premiumFeaturesEnabled', true),
      disabledTemplateIds: getPlatformSetting<string[]>('disabledTemplateIds', []),
      announcement: getPlatformSetting<string>('announcement', ''),
    },
  });
});

adminRouter.put('/settings', (req: AuthenticatedRequest, res) => {
  const allowedKeys = [
    'premiumPriceInr',
    'billingInterval',
    'freeResumeLimit',
    'freeAiLimit',
    'freeAtsLimit',
    'premiumFeaturesEnabled',
    'disabledTemplateIds',
    'announcement',
  ];
  for (const key of allowedKeys) {
    if (key in req.body) {
      setPlatformSetting(key, req.body[key]);
    }
  }
  logAudit(req.user!.id, 'ADMIN_SETTINGS_UPDATED', 'platform_settings', null, req.body);
  res.json({ ok: true });
});

adminRouter.put('/users/:id', (req: AuthenticatedRequest, res) => {
  const isSuspended = req.body?.isSuspended;
  const role = req.body?.role;
  if (typeof isSuspended === 'boolean') {
    db.prepare(`UPDATE profiles SET is_suspended = ?, updated_at = ? WHERE id = ?`).run(
      isSuspended ? 1 : 0,
      new Date().toISOString(),
      req.params.id
    );
  }
  if (role === 'user' || role === 'admin') {
    db.prepare(`UPDATE profiles SET role = ?, updated_at = ? WHERE id = ?`).run(
      role,
      new Date().toISOString(),
      req.params.id
    );
  }
  logAudit(req.user!.id, 'ADMIN_USER_UPDATED', 'profile', String(req.params.id));
  res.json({ ok: true });
});

adminRouter.post('/coupons', (req: AuthenticatedRequest, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const discountPercent = Number(req.body?.discountPercent || 0);
  const maxUses = Number(req.body?.maxUses || 100);
  if (!code || discountPercent < 1 || discountPercent > 100) {
    res.status(400).json({ error: 'Valid coupon code and discount (1-100%) are required.' });
    return;
  }
  db.prepare(`
    INSERT INTO coupons (code, discount_percent, max_uses, used_count, is_active, created_at)
    VALUES (?, ?, ?, 0, 1, ?)
    ON CONFLICT(code) DO UPDATE SET discount_percent = excluded.discount_percent, max_uses = excluded.max_uses, is_active = 1
  `).run(code, discountPercent, maxUses, new Date().toISOString());
  res.status(201).json({ ok: true });
});

adminRouter.put('/tickets/:id', (req: AuthenticatedRequest, res) => {
  const status = String(req.body?.status || 'resolved');
  const reply = String(req.body?.adminReply || '');
  db.prepare(`UPDATE support_tickets SET status = ?, admin_reply = ?, updated_at = ? WHERE id = ?`).run(
    status,
    reply,
    new Date().toISOString(),
    req.params.id
  );
  res.json({ ok: true });
});
