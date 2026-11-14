import React, { useEffect, useState } from 'react';
import { Mail, Smartphone, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import type { EntitlementSummary, UserProfile } from '../../types/resume';
import { PopupModal } from '../ui/PopupModal';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'phone';
  onClose: () => void;
  googleOAuthConfigured: boolean;
  smsProviderConfigured: boolean;
  onAuthenticated: (user: UserProfile, entitlements: EntitlementSummary) => void;
}

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'US / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+61', label: 'Australia (+61)' },
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'register',
  onClose,
  googleOAuthConfigured,
  onAuthenticated,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'phone' | 'forgot'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialMode);
      setError(null);
      setNotice(null);
    }
  }, [isOpen, initialMode]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (tab === 'register') {
        const res = await apiRequest<{
          user: UserProfile;
          entitlements: EntitlementSummary;
          verificationNote?: string;
        }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ fullName, email, password }),
        });
        onAuthenticated(res.user, res.entitlements);
        onClose();
      } else {
        const res = await apiRequest<{ user: UserProfile; entitlements: EntitlementSummary }>(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }
        );
        onAuthenticated(res.user, res.entitlements);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ sent: boolean; notice: string }>('/api/auth/phone/send-otp', {
        method: 'POST',
        body: JSON.stringify({ countryCode, phone }),
      });
      setOtpSent(true);
      setNotice(res.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ user: UserProfile; entitlements: EntitlementSummary }>(
        '/api/auth/phone/verify-otp',
        {
          method: 'POST',
          body: JSON.stringify({ countryCode, phone, otp, fullName: fullName || undefined }),
        }
      );
      onAuthenticated(res.user, res.entitlements);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (resetStep === 'request') {
        const res = await apiRequest<{ message: string; devResetCodeHint?: string }>(
          '/api/auth/forgot-password',
          {
            method: 'POST',
            body: JSON.stringify({ email }),
          }
        );
        setNotice(res.devResetCodeHint || res.message);
        setResetStep('confirm');
      } else {
        const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, code: resetCode, newPassword }),
        });
        setNotice(res.message);
        setTab('login');
        setResetStep('request');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!googleOAuthConfigured) {
      setError(
        'Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server environment variables. Use Email or Phone OTP below.'
      );
      return;
    }
    window.location.href = '/api/auth/google';
  };

  const modalTitle =
    tab === 'register'
      ? 'Create your free account'
      : tab === 'login'
      ? 'Sign in to CraftCV'
      : tab === 'phone'
      ? 'Continue with mobile OTP'
      : 'Reset password';

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle="Free starter plan includes 1 complete resume and watermark-free PDF/DOCX downloads"
      maxWidthClass="max-w-md"
      bodyClassName="p-6 space-y-5"
    >
          {/* Method tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('phone');
                setError(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'phone' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mobile OTP
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <span className="font-bold text-iris-600">G</span>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-xs text-slate-400">or</span>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg bg-iris-50 border border-iris-300 px-3 py-2.5 text-xs text-iris-700">
              {notice}
            </div>
          )}

          {(tab === 'register' || tab === 'login') && (
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {tab === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Priya Sharma"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">Password</label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => setTab('forgot')}
                      className="text-xs text-iris-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={tab === 'register' ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {loading
                  ? 'Please wait...'
                  : tab === 'register'
                  ? 'Create Free Account'
                  : 'Sign In with Email'}
              </button>
            </form>
          )}

          {tab === 'phone' && (
            <form onSubmit={handleVerifyOtp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name (for new accounts)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Rohan Verma"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  disabled={loading || phone.length < 6}
                  onClick={handleSendOtp}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60"
                >
                  <Smartphone className="w-4 h-4" />
                  {loading ? 'Sending...' : 'Send 6-Digit OTP'}
                </button>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">6-Digit OTP</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full px-3 py-2 text-sm font-mono-tabular tracking-widest border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="px-3 py-2.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                    >
                      Resend OTP
                    </button>
                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60"
                    >
                      Verify & Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {tab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              {resetStep === 'confirm' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Reset Code</label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="px-4 py-2.5 text-sm border border-slate-300 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-iris-600 text-white text-sm font-medium rounded-lg hover:bg-iris-700"
                >
                  {resetStep === 'request' ? 'Send Reset Code' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
    </PopupModal>
  );
};
