import React, { useState } from 'react';
import {
  Briefcase,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  GitCompare,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  Search,
  SearchCheck,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { BRAND_CONFIG } from '../../config/brand';
import { exportResumeToDocx, exportResumeToPdf } from '../../lib/exportResume';
import type { EntitlementSummary, ResumeRecord, UserProfile } from '../../types/resume';
import { ResumeRenderer } from '../resume/ResumeRenderer';
import { AtsAnalyzerView } from '../tools/AtsAnalyzerView';
import { JobMatcherView } from '../tools/JobMatcherView';
import { CoverLetterView } from '../tools/CoverLetterView';
import { CareerToolsView } from '../tools/CareerToolsView';
import { SettingsBillingView } from '../settings/SettingsBillingView';
import { AdminDashboardView } from '../admin/AdminDashboardView';

export type DashboardTab =
  | 'resumes'
  | 'ats'
  | 'matcher'
  | 'cover-letters'
  | 'career'
  | 'settings'
  | 'admin';

interface DashboardLayoutProps {
  user: UserProfile;
  entitlements: EntitlementSummary;
  resumes: ResumeRecord[];
  announcement: string;
  activeTab: DashboardTab;
  onChangeTab: (tab: DashboardTab) => void;
  onCreateBlank: () => void;
  onStartFresher: () => void;
  onOpenUploadModal: (mode: 'upload' | 'ai_draft') => void;
  onEditResume: (resume: ResumeRecord) => void;
  onDuplicateResume: (resumeId: string) => void;
  onDeleteResume: (resumeId: string) => void;
  onOpenUpgrade: (reason?: string) => void;
  onRefreshAll: () => void;
  onLogout: () => void;
  onBackHome: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  entitlements,
  resumes,
  announcement,
  activeTab,
  onChangeTab,
  onCreateBlank,
  onStartFresher,
  onOpenUploadModal,
  onEditResume,
  onDuplicateResume,
  onDeleteResume,
  onOpenUpgrade,
  onRefreshAll,
  onLogout,
  onBackHome,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [builderFilter, setBuilderFilter] = useState<'all' | 'standard' | 'fresher'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [previewResume, setPreviewResume] = useState<ResumeRecord | null>(null);

  const filteredResumes = resumes
    .filter((r) => (builderFilter === 'all' ? true : r.builderType === builderFilter))
    .filter((r) => {
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.targetRole.toLowerCase().includes(q) ||
        r.templateId.toLowerCase().includes(q)
      );
    })
    .sort((a, b) =>
      sortBy === 'title'
        ? a.title.localeCompare(b.title)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  const navItems: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
    { id: 'resumes', label: 'My Resumes', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'ats', label: 'ATS Analyzer', icon: <SearchCheck className="w-4 h-4" /> },
    { id: 'matcher', label: 'Job Matcher', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'cover-letters', label: 'Cover Letters', icon: <Mail className="w-4 h-4" /> },
    { id: 'career', label: 'Job Tracker & Prep', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'settings', label: 'Billing & Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  if (user.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin Console', icon: <ShieldCheck className="w-4 h-4" /> });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <button
              onClick={onBackHome}
              className="text-lg font-bold tracking-tight text-slate-900 font-display"
            >
              {BRAND_CONFIG.name}
            </button>
            <span className="text-xs font-medium text-iris-600 capitalize">
              {entitlements.plan}
            </span>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-iris-50 text-iris-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="hidden lg:block p-4 border-t border-slate-200 space-y-3">
          {entitlements.plan === 'free' && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-900">Free Plan Usage</div>
              <div className="text-xs text-slate-600 tabular-nums">
                Resumes: {entitlements.resumesCreatedCount} / {entitlements.freeResumeLimit}
              </div>
              <div className="text-xs text-slate-600 tabular-nums">
                AI Credits: {entitlements.aiGenerationsUsed} / {entitlements.freeAiLimit}
              </div>
              <button
                onClick={() => onOpenUpgrade()}
                className="w-full px-3 py-1.5 rounded-md bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
              >
                Upgrade for ₹{entitlements.priceInr}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <div className="truncate">
              <div className="font-medium text-slate-900 truncate">{user.fullName}</div>
              <div className="text-slate-500 truncate">{user.email || user.phone}</div>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {announcement && (
          <div className="bg-iris-600 text-white px-6 py-2 text-xs font-medium">{announcement}</div>
        )}

        <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {activeTab === 'resumes' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    Welcome back, {user.fullName || 'Candidate'}
                  </h1>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {user.targetJobRole ? `Targeting: ${user.targetJobRole} · ` : ''}
                    Create, optimize, and export ATS-ready resumes.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onCreateBlank}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Resume
                  </button>
                  <button
                    onClick={onStartFresher}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 whitespace-nowrap"
                  >
                    <GraduationCap className="w-3.5 h-3.5" /> Fresher Builder
                  </button>
                  <button
                    onClick={() => onOpenUploadModal('upload')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload PDF/DOCX
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search resumes by title, role, or template..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex p-0.5 bg-slate-100 rounded-lg text-xs">
                    {(['all', 'standard', 'fresher'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setBuilderFilter(f)}
                        className={`px-2.5 py-1 rounded-md capitalize font-medium ${
                          builderFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'updated' | 'title')}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="updated">Last Modified</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </div>
              </div>

              {/* Resume Collection */}
              {filteredResumes.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">No resumes created yet</h2>
                    <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                      Your account includes 1 free resume (usable in either the Standard Builder or Fresher Builder) with unlimited editing and PDF/DOCX export.
                    </p>
                  </div>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={onCreateBlank}
                      className="px-4 py-2 rounded-lg bg-iris-600 text-white text-xs font-medium"
                    >
                      Create Standard Resume
                    </button>
                    <button
                      onClick={onStartFresher}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800"
                    >
                      Build Fresher Resume
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredResumes.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 truncate">{r.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {r.targetRole || 'General Role'} · {r.builderType === 'fresher' ? 'Fresher' : 'Standard'} ·{' '}
                          {r.templateId}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 tabular-nums">
                          Updated {new Date(r.updatedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => onEditResume(r)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setPreviewResume(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                        <button
                          onClick={() => exportResumeToPdf(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </button>
                        <button
                          onClick={() => void exportResumeToDocx(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
                          title="Download DOCX"
                        >
                          DOCX
                        </button>
                        <button
                          onClick={() => onDuplicateResume(r.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="Duplicate Resume"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteResume(r.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 ml-auto"
                          title="Delete Resume"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ats' && (
            <AtsAnalyzerView resumes={resumes} onRequireUpgrade={(msg) => onOpenUpgrade(msg)} />
          )}

          {activeTab === 'matcher' && (
            <JobMatcherView
              resumes={resumes}
              onOpenResume={(id) => {
                const found = resumes.find((r) => r.id === id);
                if (found) onEditResume(found);
                else onRefreshAll();
              }}
              onRefreshResumes={onRefreshAll}
              onRequireUpgrade={(msg) => onOpenUpgrade(msg)}
            />
          )}

          {activeTab === 'cover-letters' && <CoverLetterView resumes={resumes} />}

          {activeTab === 'career' && <CareerToolsView resumes={resumes} />}

          {activeTab === 'settings' && (
            <SettingsBillingView
              user={user}
              entitlements={entitlements}
              onOpenUpgrade={() => onOpenUpgrade()}
              onRefreshAuth={onRefreshAll}
              onAccountDeleted={onLogout}
            />
          )}

          {activeTab === 'admin' && user.role === 'admin' && <AdminDashboardView />}
        </main>
      </div>

      {previewResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">{previewResume.title}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const target = previewResume;
                    setPreviewResume(null);
                    onEditResume(target);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-iris-600 text-white text-xs font-medium"
                >
                  Open in Editor
                </button>
                <button
                  onClick={() => setPreviewResume(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-6 flex justify-center">
              <ResumeRenderer
                content={previewResume.content}
                templateId={previewResume.templateId}
                scale={0.78}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
