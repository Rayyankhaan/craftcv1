import React, { useEffect, useState } from 'react';
import { Download, Plus, Trash2, Wand2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { exportCoverLetterToDocx, exportCoverLetterToPdf } from '../../lib/exportResume';
import type { CoverLetterRecord, ResumeRecord } from '../../types/resume';

interface CoverLetterViewProps {
  resumes: ResumeRecord[];
}

export const CoverLetterView: React.FC<CoverLetterViewProps> = ({ resumes }) => {
  const [letters, setLetters] = useState<CoverLetterRecord[]>([]);
  const [active, setActive] = useState<CoverLetterRecord | null>(null);
  const [resumeId, setResumeId] = useState(resumes[0]?.id || '');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [hiringManager, setHiringManager] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tone, setTone] = useState<'professional' | 'enthusiastic' | 'executive' | 'fresher'>('professional');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLetters = async () => {
    const res = await apiRequest<{ coverLetters: CoverLetterRecord[] }>('/api/ai/cover-letters');
    setLetters(res.coverLetters);
    if (!active && res.coverLetters[0]) setActive(res.coverLetters[0]);
  };

  useEffect(() => {
    void loadLetters();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const res = await apiRequest<{ coverLetter: CoverLetterRecord }>('/api/ai/cover-letter', {
        method: 'POST',
        body: JSON.stringify({
          resumeId: resumeId || null,
          jobTitle,
          companyName,
          hiringManager,
          jobDescription,
          tone,
        }),
      });
      setLetters((prev) => [res.coverLetter, ...prev]);
      setActive(res.coverLetter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover letter generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!active) return;
    await apiRequest(`/api/ai/cover-letters/${active.id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: active.content }),
    });
    setLetters((prev) => prev.map((l) => (l.id === active.id ? active : l)));
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/api/ai/cover-letters/${id}`, { method: 'DELETE' });
    const remaining = letters.filter((l) => l.id !== id);
    setLetters(remaining);
    if (active?.id === id) setActive(remaining[0] || null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Cover Letter Generator</h1>
        <p className="text-sm text-slate-600 mt-1">
          Generate, edit, and export PDF or DOCX cover letters grounded in your resume and the target role.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 h-fit"
        >
          <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-iris-600" /> New Cover Letter
          </div>
          <select
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">No resume attached</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Target Job Title *"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            required
            placeholder="Company Name *"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            placeholder="Hiring Manager (Optional)"
            value={hiringManager}
            onChange={(e) => setHiringManager(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as typeof tone)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="professional">Professional Tone</option>
            <option value="fresher">Fresher / Graduate Tone</option>
            <option value="enthusiastic">Enthusiastic Tone</option>
            <option value="executive">Executive Tone</option>
          </select>
          <textarea
            rows={4}
            placeholder="Paste job description (Optional)"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          {error && <div className="text-xs text-red-700">{error}</div>}
          <button
            type="submit"
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60"
          >
            <Wand2 className="w-4 h-4" />
            {generating ? 'Drafting Letter...' : 'Generate Cover Letter'}
          </button>

          {letters.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-600">Saved Letters ({letters.length})</div>
              {letters.map((l) => (
                <div
                  key={l.id}
                  onClick={() => setActive(l)}
                  className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between text-xs ${
                    active?.id === l.id ? 'border-iris-600 bg-iris-50/60' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="truncate">
                    <div className="font-medium text-slate-900 truncate">{l.jobTitle}</div>
                    <div className="text-slate-500">{l.companyName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      void handleDelete(l.id);
                    }}
                    className="text-slate-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {active.jobTitle} — {active.companyName}
                  </h2>
                  <p className="text-xs text-slate-500 capitalize">Tone: {active.tone}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleSaveEdit()}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => exportCoverLetterToPdf(`${active.companyName}_Cover_Letter`, active.content)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-iris-600 text-white text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button
                    onClick={() => void exportCoverLetterToDocx(`${active.companyName}_Cover_Letter`, active.content)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" /> DOCX
                  </button>
                </div>
              </div>
              <textarea
                rows={18}
                value={active.content}
                onChange={(e) => setActive({ ...active, content: e.target.value })}
                className="w-full px-3.5 py-3 text-sm leading-relaxed border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
              />
            </>
          ) : (
            <div className="py-20 text-center text-sm text-slate-500">
              Generate a cover letter on the left or select a saved letter to edit and export.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
