import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Download,
  Eye,
  EyeOff,
  History,
  Plus,
  Redo2,
  Save,
  Share2,
  Trash2,
  Undo2,
  Wand2,
} from 'lucide-react';
import { apiRequest, ApiError } from '../../lib/api';
import { RESUME_TEMPLATES } from '../../lib/templates';
import { exportResumeToDocx, exportResumeToPdf, exportResumeToTxt } from '../../lib/exportResume';
import type {
  ResumeContent,
  ResumeDesignSettings,
  ResumeRecord,
  ResumeSectionKey,
  ResumeVersionRecord,
} from '../../types/resume';
import { ResumeRenderer } from '../resume/ResumeRenderer';

interface ResumeEditorProps {
  resume: ResumeRecord;
  isPremium: boolean;
  disabledTemplateIds: string[];
  onBack: () => void;
  onUpdated: (resume: ResumeRecord) => void;
  onRequireUpgrade: (reason: string) => void;
}

const SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: 'Professional Summary',
  objective: 'Career Objective',
  experience: 'Work Experience',
  internships: 'Internships',
  education: 'Education',
  technicalSkills: 'Technical Skills',
  softSkills: 'Soft Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  achievements: 'Achievements',
  awards: 'Awards',
  languages: 'Languages',
  publications: 'Publications',
  volunteer: 'Volunteer Experience',
  coursework: 'Relevant Coursework',
  responsibilities: 'Positions of Responsibility',
  extracurricular: 'Extracurricular Activities',
  custom: 'Custom Sections',
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const ResumeEditor: React.FC<ResumeEditorProps> = ({
  resume,
  isPremium,
  disabledTemplateIds,
  onBack,
  onUpdated,
  onRequireUpgrade,
}) => {
  const [title, setTitle] = useState(resume.title);
  const [templateId, setTemplateId] = useState(resume.templateId);
  const [content, setContent] = useState<ResumeContent>(resume.content);
  const [history, setHistory] = useState<ResumeContent[]>([resume.content]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [leftTab, setLeftTab] = useState<'content' | 'templates' | 'design' | 'versions'>('content');
  const [activeSection, setActiveSection] = useState<ResumeSectionKey | 'personal'>('personal');
  const [zoom, setZoom] = useState(0.75);

  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [versions, setVersions] = useState<ResumeVersionRecord[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(resume.isPublic);
  const [shareToken, setShareToken] = useState(resume.shareToken);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  // AI Writer inline state
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposal, setAiProposal] = useState<{
    target: 'summary' | 'objective' | 'exp' | 'proj';
    itemId?: string;
    output: string;
    bullets?: string[];
    questions: string[];
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const autosaveTimer = useRef<number | null>(null);
  const firstRender = useRef(true);

  const pushContent = (next: ResumeContent) => {
    setContent(next);
    const sliced = history.slice(0, historyIndex + 1);
    const updated = [...sliced, next].slice(-30);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setContent(history[nextIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setContent(history[nextIdx]);
    }
  };

  const persistSave = async (createVersion = false, versionLabel?: string) => {
    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await apiRequest<{ resume: ResumeRecord }>(`/api/resumes/${resume.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          targetRole: content.personal.targetRole || resume.targetRole,
          templateId,
          content,
          createVersion,
          versionLabel,
        }),
      });
      setSaveState('saved');
      onUpdated(res.resume);
      if (createVersion) {
        loadVersions();
      }
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Autosave failed.');
    }
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    setSaveState('saving');
    autosaveTimer.current = window.setTimeout(() => {
      void persistSave(false);
    }, 1100);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [content, title, templateId]);

  const loadVersions = async () => {
    try {
      const res = await apiRequest<{ versions: ResumeVersionRecord[] }>(`/api/resumes/${resume.id}/versions`);
      setVersions(res.versions);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (leftTab === 'versions') {
      void loadVersions();
    }
  }, [leftTab]);

  const runAiAssist = async (
    action: 'generate_summary' | 'generate_objective' | 'improve' | 'rewrite' | 'shorten' | 'expand' | 'fix_grammar' | 'generate_bullets',
    target: 'summary' | 'objective' | 'exp' | 'proj',
    text: string,
    contextText: string,
    itemId?: string
  ) => {
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await apiRequest<{
        result: { output: string; bullets?: string[]; missingInfoQuestions: string[] };
      }>('/api/ai/write', {
        method: 'POST',
        body: JSON.stringify({
          action,
          targetRole: content.personal.targetRole || resume.targetRole,
          text,
          context: contextText,
        }),
      });
      setAiProposal({
        target,
        itemId,
        output: res.result.output,
        bullets: res.result.bullets,
        questions: res.result.missingInfoQuestions || [],
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        onRequireUpgrade(err.message);
      } else {
        setAiError(err instanceof Error ? err.message : 'AI assistant error.');
      }
    } finally {
      setAiBusy(false);
    }
  };

  const acceptAiProposal = () => {
    if (!aiProposal) return;
    if (aiProposal.target === 'summary') {
      pushContent({ ...content, summary: aiProposal.output });
    } else if (aiProposal.target === 'objective') {
      pushContent({ ...content, objective: aiProposal.output });
    } else if (aiProposal.target === 'exp' && aiProposal.itemId) {
      const newBullets = aiProposal.bullets?.length
        ? aiProposal.bullets
        : aiProposal.output.split('\n').map((s) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
      pushContent({
        ...content,
        experience: content.experience.map((e) =>
          e.id === aiProposal.itemId ? { ...e, bullets: newBullets } : e
        ),
      });
    } else if (aiProposal.target === 'proj' && aiProposal.itemId) {
      const newBullets = aiProposal.bullets?.length
        ? aiProposal.bullets
        : aiProposal.output.split('\n').map((s) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
      pushContent({
        ...content,
        projects: content.projects.map((p) =>
          p.id === aiProposal.itemId ? { ...p, bullets: newBullets } : p
        ),
      });
    }
    setAiProposal(null);
  };

  const handleDownload = async (format: 'pdf' | 'docx' | 'txt') => {
    setDownloadMenuOpen(false);
    const currentRecord: ResumeRecord = { ...resume, title, templateId, content };
    if (format === 'pdf') exportResumeToPdf(currentRecord);
    if (format === 'docx') await exportResumeToDocx(currentRecord);
    if (format === 'txt') exportResumeToTxt(currentRecord);
    void apiRequest(`/api/resumes/${resume.id}/track-download`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    }).catch(() => {});
  };

  const moveSection = (key: ResumeSectionKey, dir: -1 | 1) => {
    const order = [...content.sectionOrder];
    const idx = order.indexOf(key);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= order.length) return;
    const [removed] = order.splice(idx, 1);
    order.splice(targetIdx, 0, removed);
    pushContent({ ...content, sectionOrder: order });
  };

  const toggleHideSection = (key: ResumeSectionKey) => {
    const hidden = new Set(content.hiddenSections);
    if (hidden.has(key)) hidden.delete(key);
    else hidden.add(key);
    pushContent({ ...content, hiddenSections: Array.from(hidden) });
  };

  const updateDesign = <K extends keyof ResumeDesignSettings>(k: K, val: ResumeDesignSettings[K]) => {
    pushContent({ ...content, design: { ...content.design, [k]: val } });
  };

  const handleToggleShare = async (enable: boolean) => {
    const res = await apiRequest<{ isPublic: boolean; shareToken: string | null }>(
      `/api/resumes/${resume.id}/share`,
      {
        method: 'POST',
        body: JSON.stringify({ isPublic: enable }),
      }
    );
    setIsPublic(res.isPublic);
    setShareToken(res.shareToken);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Editor Top Toolbar */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Resume title"
            className="text-sm font-semibold text-slate-900 bg-transparent border border-transparent hover:border-slate-300 focus:border-iris-600 focus:bg-white rounded-md px-2 py-1 min-w-[160px] max-w-[260px] truncate focus:outline-none"
          />
          <span className="text-xs text-slate-500 hidden sm:inline whitespace-nowrap">
            {saveState === 'saving'
              ? 'Saving...'
              : saveState === 'error'
              ? 'Save failed'
              : 'All changes saved'}
          </span>
          {saveState === 'error' && (
            <button
              onClick={() => void persistSave(false)}
              className="text-xs font-medium text-red-700 underline"
            >
              Retry
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShareOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>

          <button
            onClick={() => void persistSave(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            Save Snapshot
          </button>

          <div className="relative">
            <button
              onClick={() => setDownloadMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            {downloadMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 rounded-lg bg-white border border-slate-200 shadow-lg py-1 z-30">
                <button
                  onClick={() => void handleDownload('pdf')}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Download PDF (A4 Vector)
                </button>
                <button
                  onClick={() => void handleDownload('docx')}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Download DOCX (Word)
                </button>
                <button
                  onClick={() => void handleDownload('txt')}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Download TXT (Plain ATS)
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
          <span>Autosave recovery notice: {saveError}</span>
          <button onClick={() => void persistSave(false)} className="font-semibold underline">
            Save Now
          </button>
        </div>
      )}

      {shareOpen && (
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-900">Private by default.</span>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => void handleToggleShare(e.target.checked)}
              />
              <span>Enable revocable public read-only link</span>
            </label>
          </div>
          {isPublic && shareToken && (
            <div className="font-mono-tabular text-iris-600">
              {window.location.origin}/?share={shareToken}
            </div>
          )}
        </div>
      )}

      {/* Split Screen Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANE: Editor Controls */}
        <div className="w-full lg:w-[50%] bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Left Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 bg-slate-50">
            {[
              { id: 'content', label: 'Content' },
              { id: 'templates', label: 'Templates (22)' },
              { id: 'design', label: 'Typography & Spacing' },
              { id: 'versions', label: 'Version History' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setLeftTab(t.id as typeof leftTab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  leftTab === t.id
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto subtle-scroll p-5 space-y-6">
            {aiError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
                {aiError}
              </div>
            )}

            {aiProposal && (
              <div className="rounded-xl border border-iris-300 bg-iris-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-iris-700">AI Suggestion Ready</span>
                  <div className="flex gap-2">
                    <button
                      onClick={acceptAiProposal}
                      className="px-3 py-1 rounded-md bg-iris-600 text-white text-xs font-medium"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setAiProposal(null)}
                      className="px-3 py-1 rounded-md border border-slate-300 bg-white text-xs text-slate-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-800 whitespace-pre-line">{aiProposal.output}</p>
                {aiProposal.bullets && aiProposal.bullets.length > 0 && (
                  <ul className="list-disc pl-4 text-xs text-slate-800 space-y-1">
                    {aiProposal.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {aiProposal.questions.length > 0 && (
                  <div className="pt-2 border-t border-iris-300 text-xs text-iris-700">
                    <div className="font-medium">To strengthen this without guessing, clarify:</div>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {aiProposal.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {leftTab === 'content' && (
              <div className="space-y-6">
                {/* Section Pills Navigation */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveSection('personal')}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${
                      activeSection === 'personal'
                        ? 'bg-iris-600 text-white border-iris-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Personal Info
                  </button>
                  {content.sectionOrder.map((key) => (
                    <button
                      key={key}
                      onClick={() => setActiveSection(key)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${
                        activeSection === key
                          ? 'bg-iris-600 text-white border-iris-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      } ${content.hiddenSections.includes(key) ? 'opacity-50' : ''}`}
                    >
                      {content.sectionHeadings?.[key] || SECTION_LABELS[key] || key}
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveSection('custom')}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${
                      activeSection === 'custom'
                        ? 'bg-iris-600 text-white border-iris-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    + Custom Section
                  </button>
                </div>

                {/* Section Order & Heading Editor Bar */}
                {activeSection !== 'personal' && activeSection !== 'custom' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Heading:</span>
                      <input
                        type="text"
                        value={content.sectionHeadings?.[activeSection] || SECTION_LABELS[activeSection]}
                        onChange={(e) =>
                          pushContent({
                            ...content,
                            sectionHeadings: { ...content.sectionHeadings, [activeSection]: e.target.value },
                          })
                        }
                        className="px-2 py-1 text-xs font-medium bg-white border border-slate-300 rounded"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => moveSection(activeSection, -1)}
                        title="Move section up"
                        className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveSection(activeSection, 1)}
                        title="Move section down"
                        className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleHideSection(activeSection)}
                        title="Toggle visibility"
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-xs"
                      >
                        {content.hiddenSections.includes(activeSection) ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" /> Hidden
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> Visible
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* PERSONAL INFO */}
                {activeSection === 'personal' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      { key: 'fullName', label: 'Full Name', placeholder: 'Priya Sharma' },
                      { key: 'targetRole', label: 'Target Job Title', placeholder: 'Software Engineer' },
                      { key: 'email', label: 'Email', placeholder: 'priya@example.com' },
                      { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
                      { key: 'location', label: 'Location', placeholder: 'Bengaluru, India' },
                      { key: 'linkedin', label: 'LinkedIn URL', placeholder: 'linkedin.com/in/priya' },
                      { key: 'github', label: 'GitHub URL', placeholder: 'github.com/priya' },
                      { key: 'portfolio', label: 'Portfolio / Website', placeholder: 'priyasharma.dev' },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{f.label}</label>
                        <input
                          type="text"
                          value={content.personal[f.key as keyof typeof content.personal] || ''}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              personal: { ...content.personal, [f.key]: e.target.value },
                            })
                          }
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* SUMMARY OR OBJECTIVE */}
                {(activeSection === 'summary' || activeSection === 'objective') && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-medium text-slate-700">
                        {activeSection === 'summary' ? 'Professional Summary' : 'Career Objective'}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { action: activeSection === 'summary' ? 'generate_summary' : 'generate_objective', label: 'Generate' },
                          { action: 'improve', label: 'Improve' },
                          { action: 'shorten', label: 'Shorten' },
                          { action: 'fix_grammar', label: 'Fix Grammar' },
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            disabled={aiBusy}
                            onClick={() =>
                              void runAiAssist(
                                btn.action as 'generate_summary',
                                activeSection,
                                content[activeSection],
                                JSON.stringify({
                                  skills: content.technicalSkills,
                                  education: content.education,
                                  experience: content.experience,
                                  projects: content.projects,
                                })
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-iris-300 bg-iris-50 text-xs font-medium text-iris-600 hover:bg-iris-50 disabled:opacity-50"
                          >
                            <Wand2 className="w-3 h-3" />
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      rows={5}
                      value={content[activeSection]}
                      onChange={(e) => pushContent({ ...content, [activeSection]: e.target.value })}
                      placeholder="Write 2–4 crisp sentences grounded in your skills, projects, and experience."
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
                    />
                  </div>
                )}

                {/* EXPERIENCE / INTERNSHIPS / VOLUNTEER */}
                {(activeSection === 'experience' ||
                  activeSection === 'internships' ||
                  activeSection === 'volunteer') && (
                  <div className="space-y-4">
                    {content[activeSection].map((item, idx) => (
                      <div key={item.id} className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">Entry #{idx + 1}</span>
                          <button
                            onClick={() =>
                              pushContent({
                                ...content,
                                [activeSection]: content[activeSection].filter((x) => x.id !== item.id),
                              })
                            }
                            className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            placeholder="Job Title / Role"
                            value={item.role}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                [activeSection]: content[activeSection].map((x) =>
                                  x.id === item.id ? { ...x, role: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            placeholder="Company / Organization"
                            value={item.company}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                [activeSection]: content[activeSection].map((x) =>
                                  x.id === item.id ? { ...x, company: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            placeholder="Location (e.g. Pune)"
                            value={item.location}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                [activeSection]: content[activeSection].map((x) =>
                                  x.id === item.id ? { ...x, location: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <div className="flex gap-2">
                            <input
                              placeholder="Start (MMM YYYY)"
                              value={item.startDate}
                              onChange={(e) =>
                                pushContent({
                                  ...content,
                                  [activeSection]: content[activeSection].map((x) =>
                                    x.id === item.id ? { ...x, startDate: e.target.value } : x
                                  ),
                                })
                              }
                              className="w-1/2 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                            />
                            <input
                              placeholder="End"
                              disabled={item.current}
                              value={item.current ? 'Present' : item.endDate}
                              onChange={(e) =>
                                pushContent({
                                  ...content,
                                  [activeSection]: content[activeSection].map((x) =>
                                    x.id === item.id ? { ...x, endDate: e.target.value } : x
                                  ),
                                })
                              }
                              className="w-1/2 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={item.current}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                [activeSection]: content[activeSection].map((x) =>
                                  x.id === item.id ? { ...x, current: e.target.checked } : x
                                ),
                              })
                            }
                          />
                          Currently working here
                        </label>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-700">Achievement Bullets (one per line)</span>
                            {activeSection === 'experience' && (
                              <button
                                disabled={aiBusy}
                                onClick={() =>
                                  void runAiAssist(
                                    'generate_bullets',
                                    'exp',
                                    item.bullets.join('\n'),
                                    `${item.role} at ${item.company}`,
                                    item.id
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-iris-300 bg-iris-50 text-xs font-medium text-iris-600"
                              >
                                <Wand2 className="w-3 h-3" /> Improve Bullets
                              </button>
                            )}
                          </div>
                          <textarea
                            rows={4}
                            value={item.bullets.join('\n')}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                [activeSection]: content[activeSection].map((x) =>
                                  x.id === item.id ? { ...x, bullets: e.target.value.split('\n') } : x
                                ),
                              })
                            }
                            placeholder="Led development of..."
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        pushContent({
                          ...content,
                          [activeSection]: [
                            ...content[activeSection],
                            {
                              id: uid(),
                              company: '',
                              role: '',
                              location: '',
                              startDate: '',
                              endDate: '',
                              current: false,
                              bullets: [''],
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add {SECTION_LABELS[activeSection]}
                    </button>
                  </div>
                )}

                {/* EDUCATION */}
                {activeSection === 'education' && (
                  <div className="space-y-4">
                    {content.education.map((edu, idx) => (
                      <div key={edu.id} className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">Qualification #{idx + 1}</span>
                          <button
                            onClick={() =>
                              pushContent({
                                ...content,
                                education: content.education.filter((x) => x.id !== edu.id),
                              })
                            }
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            placeholder="College / University"
                            value={edu.institution}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                education: content.education.map((x) =>
                                  x.id === edu.id ? { ...x, institution: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            placeholder="Degree (e.g. B.Tech, B.Com)"
                            value={edu.degree}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                education: content.education.map((x) =>
                                  x.id === edu.id ? { ...x, degree: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            placeholder="Specialization / Branch"
                            value={edu.specialization}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                education: content.education.map((x) =>
                                  x.id === edu.id ? { ...x, specialization: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            placeholder="CGPA or Percentage (Optional)"
                            value={edu.score}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                education: content.education.map((x) =>
                                  x.id === edu.id ? { ...x, score: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            placeholder="Start Year"
                            value={edu.startDate}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                education: content.education.map((x) =>
                                  x.id === edu.id ? { ...x, startDate: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            placeholder="Graduation Year"
                            value={edu.endDate}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                education: content.education.map((x) =>
                                  x.id === edu.id ? { ...x, endDate: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        pushContent({
                          ...content,
                          education: [
                            ...content.education,
                            {
                              id: uid(),
                              institution: '',
                              degree: '',
                              specialization: '',
                              location: '',
                              startDate: '',
                              endDate: '',
                              score: '',
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Education
                    </button>
                  </div>
                )}

                {/* PROJECTS */}
                {activeSection === 'projects' && (
                  <div className="space-y-4">
                    {content.projects.map((proj, idx) => (
                      <div key={proj.id} className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">Project #{idx + 1}</span>
                          <button
                            onClick={() =>
                              pushContent({
                                ...content,
                                projects: content.projects.filter((x) => x.id !== proj.id),
                              })
                            }
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            placeholder="Project Title"
                            value={proj.title}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                projects: content.projects.map((x) =>
                                  x.id === proj.id ? { ...x, title: e.target.value } : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            placeholder="Technologies (comma separated)"
                            value={proj.technologies.join(', ')}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                projects: content.projects.map((x) =>
                                  x.id === proj.id
                                    ? {
                                        ...x,
                                        technologies: e.target.value
                                          .split(',')
                                          .map((s) => s.trim())
                                          .filter(Boolean),
                                      }
                                    : x
                                ),
                              })
                            }
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                        <input
                          placeholder="Short Summary"
                          value={proj.description}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              projects: content.projects.map((x) =>
                                x.id === proj.id ? { ...x, description: e.target.value } : x
                              ),
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700">Key Project Bullets</span>
                          <button
                            disabled={aiBusy}
                            onClick={() =>
                              void runAiAssist(
                                'generate_bullets',
                                'proj',
                                proj.bullets.join('\n') || proj.description,
                                `Project: ${proj.title}, Tech: ${proj.technologies.join(', ')}`,
                                proj.id
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-iris-300 bg-iris-50 text-xs font-medium text-iris-600"
                          >
                            <Wand2 className="w-3 h-3" /> Refine Bullets
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={proj.bullets.join('\n')}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              projects: content.projects.map((x) =>
                                x.id === proj.id ? { ...x, bullets: e.target.value.split('\n') } : x
                              ),
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        pushContent({
                          ...content,
                          projects: [
                            ...content.projects,
                            {
                              id: uid(),
                              title: '',
                              domain: '',
                              technologies: [],
                              link: '',
                              startDate: '',
                              endDate: '',
                              description: '',
                              bullets: [''],
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Project
                    </button>
                  </div>
                )}

                {/* STRING LIST SECTIONS (Skills, Coursework, Extracurricular) */}
                {(activeSection === 'technicalSkills' ||
                  activeSection === 'softSkills' ||
                  activeSection === 'coursework' ||
                  activeSection === 'extracurricular') && (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-700">
                      {SECTION_LABELS[activeSection]} (comma-separated or one per line)
                    </label>
                    <textarea
                      rows={5}
                      value={content[activeSection].join(', ')}
                      onChange={(e) =>
                        pushContent({
                          ...content,
                          [activeSection]: e.target.value
                            .split(/[,\n]/)
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="TypeScript, React, Node.js, PostgreSQL..."
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {/* CERTIFICATIONS */}
                {activeSection === 'certifications' && (
                  <div className="space-y-3">
                    {content.certifications.map((c) => (
                      <div key={c.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 border border-slate-200 rounded-lg">
                        <input
                          placeholder="Certificate Name"
                          value={c.name}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              certifications: content.certifications.map((x) =>
                                x.id === c.id ? { ...x, name: e.target.value } : x
                              ),
                            })
                          }
                          className="px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                        />
                        <input
                          placeholder="Issuer"
                          value={c.issuer}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              certifications: content.certifications.map((x) =>
                                x.id === c.id ? { ...x, issuer: e.target.value } : x
                              ),
                            })
                          }
                          className="px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                        />
                        <div className="flex gap-2">
                          <input
                            placeholder="Year"
                            value={c.date}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                certifications: content.certifications.map((x) =>
                                  x.id === c.id ? { ...x, date: e.target.value } : x
                                ),
                              })
                            }
                            className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                          />
                          <button
                            onClick={() =>
                              pushContent({
                                ...content,
                                certifications: content.certifications.filter((x) => x.id !== c.id),
                              })
                            }
                            className="text-xs text-red-600 px-2"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        pushContent({
                          ...content,
                          certifications: [
                            ...content.certifications,
                            { id: uid(), name: '', issuer: '', date: '', credentialUrl: '' },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Certification
                    </button>
                  </div>
                )}

                {/* ACHIEVEMENTS / AWARDS / RESPONSIBILITIES */}
                {(activeSection === 'achievements' ||
                  activeSection === 'awards' ||
                  activeSection === 'responsibilities') && (
                  <div className="space-y-3">
                    {content[activeSection].map((a) => (
                      <div key={a.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 border border-slate-200 rounded-lg">
                        <input
                          placeholder="Title"
                          value={a.title}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              [activeSection]: content[activeSection].map((x) =>
                                x.id === a.id ? { ...x, title: e.target.value } : x
                              ),
                            })
                          }
                          className="px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                        />
                        <input
                          placeholder="Context / Impact"
                          value={a.context}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              [activeSection]: content[activeSection].map((x) =>
                                x.id === a.id ? { ...x, context: e.target.value } : x
                              ),
                            })
                          }
                          className="px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                        />
                        <div className="flex gap-2">
                          <input
                            placeholder="Year"
                            value={a.date}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                [activeSection]: content[activeSection].map((x) =>
                                  x.id === a.id ? { ...x, date: e.target.value } : x
                                ),
                              })
                            }
                            className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                          />
                          <button
                            onClick={() =>
                              pushContent({
                                ...content,
                                [activeSection]: content[activeSection].filter((x) => x.id !== a.id),
                              })
                            }
                            className="text-xs text-red-600 px-2"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        pushContent({
                          ...content,
                          [activeSection]: [...content[activeSection], { id: uid(), title: '', context: '', date: '' }],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Entry
                    </button>
                  </div>
                )}

                {/* LANGUAGES */}
                {activeSection === 'languages' && (
                  <div className="space-y-3">
                    {content.languages.map((l) => (
                      <div key={l.id} className="flex gap-2">
                        <input
                          placeholder="Language"
                          value={l.language}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              languages: content.languages.map((x) =>
                                x.id === l.id ? { ...x, language: e.target.value } : x
                              ),
                            })
                          }
                          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                        <input
                          placeholder="Proficiency (e.g. Fluent, Native)"
                          value={l.proficiency}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              languages: content.languages.map((x) =>
                                x.id === l.id ? { ...x, proficiency: e.target.value } : x
                              ),
                            })
                          }
                          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                        <button
                          onClick={() =>
                            pushContent({
                              ...content,
                              languages: content.languages.filter((x) => x.id !== l.id),
                            })
                          }
                          className="px-3 text-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        pushContent({
                          ...content,
                          languages: [...content.languages, { id: uid(), language: '', proficiency: '' }],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Language
                    </button>
                  </div>
                )}

                {/* PUBLICATIONS */}
                {activeSection === 'publications' && (
                  <div className="space-y-3">
                    {content.publications.map((pub) => (
                      <div key={pub.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 border border-slate-200 rounded-lg">
                        <input
                          placeholder="Paper / Article Title"
                          value={pub.title}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              publications: content.publications.map((x) =>
                                x.id === pub.id ? { ...x, title: e.target.value } : x
                              ),
                            })
                          }
                          className="px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                        />
                        <input
                          placeholder="Journal / Conference"
                          value={pub.venue}
                          onChange={(e) =>
                            pushContent({
                              ...content,
                              publications: content.publications.map((x) =>
                                x.id === pub.id ? { ...x, venue: e.target.value } : x
                              ),
                            })
                          }
                          className="px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                        />
                        <div className="flex gap-2">
                          <input
                            placeholder="Year"
                            value={pub.date}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                publications: content.publications.map((x) =>
                                  x.id === pub.id ? { ...x, date: e.target.value } : x
                                ),
                              })
                            }
                            className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded"
                          />
                          <button
                            onClick={() =>
                              pushContent({
                                ...content,
                                publications: content.publications.filter((x) => x.id !== pub.id),
                              })
                            }
                            className="text-red-600 px-2"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        pushContent({
                          ...content,
                          publications: [
                            ...content.publications,
                            { id: uid(), title: '', venue: '', date: '', url: '' },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Publication
                    </button>
                  </div>
                )}

                {/* CUSTOM SECTIONS */}
                {activeSection === 'custom' && (
                  <div className="space-y-4">
                    {content.customSections.map((sec) => (
                      <div key={sec.id} className="p-4 border border-slate-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            value={sec.title}
                            onChange={(e) =>
                              pushContent({
                                ...content,
                                customSections: content.customSections.map((x) =>
                                  x.id === sec.id ? { ...x, title: e.target.value } : x
                                ),
                              })
                            }
                            placeholder="Custom Section Heading"
                            className="font-semibold text-sm px-2.5 py-1.5 border border-slate-300 rounded"
                          />
                          <button
                            onClick={() =>
                              pushContent({
                                ...content,
                                customSections: content.customSections.filter((x) => x.id !== sec.id),
                              })
                            }
                            className="text-xs text-red-600"
                          >
                            Delete Section
                          </button>
                        </div>
                        {sec.items.map((item) => (
                          <div key={item.id} className="space-y-2 p-2.5 bg-slate-50 rounded-lg">
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                placeholder="Title"
                                value={item.heading}
                                onChange={(e) =>
                                  pushContent({
                                    ...content,
                                    customSections: content.customSections.map((x) =>
                                      x.id === sec.id
                                        ? {
                                            ...x,
                                            items: x.items.map((it) =>
                                              it.id === item.id ? { ...it, heading: e.target.value } : it
                                            ),
                                          }
                                        : x
                                    ),
                                  })
                                }
                                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                              />
                              <input
                                placeholder="Subtitle"
                                value={item.subheading}
                                onChange={(e) =>
                                  pushContent({
                                    ...content,
                                    customSections: content.customSections.map((x) =>
                                      x.id === sec.id
                                        ? {
                                            ...x,
                                            items: x.items.map((it) =>
                                              it.id === item.id ? { ...it, subheading: e.target.value } : it
                                            ),
                                          }
                                        : x
                                    ),
                                  })
                                }
                                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                              />
                              <input
                                placeholder="Date"
                                value={item.date}
                                onChange={(e) =>
                                  pushContent({
                                    ...content,
                                    customSections: content.customSections.map((x) =>
                                      x.id === sec.id
                                        ? {
                                            ...x,
                                            items: x.items.map((it) =>
                                              it.id === item.id ? { ...it, date: e.target.value } : it
                                            ),
                                          }
                                        : x
                                    ),
                                  })
                                }
                                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                              />
                            </div>
                            <textarea
                              rows={2}
                              placeholder="Details"
                              value={item.description}
                              onChange={(e) =>
                                pushContent({
                                  ...content,
                                  customSections: content.customSections.map((x) =>
                                    x.id === sec.id
                                      ? {
                                          ...x,
                                          items: x.items.map((it) =>
                                            it.id === item.id ? { ...it, description: e.target.value } : it
                                          ),
                                        }
                                      : x
                                  ),
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            pushContent({
                              ...content,
                              customSections: content.customSections.map((x) =>
                                x.id === sec.id
                                  ? {
                                      ...x,
                                      items: [
                                        ...x.items,
                                        { id: uid(), heading: '', subheading: '', date: '', description: '' },
                                      ],
                                    }
                                  : x
                              ),
                            })
                          }
                          className="text-xs font-medium text-iris-600"
                        >
                          + Add Item
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        pushContent({
                          ...content,
                          customSections: [
                            ...content.customSections,
                            {
                              id: uid(),
                              title: 'Workshops & Hackathons',
                              items: [{ id: uid(), heading: '', subheading: '', date: '', description: '' }],
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create Custom Section
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TEMPLATES TAB */}
            {leftTab === 'templates' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RESUME_TEMPLATES.filter((t) => !disabledTemplateIds.includes(t.id)).map((tpl) => {
                  const locked = tpl.isPremium && !isPremium;
                  const active = templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        if (locked) {
                          onRequireUpgrade(`"${tpl.name}" is a Premium template.`);
                          return;
                        }
                        setTemplateId(tpl.id);
                        updateDesign('accentColor', tpl.defaultAccent);
                      }}
                      className={`text-left p-4 rounded-xl border transition-colors ${
                        active
                          ? 'border-iris-600 bg-iris-50/60'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{tpl.name}</span>
                        <span className="text-xs font-medium text-slate-500">
                          {tpl.isPremium ? (isPremium ? 'Included' : 'Premium') : 'Free'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {tpl.category} · {tpl.layout}
                      </div>
                      <p className="text-xs text-slate-600 mt-2">{tpl.description}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* DESIGN & TYPOGRAPHY TAB */}
            {leftTab === 'design' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Font Family</label>
                    <select
                      value={content.design.fontFamily}
                      onChange={(e) =>
                        updateDesign('fontFamily', e.target.value as ResumeDesignSettings['fontFamily'])
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="plus-jakarta">Plus Jakarta Sans</option>
                      <option value="dm-sans">DM Sans</option>
                      <option value="source-serif">Source Serif 4</option>
                      <option value="playfair">Playfair Display</option>
                      <option value="lora">Lora</option>
                      <option value="jetbrains-mono">JetBrains Mono</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Accent Color</label>
                    <div className="flex items-center gap-2">
                      {['#1e293b', '#3730a3', '#1d4ed8', '#0f766e', '#6d28d9', '#be185d'].map((hex) => (
                        <button
                          key={hex}
                          onClick={() => updateDesign('accentColor', hex)}
                          className={`w-7 h-7 rounded-full border-2 ${
                            content.design.accentColor === hex ? 'border-slate-900 scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: hex }}
                          aria-label={`Select color ${hex}`}
                        />
                      ))}
                      <input
                        type="color"
                        value={content.design.accentColor}
                        onChange={(e) => updateDesign('accentColor', e.target.value)}
                        className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Font Size ({content.design.fontSize}pt)
                    </label>
                    <input
                      type="range"
                      min={9}
                      max={11.5}
                      step={0.5}
                      value={content.design.fontSize}
                      onChange={(e) => updateDesign('fontSize', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Line Spacing ({content.design.lineHeight})
                    </label>
                    <input
                      type="range"
                      min={1.2}
                      max={1.65}
                      step={0.05}
                      value={content.design.lineHeight}
                      onChange={(e) => updateDesign('lineHeight', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Section Spacing ({content.design.sectionSpacing}px)
                    </label>
                    <input
                      type="range"
                      min={8}
                      max={24}
                      step={1}
                      value={content.design.sectionSpacing}
                      onChange={(e) => updateDesign('sectionSpacing', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Page Margins ({content.design.marginMm}mm)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={22}
                      step={1}
                      value={content.design.marginMm}
                      onChange={(e) => updateDesign('marginMm', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Bullet Style</label>
                    <select
                      value={content.design.bulletStyle}
                      onChange={(e) =>
                        updateDesign('bulletStyle', e.target.value as ResumeDesignSettings['bulletStyle'])
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="disc">Round Disc (•)</option>
                      <option value="square">Square (▪)</option>
                      <option value="dash">En-Dash (–)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Date Format</label>
                    <select
                      value={content.design.dateFormat}
                      onChange={(e) =>
                        updateDesign('dateFormat', e.target.value as ResumeDesignSettings['dateFormat'])
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="MMM YYYY">MMM YYYY (e.g. Jul 2024)</option>
                      <option value="MM/YYYY">MM/YYYY (e.g. 07/2024)</option>
                      <option value="YYYY">YYYY (e.g. 2024)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* VERSION HISTORY TAB */}
            {leftTab === 'versions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600">
                    Snapshots preserve your master resume before customizing for specific roles.
                  </p>
                  <button
                    onClick={() => void persistSave(true, `Manual Snapshot (${new Date().toLocaleTimeString()})`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-iris-600 text-white text-xs font-medium"
                  >
                    <History className="w-3.5 h-3.5" /> Create Snapshot
                  </button>
                </div>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {versions.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500">No snapshots recorded yet.</div>
                  ) : (
                    versions.map((v) => (
                      <div key={v.id} className="p-3.5 bg-white flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            v{v.versionNumber} · {v.label}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {new Date(v.createdAt).toLocaleString()} · Template: {v.templateId}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const res = await apiRequest<{ resume: ResumeRecord }>(
                              `/api/resumes/${resume.id}/versions/${v.id}/restore`,
                              { method: 'POST' }
                            );
                            setContent(res.resume.content);
                            setTemplateId(res.resume.templateId);
                            onUpdated(res.resume);
                          }}
                          className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50"
                        >
                          Restore
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Real-time A4 Preview */}
        <div className="w-full lg:w-[50%] bg-slate-200/70 flex flex-col overflow-hidden">
          <div className="bg-white/90 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <span className="font-medium text-slate-800">Live A4 Preview · {templateId}</span>
            <div className="flex items-center gap-1.5">
              {[0.55, 0.7, 0.85, 1].map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`px-2 py-1 rounded text-xs font-mono-tabular ${
                    zoom === z ? 'bg-iris-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto subtle-scroll p-6">
            <ResumeRenderer
              id="resume-print-surface"
              content={content}
              templateId={templateId}
              scale={zoom}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
