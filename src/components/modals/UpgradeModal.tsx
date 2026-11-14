import React, { useState } from 'react';
import { Check, CreditCard, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import type { EntitlementSummary } from '../../types/resume';
import { PopupModal } from '../ui/PopupModal';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceInr: number;
  billingInterval: string;
  onSuccess: (entitlements: EntitlementSummary) => void;
  reasonMessage?: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  priceInr,
  billingInterval,
  onSuccess,
  reasonMessage,
}) => {
  const [step, setStep] = useState<'pitch' | 'checkout'>('pitch');
  const [couponCode, setCouponCode] = useState('');
  const [discountInfo, setDiscountInfo] = useState<{
    code: string;
    discountPercent: number;
    finalPriceInr: number;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sandboxOrder, setSandboxOrder] = useState<{
    orderId: string;
    amountInr: number;
    receiptNumber: string;
    notice: string;
  } | null>(null);

  const displayPrice = discountInfo ? discountInfo.finalPriceInr : priceInr;
  const intervalLabel =
    billingInterval === 'yearly'
      ? 'per year'
      : billingInterval === 'lifetime'
      ? 'one-time lifetime access'
      : billingInterval === 'one_time'
      ? 'one-time pass'
      : 'per month';

  const handleApplyCoupon = async () => {
    setError(null);
    if (!couponCode.trim()) return;
    try {
      const res = await apiRequest<{
        code: string;
        discountPercent: number;
        finalPriceInr: number;
      }>('/api/billing/validate-coupon', {
        method: 'POST',
        body: JSON.stringify({ code: couponCode }),
      });
      setDiscountInfo(res);
    } catch (err) {
      setDiscountInfo(null);
      setError(err instanceof Error ? err.message : 'Invalid coupon code.');
    }
  };

  const handleStartCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const order = await apiRequest<{
        mode: 'razorpay' | 'sandbox_unconfigured';
        keyId?: string;
        orderId: string;
        amountInr: number;
        amountPaise: number;
        currency: string;
        receiptNumber: string;
        notice?: string;
      }>('/api/billing/create-order', {
        method: 'POST',
        body: JSON.stringify({ couponCode: discountInfo?.code || '' }),
      });

      if (order.mode === 'sandbox_unconfigured') {
        setSandboxOrder({
          orderId: order.orderId,
          amountInr: order.amountInr,
          receiptNumber: order.receiptNumber,
          notice: order.notice || 'Razorpay keys are not configured.',
        });
        setLoading(false);
        return;
      }

      // Load Razorpay Checkout script if configured
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay Checkout SDK.'));
          document.body.appendChild(script);
        });
      }

      if (window.Razorpay) {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency,
          name: 'CraftCV Premium',
          description: `Premium Career Suite (${intervalLabel})`,
          order_id: order.orderId,
          handler: async (response: Record<string, string>) => {
            try {
              const verify = await apiRequest<{ verified: boolean; entitlements: EntitlementSummary }>(
                '/api/billing/verify-payment',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    method: paymentMethod,
                  }),
                }
              );
              onSuccess(verify.entitlements);
              onClose();
            } catch (verErr) {
              setError(verErr instanceof Error ? verErr.message : 'Payment verification failed.');
            }
          },
        });
        rzp.open();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initiate payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxConfirm = async () => {
    if (!sandboxOrder) return;
    setLoading(true);
    setError(null);
    try {
      const verify = await apiRequest<{ verified: boolean; entitlements: EntitlementSummary }>(
        '/api/billing/verify-payment',
        {
          method: 'POST',
          body: JSON.stringify({
            razorpay_order_id: sandboxOrder.orderId,
            method: paymentMethod,
            sandboxConfirm: true,
          }),
        }
      );
      onSuccess(verify.entitlements);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sandbox verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      title="Ready to create more resumes?"
      subtitle="Upgrade via Razorpay · Cancel anytime without losing existing resumes"
      maxWidthClass="max-w-lg"
      bodyClassName="p-6 space-y-5"
    >
          {reasonMessage && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
              {reasonMessage}
            </div>
          )}

          {step === 'pitch' ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                Unlock unlimited resumes, premium templates, advanced AI and job matching for ₹{priceInr}.
              </p>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                <div className="flex items-baseline justify-between pb-2 border-b border-slate-200">
                  <span className="text-sm font-semibold text-slate-900">Premium Career Suite</span>
                  <span className="text-base font-bold text-iris-600 font-mono-tabular">
                    ₹{priceInr} <span className="text-xs font-normal text-slate-500">{intervalLabel}</span>
                  </span>
                </div>
                <ul className="space-y-2 text-sm text-slate-700">
                  {[
                    'Unlimited resumes & tailored job-specific versions',
                    'All 22+ ATS, Corporate, Executive & Fresher templates',
                    'Unlimited AI writing, rewriting & project generation',
                    'Advanced ATS analysis, JD matching & Cover Letters',
                    'LinkedIn optimization & interview preparation tools',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-iris-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  onClick={() => setStep('checkout')}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 transition-colors whitespace-nowrap"
                >
                  Upgrade to Premium
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  Continue with Free Plan
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Billing cadence</span>
                  <span className="font-medium text-slate-900 capitalize">{billingInterval.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Amount payable</span>
                  <span className="text-lg font-bold text-slate-900 font-mono-tabular">₹{displayPrice} INR</span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Coupon code (e.g. STUDENT20)"
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    Apply
                  </button>
                </div>
                {discountInfo && (
                  <p className="text-xs text-emerald-700 font-medium">
                    Coupon {discountInfo.code} applied ({discountInfo.discountPercent}% off).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Preferred Razorpay Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'upi', label: 'UPI' },
                    { id: 'card', label: 'Card' },
                    { id: 'netbanking', label: 'Net Banking' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as 'upi' | 'card' | 'netbanking')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        paymentMethod === m.id
                          ? 'border-iris-600 bg-iris-50 text-iris-700'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              {sandboxOrder ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
                  <div className="text-xs font-semibold text-amber-900">
                    Sandbox Verification Mode (Razorpay Keys Unconfigured)
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">{sandboxOrder.notice}</p>
                  <div className="text-xs text-amber-900 font-mono-tabular">
                    Order: {sandboxOrder.orderId} · Receipt: {sandboxOrder.receiptNumber}
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSandboxConfirm}
                    className="w-full px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60"
                  >
                    {loading ? 'Verifying...' : `Confirm Sandbox Payment (₹${sandboxOrder.amountInr})`}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('pitch')}
                    className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleStartCheckout}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60"
                  >
                    <CreditCard className="w-4 h-4" />
                    {loading ? 'Creating Order...' : `Pay ₹${displayPrice} via Razorpay`}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Server-verified payment. Cancel anytime; existing resumes are never deleted.</span>
              </div>
            </>
          )}
    </PopupModal>
  );
};
