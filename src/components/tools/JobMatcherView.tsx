import React, { useEffect, useState } from 'react';
import { GitCompare, Wand2 } from 'lucide-react';
import { apiRequest, ApiError } from '../../lib/api';
import type { JobMatchResult, ResumeRecord } from '../../types/resume';

interface JobMatcherViewProps {
  resumes: ResumeRecord[];
  onOpenResume: (resumeId: string) => void;
  onRefreshResumes: () => void;
  onRequireUpgrade: (reason: string) => void;
}

export const JobMatcherView: React.FC<JobMatcherViewProps> = ({
  resumes,
  onOpenResume,
  onRefreshResumes,
  onRequireUpgrade,
}) => {
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id || '');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobMatchResult | null>(null);
  const [tailoredId, setTailoredId] = useState<string | null>(null);
  const [history, setHistory] = useState<JobMatchResult[]>([]);

  useEffect(() => {
    if (!selectedResumeId && resumes[0]?.id) setSelectedResumeId(resumes[0].id);
  }, [resumes, selectedResumeId]);

  useEffect(() => {
    void apiRequest<{ matches: JobMatchResult[] }>('/api/ai/job-matches')
      .then((r) => setHistory(r.matches))
      .catch(() => {});
  }, []);

  const runMatch = async (tailorResume: boolean) => {
    if (!selectedResumeId) {
      setError('Select a resume first.');
      return;
    }
    setLoading(true);
    setError(null);
    setTailoredId(null);
    try {
      const res = await apiRequest<{ match: JobMatchResult; tailoredResumeId: string | null }>(
        '/api/ai/job-match',
        {
          method: 'POST',
          body: JSON.stringify({
            resumeId: selectedResumeId,
            jobTitle,
            companyName,
            jobDescription,
            tailorResume,
          }),
        }
      );
      setResult(res.match);
      setHistory((prev) => [res.match, ...prev]);
      if (res.tailoredResumeId) {
        setTailoredId(res.tailoredResumeId);
        onRefreshResumes();
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        onRequireUpgrade(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Job match failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Job Description Matcher</h1>
        <p className="text-sm text-slate-600 mt-1">
          Extract required skills and keywords from any job post, identify gaps, and optionally create a tailored copy without altering your master resume.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Resume to Compare</label>
            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Job Title (Optional)</label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Frontend Engineer"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Company (Optional)</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Razorpay"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <textarea
          rows={6}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here..."
          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
        />

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            disabled={loading || resumes.length === 0}
            onClick={() => void runMatch(false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-50"
          >
            <GitCompare className="w-4 h-4" />
            {loading ? 'Comparing...' : 'Analyze Job Match'}
          </button>
          <button
            disabled={loading || resumes.length === 0}
            onClick={() => void runMatch(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-iris-600 text-iris-600 text-sm font-medium hover:bg-iris-50 disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            Save Tailored Resume Copy (Premium)
          </button>
        </div>
      </div>

      {tailoredId && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
          <span className="text-sm text-emerald-900 font-medium">
            Created a separate tailored version while keeping your master resume untouched.
          </span>
          <button
            onClick={() => onOpenResume(tailoredId)}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium"
          >
            Open Tailored Resume
          </button>
        </div>
      )}

      {result && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex items-baseline justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {result.jobTitle} {result.companyName ? `at ${result.companyName}` : ''}
              </h2>
              <p className="text-xs text-slate-500">Keyword & Qualification Alignment</p>
            </div>
            <div className="text-3xl font-bold text-iris-600 font-mono-tabular">{result.matchScore}%</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Matching Keywords</h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                {result.matchingKeywords.join(' · ') || 'None detected'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Missing Keywords & Skill Gaps</h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                {[...result.missingKeywords, ...result.skillGaps].join(' · ') || 'None'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Tailoring Recommendations</h3>
            <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
              {result.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Saved Job Matches</h2>
          <div className="divide-y divide-slate-200 text-xs">
            {history.slice(0, 6).map((m, i) => (
              <div key={m.id || i} className="py-2.5 flex items-center justify-between">
                <span className="font-medium text-slate-800">
                  {m.jobTitle} {m.companyName ? `· ${m.companyName}` : ''}
                </span>
                <span className="font-mono-tabular font-semibold text-iris-600">{m.matchScore}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
