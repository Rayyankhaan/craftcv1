import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

interface AdminOverview {
  metrics: {
    totalUsers: number;
    freeUsers: number;
    premiumUsers: number;
    totalResumes: number;
    fresherResumes: number;
    totalRevenueInr: number;
    paidOrders: number;
    aiRequestsTotal: number;
    aiRequestsFailed: number;
    atsChecksTotal: number;
    openTickets: number;
  };
  templateUsage: { template_id: string; count: number }[];
  users: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
  coupons: Record<string, unknown>[];
  settings: {
    premiumPriceInr: number;
    billingInterval: string;
    freeResumeLimit: number;
    freeAiLimit: number;
    freeAtsLimit: number;
    premiumFeaturesEnabled: boolean;
    disabledTemplateIds: string[];
    announcement: string;
  };
}

export const AdminDashboardView: React.FC = () => {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Settings form
  const [priceInr, setPriceInr] = useState(99);
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [freeAiLimit, setFreeAiLimit] = useState(1);
  const [freeAtsLimit, setFreeAtsLimit] = useState(1);
  const [announcement, setAnnouncement] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(25);

  const load = async () => {
    try {
      const res = await apiRequest<AdminOverview>('/api/admin/overview');
      setData(res);
      setPriceInr(res.settings.premiumPriceInr);
      setBillingInterval(res.settings.billingInterval);
      setFreeAiLimit(res.settings.freeAiLimit);
      setFreeAtsLimit(res.settings.freeAtsLimit);
      setAnnouncement(res.settings.announcement);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin overview.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          premiumPriceInr: Number(priceInr),
          billingInterval,
          freeAiLimit: Number(freeAiLimit),
          freeAtsLimit: Number(freeAtsLimit),
          announcement,
        }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify({ code: couponCode, discountPercent: Number(discountPercent), maxUses: 200 }),
    });
    setCouponCode('');
    await load();
  };

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    );
  }
  if (!data) {
    return <div className="p-8 text-sm text-slate-500">Loading platform analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Admin Console</h1>
        <p className="text-sm text-slate-600 mt-1">
          Role-verified platform metrics, configurable ₹{priceInr} billing rules, coupons, user controls, and support queue.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: data.metrics.totalUsers, sub: `${data.metrics.premiumUsers} Premium · ${data.metrics.freeUsers} Free` },
          { label: 'Resumes Created', value: data.metrics.totalResumes, sub: `${data.metrics.fresherResumes} Fresher resumes` },
          { label: 'Verified Revenue', value: `₹${data.metrics.totalRevenueInr}`, sub: `${data.metrics.paidOrders} paid orders` },
          { label: 'AI & ATS Volume', value: data.metrics.aiRequestsTotal + data.metrics.atsChecksTotal, sub: `${data.metrics.aiRequestsFailed} failed AI calls` },
        ].map((k) => (
          <div key={k.label} className="p-4 rounded-xl bg-white border border-slate-200">
            <div className="text-xs text-slate-500">{k.label}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1">{k.value}</div>
            <div className="text-xs text-slate-500 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Pricing & Limits Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSaveSettings} className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Pricing, Billing Interval & Limits</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Price (INR)</label>
              <input
                type="number"
                value={priceInr}
                onChange={(e) => setPriceInr(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Interval</label>
              <select
                value={billingInterval}
                onChange={(e) => setBillingInterval(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="lifetime">Lifetime</option>
                <option value="one_time">One-Time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Free AI Limit</label>
              <input
                type="number"
                value={freeAiLimit}
                onChange={(e) => setFreeAiLimit(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Free ATS Limit</label>
              <input
                type="number"
                value={freeAtsLimit}
                onChange={(e) => setFreeAtsLimit(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Platform Announcement Banner</label>
            <input
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Optional announcement displayed to logged-in users"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Coupons</h2>
          <form onSubmit={handleCreateCoupon} className="flex gap-2">
            <input
              required
              placeholder="CODE"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-20 px-2 py-2 text-xs border border-slate-300 rounded-lg font-mono-tabular"
            />
            <button type="submit" className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium">
              Add
            </button>
          </form>
          <div className="divide-y divide-slate-200 text-xs">
            {data.coupons.map((c) => (
              <div key={String(c.code)} className="py-2 flex justify-between">
                <span className="font-mono-tabular font-semibold">{String(c.code)}</span>
                <span className="text-slate-600">
                  {String(c.discount_percent)}% off · Used {String(c.used_count)}/{String(c.max_uses)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
          Registered Users ({data.users.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Resumes / AI / ATS</th>
                <th className="py-2.5 px-4">Plan</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.users.map((u) => (
                <tr key={String(u.id)}>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{String(u.full_name || 'User')}</div>
                    <div className="text-slate-500">{String(u.email || u.phone || '')}</div>
                  </td>
                  <td className="py-2.5 px-4 capitalize">{String(u.role)}</td>
                  <td className="py-2.5 px-4 font-mono-tabular">
                    {Number(u.resumes_created_count || 0)} / {Number(u.ai_generations_used || 0)} /{' '}
                    {Number(u.ats_checks_used || 0)}
                  </td>
                  <td className="py-2.5 px-4 capitalize">{String(u.sub_status || 'free')}</td>
                  <td className="py-2.5 px-4 text-right">
                    {String(u.role) !== 'admin' && (
                      <button
                        onClick={async () => {
                          await apiRequest(`/api/admin/users/${String(u.id)}`, {
                            method: 'PUT',
                            body: JSON.stringify({ isSuspended: !Boolean(u.is_suspended) }),
                          });
                          await load();
                        }}
                        className="text-xs font-medium text-iris-600 hover:underline"
                      >
                        {Boolean(u.is_suspended) ? 'Restore' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Support Queue */}
      {data.tickets.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Support Tickets</h2>
          <div className="divide-y divide-slate-200 text-xs">
            {data.tickets.map((t) => (
              <div key={String(t.id)} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">
                    {String(t.subject)} <span className="text-slate-500">({String(t.email)})</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{String(t.message)}</p>
                </div>
                <button
                  onClick={async () => {
                    await apiRequest(`/api/admin/tickets/${String(t.id)}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        status: 'resolved',
                        adminReply: 'Resolved by CraftCV support team.',
                      }),
                    });
                    await load();
                  }}
                  className="px-3 py-1.5 rounded border border-slate-300 text-xs font-medium shrink-0"
                >
                  {String(t.status) === 'resolved' ? 'Resolved' : 'Mark Resolved'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
