import { useEffect, useState } from 'react';
import { apiRequest, ApiError } from './lib/api';
import {
  createEmptyResumeContent,
  type EntitlementSummary,
  type ResumeRecord,
  type UserProfile,
} from './types/resume';
import { LandingPage } from './components/landing/LandingPage';
import { AuthModal } from './components/auth/AuthModal';
import { OnboardingFlow } from './components/auth/OnboardingFlow';
import { DashboardLayout, type DashboardTab } from './components/dashboard/DashboardLayout';
import { ResumeEditor } from './components/editor/ResumeEditor';
import { FresherWizard } from './components/fresher/FresherWizard';
import { UploadResumeModal } from './components/upload/UploadResumeModal';
import { UpgradeModal } from './components/modals/UpgradeModal';
import { ResumeRenderer } from './components/resume/ResumeRenderer';
import { PopupModal } from './components/ui/PopupModal';

interface AuthBootstrapResponse {
  user: UserProfile | null;
  entitlements: EntitlementSummary | null;
  providers: {
    googleOAuthConfigured: boolean;
    smsProviderConfigured: boolean;
    razorpayConfigured: boolean;
    geminiConfigured: boolean;
  };
  platform: {
    announcement: string;
    disabledTemplateIds: string[];
    premiumPriceInr: number;
    billingInterval: string;
  };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementSummary | null>(null);
  const [providers, setProviders] = useState({
    googleOAuthConfigured: false,
    smsProviderConfigured: false,
    razorpayConfigured: false,
    geminiConfigured: false,
  });
  const [platform, setPlatform] = useState({
    announcement: '',
    disabledTemplateIds: [] as string[],
    premiumPriceInr: 99,
    billingInterval: 'monthly',
  });

  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [view, setView] = useState<'landing' | 'onboarding' | 'dashboard' | 'editor' | 'fresher' | 'shared'>('landing');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('resumes');
  const [activeResume, setActiveResume] = useState<ResumeRecord | null>(null);
  const [sharedResume, setSharedResume] = useState<ResumeRecord | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('register');
  const [pendingAction, setPendingAction] = useState<{
    mode: 'standard' | 'fresher' | 'upload' | 'ats' | 'matcher' | 'cover-letters' | 'career';
    templateId?: string;
  } | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadInitialMode, setUploadInitialMode] = useState<'upload' | 'ai_draft'>('upload');
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; reason?: string }>({ open: false });
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'refund' | 'support' | null>(null);
  const [publicSupportEmail, setPublicSupportEmail] = useState('');
  const [publicSupportMsg, setPublicSupportMsg] = useState('');
  const [publicSupportSent, setPublicSupportSent] = useState(false);

  const loadBootstrap = async () => {
    try {
      const data = await apiRequest<AuthBootstrapResponse>('/api/auth/me');
      setUser(data.user);
      setEntitlements(data.entitlements);
      setProviders(data.providers);
      setPlatform(data.platform);
      if (data.user) {
        const resList = await apiRequest<{ resumes: ResumeRecord[] }>('/api/resumes');
        setResumes(resList.resumes);
      } else {
        setResumes([]);
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get('share');
    if (shareToken) {
      void apiRequest<{ resume: ResumeRecord }>(`/api/public/resumes/${shareToken}`)
        .then((res) => {
          setSharedResume(res.resume);
          setView('shared');
          setLoading(false);
        })
        .catch(() => {
          void loadBootstrap();
        });
      return;
    }
    void loadBootstrap();
  }, []);

  const executeIntent = async (
    mode: 'standard' | 'fresher' | 'upload' | 'ats' | 'matcher' | 'cover-letters' | 'career',
    templateId?: string,
    currentUser: UserProfile | null = user
  ) => {
    if (!currentUser) {
      setPendingAction({ mode, templateId });
      setAuthInitialMode('register');
      setAuthModalOpen(true);
      return;
    }
    if (mode === 'fresher') {
      setView('fresher');
      return;
    }
    if (mode === 'upload') {
      setView('dashboard');
      setUploadInitialMode('upload');
      setUploadModalOpen(true);
      return;
    }
    if (mode === 'ats' || mode === 'matcher' || mode === 'cover-letters' || mode === 'career') {
      setDashboardTab(mode);
      setView('dashboard');
      return;
    }
    await handleCreateBlankResume(templateId || 'ats-classic');
  };

  const handleCreateBlankResume = async (templateId = 'ats-classic') => {
    try {
      const content = createEmptyResumeContent('standard');
      if (user) {
        content.personal.fullName = user.fullName || '';
        content.personal.email = user.email || '';
        content.personal.phone = user.phone || '';
        content.personal.targetRole = user.targetJobRole || '';
      }
      const res = await apiRequest<{ resume: ResumeRecord; entitlements: EntitlementSummary }>('/api/resumes', {
        method: 'POST',
        body: JSON.stringify({
          title: user?.targetJobRole ? `${user.targetJobRole} Resume` : 'Untitled Resume',
          targetRole: user?.targetJobRole || '',
          builderType: 'standard',
          templateId,
          content,
        }),
      });
      setResumes((prev) => [res.resume, ...prev]);
      setEntitlements(res.entitlements);
      setActiveResume(res.resume);
      setView('editor');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        setUpgradeModal({ open: true, reason: err.message });
      }
    }
  };

  const handleDuplicateResume = async (resumeId: string) => {
    try {
      const res = await apiRequest<{ resume: ResumeRecord; entitlements: EntitlementSummary }>(
        `/api/resumes/${resumeId}/duplicate`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      setResumes((prev) => [res.resume, ...prev]);
      setEntitlements(res.entitlements);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        setUpgradeModal({ open: true, reason: err.message });
      }
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    const res = await apiRequest<{ entitlements: EntitlementSummary }>(`/api/resumes/${resumeId}`, {
      method: 'DELETE',
    });
    setResumes((prev) => prev.filter((r) => r.id !== resumeId));
    setEntitlements(res.entitlements);
  };

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setEntitlements(null);
    setResumes([]);
    setActiveResume(null);
    setView('landing');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-sm text-slate-500">
        Loading workspace...
      </div>
    );
  }

  if (view === 'shared' && sharedResume) {
    return (
      <div className="min-h-screen bg-slate-100 py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-slate-200">
            <span className="text-sm font-semibold text-slate-900">{sharedResume.title}</span>
            <button
              onClick={() => {
                window.history.replaceState({}, '', '/');
                void loadBootstrap();
                setView('landing');
              }}
              className="text-xs font-medium text-iris-600 hover:underline"
            >
              Build Your Own Resume →
            </button>
          </div>
          <ResumeRenderer content={sharedResume.content} templateId={sharedResume.templateId} scale={0.85} />
        </div>
      </div>
    );
  }

  return (
    <>
      {view === 'landing' && (
        <LandingPage
          isAuthenticated={Boolean(user)}
          priceInr={platform.premiumPriceInr}
          billingInterval={platform.billingInterval}
          onStartCreate={(mode, templateId) => void executeIntent(mode, templateId)}
          onOpenAuth={(mode) => {
            setAuthInitialMode(mode);
            setAuthModalOpen(true);
          }}
          onOpenDashboard={() => setView('dashboard')}
          onOpenLegal={(sec) => setLegalModal(sec)}
        />
      )}

      {view === 'onboarding' && user && (
        <OnboardingFlow
          user={user}
          onComplete={async (recommended) => {
            await loadBootstrap();
            if (recommended === 'fresher') setView('fresher');
            else if (recommended === 'ats') {
              setDashboardTab('ats');
              setView('dashboard');
            } else {
              setView('dashboard');
            }
          }}
        />
      )}

      {view === 'fresher' && user && entitlements && (
        <FresherWizard
          initialEmail={user.email || ''}
          initialFullName={user.fullName}
          isPremium={entitlements.plan === 'premium'}
          onCancel={() => setView('dashboard')}
          onCreated={(created) => {
            setResumes((prev) => [created, ...prev]);
            void loadBootstrap();
            setActiveResume(created);
            setView('editor');
          }}
          onRequireUpgrade={(reason) => setUpgradeModal({ open: true, reason })}
        />
      )}

      {view === 'editor' && user && entitlements && activeResume && (
        <ResumeEditor
          resume={activeResume}
          isPremium={entitlements.plan === 'premium'}
          disabledTemplateIds={platform.disabledTemplateIds}
          onBack={() => {
            void loadBootstrap();
            setView('dashboard');
          }}
          onUpdated={(updated) => {
            setActiveResume(updated);
            setResumes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
          onRequireUpgrade={(reason) => setUpgradeModal({ open: true, reason })}
        />
      )}

      {view === 'dashboard' && user && entitlements && (
        <DashboardLayout
          user={user}
          entitlements={entitlements}
          resumes={resumes}
          announcement={platform.announcement}
          activeTab={dashboardTab}
          onChangeTab={setDashboardTab}
          onCreateBlank={() => void handleCreateBlankResume('ats-classic')}
          onStartFresher={() => setView('fresher')}
          onOpenUploadModal={(mode) => {
            setUploadInitialMode(mode);
            setUploadModalOpen(true);
          }}
          onEditResume={(r) => {
            setActiveResume(r);
            setView('editor');
          }}
          onDuplicateResume={(id) => void handleDuplicateResume(id)}
          onDeleteResume={(id) => void handleDeleteResume(id)}
          onOpenUpgrade={(reason) => setUpgradeModal({ open: true, reason })}
          onRefreshAll={() => void loadBootstrap()}
          onLogout={() => void handleLogout()}
          onBackHome={() => setView('landing')}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        googleOAuthConfigured={providers.googleOAuthConfigured}
        smsProviderConfigured={providers.smsProviderConfigured}
        onAuthenticated={async (loggedInUser, ent) => {
          setUser(loggedInUser);
          setEntitlements(ent);
          await loadBootstrap();
          if (pendingAction) {
            const act = pendingAction;
            setPendingAction(null);
            await executeIntent(act.mode, act.templateId, loggedInUser);
            return;
          }
          if (!loggedInUser.onboardingCompleted) {
            setView('onboarding');
          } else {
            setView('dashboard');
          }
        }}
      />

      <UploadResumeModal
        isOpen={uploadModalOpen}
        initialMode={uploadInitialMode}
        onClose={() => setUploadModalOpen(false)}
        onCreated={(created) => {
          setResumes((prev) => [created, ...prev]);
          void loadBootstrap();
          setActiveResume(created);
          setView('editor');
        }}
        onRequireUpgrade={(reason) => setUpgradeModal({ open: true, reason })}
      />

      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false })}
        priceInr={platform.premiumPriceInr}
        billingInterval={platform.billingInterval}
        reasonMessage={upgradeModal.reason}
        onSuccess={(nextEntitlements) => {
          setEntitlements(nextEntitlements);
          void loadBootstrap();
        }}
      />

      <PopupModal
        isOpen={Boolean(legalModal)}
        onClose={() => setLegalModal(null)}
        title={
          legalModal === 'support'
            ? 'Contact & Support'
            : legalModal
            ? `${legalModal.charAt(0).toUpperCase() + legalModal.slice(1)} Policy`
            : ''
        }
        maxWidthClass="max-w-lg"
        bodyClassName="p-6 space-y-4"
      >
        {legalModal === 'support' ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiRequest('/api/support/tickets', {
                method: 'POST',
                body: JSON.stringify({
                  email: publicSupportEmail,
                  subject: 'Website Inquiry',
                  category: 'general',
                  message: publicSupportMsg,
                }),
              });
              setPublicSupportSent(true);
            }}
            className="space-y-3"
          >
            <input
              type="email"
              required
              placeholder="Your email"
              value={publicSupportEmail}
              onChange={(e) => setPublicSupportEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
            />
            <textarea
              required
              minLength={10}
              rows={4}
              placeholder="How can we help?"
              value={publicSupportMsg}
              onChange={(e) => setPublicSupportMsg(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
            />
            {publicSupportSent && (
              <p className="text-xs text-emerald-700 font-medium">Support ticket submitted.</p>
            )}
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700 transition-colors"
            >
              Send Message
            </button>
          </form>
        ) : (
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            {legalModal === 'privacy' && (
              <p>
                Resumes, uploaded documents, and ATS analyses are private to your account by default. You can export all personal records in JSON format or delete your account at any time from Settings.
              </p>
            )}
            {legalModal === 'terms' && (
              <p>
                You retain full ownership of all resumes and cover letters created on the platform. Free accounts receive 1 total free resume across standard and fresher builders with unlimited editing and free PDF/DOCX downloads.
              </p>
            )}
            {legalModal === 'refund' && (
              <p>
                If you experience a duplicate charge or verified technical billing issue with Razorpay, contact support within 7 days for a full refund to your original payment method.
              </p>
            )}
          </div>
        )}
      </PopupModal>
    </>
  );
}
