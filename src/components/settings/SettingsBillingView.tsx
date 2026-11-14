import React, { useEffect, useState } from 'react';
import { CreditCard, Download, LifeBuoy, LogOut, Shield, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import type { EntitlementSummary, UserProfile } from '../../types/resume';

interface SettingsBillingViewProps {
  user: UserProfile;
  entitlements: EntitlementSummary;
  initialSection?: 'billing' | 'security' | 'support' | 'privacy';
  onOpenUpgrade: () => void;
  onRefreshAuth: () => void;
  onAccountDeleted: () => void;
}

export const SettingsBillingView: React.FC<SettingsBillingViewProps> = ({
  user,
  entitlements,
  initialSection = 'billing',
  onOpenUpgrade,
  onRefreshAuth,
  onAccountDeleted,
}) => {
  const [section, setSection] = useState<'billing' | 'security' | 'support' | 'privacy'>(initialSection);
  const [payments, setPayments] = useState<
    {
      id: string;
      razorpayOrderId: string;
      razorpayPaymentId: string | null;
      amountInr: number;
      status: string;
      method: string | null;
      receiptNumber: string;
      createdAt: string;
    }[]
  >([]);
  const [sessions, setSessions] = useState<
    { id: string; userAgent: string; ipAddress: string; createdAt: string; isCurrent: boolean }[]
  >([]);
  const [tickets, setTickets] = useState<
    { id: string; subject: string; category: string; status: string; adminReply: string | null; createdAt: string }[]
  >([]);

  // Link phone OTP
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneNotice, setPhoneNotice] = useState<string | null>(null);

  // Support ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [ticketSaved, setTicketSaved] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<{ payments: typeof payments }>('/api/billing/overview')
      .then((res) => setPayments(res.payments))
      .catch(() => {});
    void apiRequest<{ sessions: typeof sessions }>('/api/auth/sessions')
      .then((res) => setSessions(res.sessions))
      .catch(() => {});
    void apiRequest<{ tickets: typeof tickets }>('/api/support/tickets')
      .then((res) => setTickets(res.tickets))
      .catch(() => {});
  }, []);

  const handleCancelSub = async () => {
    await apiRequest('/api/billing/cancel', { method: 'POST' });
    setStatusMessage(
      'Subscription cancellation scheduled. Your existing resumes remain safe and downloadable.'
    );
    onRefreshAuth();
  };

  const handleLinkPhoneSend = async () => {
    const res = await apiRequest<{ notice: string }>('/api/auth/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({ countryCode, phone }),
    });
    setOtpSent(true);
    setPhoneNotice(res.notice);
  };

  const handleLinkPhoneVerify = async () => {
    await apiRequest('/api/auth/phone/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ countryCode, phone, otp }),
    });
    setPhoneNotice('Mobile number verified and linked to your account.');
    setOtpSent(false);
    onRefreshAuth();
  };

  const handleExportData = async () => {
    const data = await apiRequest<Record<string, unknown>>('/api/auth/export-data');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `craftcv_personal_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    await apiRequest('/api/auth/account', { method: 'DELETE' });
    onAccountDeleted();
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest<{ ticket: (typeof tickets)[number] }>('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email || 'user@craftcv.local',
        subject,
        category,
        message,
      }),
    });
    setTickets((prev) => [res.ticket, ...prev]);
    setSubject('');
    setMessage('');
    setTicketSaved(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Account, Billing & Privacy</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your subscription, payment receipts, linked credentials, sessions, and privacy controls.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {[
          { id: 'billing', label: 'Plan & Billing' },
          { id: 'security', label: 'Account & Sessions' },
          { id: 'support', label: 'Support & FAQ' },
          { id: 'privacy', label: 'Privacy & Data' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id as typeof section)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
              section === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {statusMessage && (
        <div className="rounded-lg bg-iris-50 border border-iris-300 px-4 py-3 text-xs text-iris-700">
          {statusMessage}
        </div>
      )}

      {section === 'billing' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">Current Subscription</div>
              <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>{entitlements.plan === 'premium' ? 'Premium Career Suite' : 'Free Starter Plan'}</span>
                <span className="text-xs font-normal text-slate-500 capitalize">
                  ({entitlements.subscriptionStatus})
                </span>
              </div>
              <p className="text-xs text-slate-600 tabular-nums">
                Resumes created: {entitlements.resumesCreatedCount}
                {entitlements.plan === 'free' ? ` / ${entitlements.freeResumeLimit}` : ' (Unlimited)'} · AI
                generations: {entitlements.aiGenerationsUsed}
                {entitlements.plan === 'free' ? ` / ${entitlements.freeAiLimit}` : ' (Unlimited)'} · ATS
                checks: {entitlements.atsChecksUsed}
                {entitlements.plan === 'free' ? ` / ${entitlements.freeAtsLimit}` : ' (Unlimited)'}
              </p>
              {entitlements.expiresAt && (
                <p className="text-xs text-slate-500 tabular-nums">
                  Current period ends: {new Date(entitlements.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {entitlements.plan === 'free' ? (
                <button
                  onClick={onOpenUpgrade}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
                >
                  <CreditCard className="w-4 h-4" /> Upgrade for ₹{entitlements.priceInr}
                </button>
              ) : (
                entitlements.subscriptionStatus === 'active' && (
                  <button
                    onClick={() => void handleCancelSub()}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Subscription
                  </button>
                )
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Payment History & Receipts
            </div>
            {payments.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">No payments recorded yet.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4">Receipt</th>
                    <th className="py-2.5 px-4">Order ID</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Method</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4 font-mono-tabular font-medium">{p.receiptNumber}</td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-600">{p.razorpayOrderId}</td>
                      <td className="py-2.5 px-4 font-mono-tabular">₹{p.amountInr}</td>
                      <td className="py-2.5 px-4 uppercase text-slate-600">{p.method || '—'}</td>
                      <td className="py-2.5 px-4 capitalize font-medium">{p.status}</td>
                      <td className="py-2.5 px-4 tabular-nums text-slate-500">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {section === 'security' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-iris-600" /> Profile & Identity Linking
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Email</div>
                <div className="font-medium text-slate-900 mt-0.5">{user.email || 'Not linked'}</div>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Mobile Phone</div>
                <div className="font-medium text-slate-900 mt-0.5">
                  {user.phone ? `${user.phone} (Verified)` : 'Not linked'}
                </div>
              </div>
            </div>

            {!user.phone && (
              <div className="pt-2 space-y-2.5">
                <div className="text-xs font-medium text-slate-700">Link Verified Mobile Number</div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="+91">+91</option>
                    <option value="+1">+1</option>
                    <option value="+44">+44</option>
                  </select>
                  <input
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  {!otpSent ? (
                    <button
                      onClick={() => void handleLinkPhoneSend()}
                      className="px-3.5 py-2 rounded-lg bg-iris-600 text-white text-xs font-medium"
                    >
                      Send OTP
                    </button>
                  ) : (
                    <>
                      <input
                        placeholder="6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-lg w-28"
                      />
                      <button
                        onClick={() => void handleLinkPhoneVerify()}
                        className="px-3.5 py-2 rounded-lg bg-iris-600 text-white text-xs font-medium"
                      >
                        Verify & Link
                      </button>
                    </>
                  )}
                </div>
                {phoneNotice && <p className="text-xs text-iris-600">{phoneNotice}</p>}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Active Sessions</h2>
            <div className="divide-y divide-slate-200 text-xs">
              {sessions.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="truncate">
                    <div className="font-medium text-slate-900 truncate">
                      {s.isCurrent ? 'Current Session · ' : ''}
                      {s.userAgent || 'Web Browser'}
                    </div>
                    <div className="text-slate-500 tabular-nums">
                      Started {new Date(s.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button
                      onClick={async () => {
                        await apiRequest(`/api/auth/sessions/${s.id}`, { method: 'DELETE' });
                        setSessions((prev) => prev.filter((x) => x.id !== s.id));
                      }}
                      className="inline-flex items-center gap-1 text-red-600 hover:underline"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSubmitTicket} className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-3.5">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-iris-600" /> Submit Support Request
            </h2>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="general">General Question</option>
              <option value="billing">Billing & Refund</option>
              <option value="ats">ATS & Parsing</option>
              <option value="privacy">Privacy & Data</option>
            </select>
            <input
              required
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <textarea
              required
              minLength={10}
              rows={4}
              placeholder="Describe how we can help..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            {ticketSaved && (
              <div className="text-xs text-emerald-700">Support ticket submitted. Our team will respond shortly.</div>
            )}
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
            >
              Submit Ticket
            </button>
          </form>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Your Support Tickets</h2>
            {tickets.length === 0 ? (
              <p className="text-xs text-slate-500">No support requests submitted.</p>
            ) : (
              <div className="divide-y divide-slate-200 text-xs">
                {tickets.map((t) => (
                  <div key={t.id} className="py-3 space-y-1">
                    <div className="flex justify-between font-medium text-slate-900">
                      <span>{t.subject}</span>
                      <span className="capitalize text-iris-600">{t.status}</span>
                    </div>
                    {t.adminReply && (
                      <div className="p-2 rounded bg-slate-50 text-slate-700">Reply: {t.adminReply}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Personal Data Export & Deletion</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your resumes are private by default and never shared unless you explicitly enable a revocable share link. You can download a complete JSON archive of your account or permanently delete your account and all associated data.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handleExportData()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                <Download className="w-4 h-4" /> Export My Data (JSON)
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" /> Delete Account
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleDeleteAccount()}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-medium"
                  >
                    Confirm Permanent Deletion
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-xs text-slate-600 leading-relaxed">
            <h3 className="text-sm font-semibold text-slate-900">Policies Summary</h3>
            <p>
              <strong>Privacy Policy:</strong> We process resume text solely to render documents, run requested ATS diagnostics, and generate user-approved edits. Resumes are private by default.
            </p>
            <p>
              <strong>Refund Policy:</strong> Duplicate charges or verified billing errors are refunded in full within 5–7 business days via Razorpay to the original payment method.
            </p>
            <p>
              <strong>Terms of Service:</strong> Users retain 100% ownership of their resumes, cover letters, and personal career history.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
