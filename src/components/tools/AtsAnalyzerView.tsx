import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, SearchCheck } from 'lucide-react';
import { apiRequest, ApiError } from '../../lib/api';
import type { AtsAnalysisResult, ResumeRecord } from '../../types/resume';

interface AtsAnalyzerViewProps {
  resumes: ResumeRecord[];
  onRequireUpgrade: (reason: string) => void;
}

export const AtsAnalyzerView: React.FC<AtsAnalyzerViewProps> = ({ resumes, onRequireUpgrade }) => {
  const [selectedResumeId, setSelectedResumeId] = useState<string>(resumes[0]?.id || '');
  const [jobDescription, setJobDescription] = useState('');
  const [isFresher, setIsFresher] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<AtsAnalysisResult | null>(null);
  const [history, setHistory] = useState<AtsAnalysisResult[]>([]);

  useEffect(() => {
    if (!selectedResumeId && resumes[0]?.id) {
      setSelectedResumeId(resumes[0].id);
    }
  }, [resumes, selectedResumeId]);

  useEffect(() => {
    void apiRequest<{ analyses: AtsAnalysisResult[] }>('/api/ai/ats-history')
      .then((res) => setHistory(res.analyses))
      .catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    const resume = resumes.find((r) => r.id === selectedResumeId);
    if (!resume) {
      setError('Create or select a resume first to run an ATS check.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ analysis: AtsAnalysisResult }>('/api/ai/ats-analyze', {
        method: 'POST',
        body: JSON.stringify({
          resumeId: resume.id,
          resumeContent: resume.content,
          jobDescription,
          isFresher: isFresher || resume.builderType === 'fresher',
        }),
      });
      setCurrent(res.analysis);
      setHistory((prev) => [res.analysis, ...prev]);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        onRequireUpgrade(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'ATS analysis failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const previousForSame = current
    ? history.find((h) => h.id !== current.id && h.resumeId === current.resumeId)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">ATS Resume Analyzer</h1>
        <p className="text-sm text-slate-600 mt-1">
          Transparent structural and keyword diagnostics. General resume quality is scored separately from employer-specific job matching. No tool can guarantee passing every proprietary ATS.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Select Saved Resume</label>
            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {resumes.length === 0 ? (
                <option value="">No resumes saved yet</option>
              ) : (
                resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.builderType})
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isFresher}
                onChange={(e) => setIsFresher(e.target.checked)}
              />
              <span>Evaluate with Fresher criteria (do not penalize zero full-time work history)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Target Job Description (Optional — enables employer-specific match score)
          </label>
          <textarea
            rows={4}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste target job description to evaluate keyword alignment..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <button
          disabled={loading || resumes.length === 0}
          onClick={() => void handleAnalyze()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-50"
        >
          <SearchCheck className="w-4 h-4" />
          {loading ? 'Analyzing Resume...' : 'Run ATS Diagnostic'}
        </button>
      </div>

      {current && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">General Resume Quality</div>
              <div className="text-3xl font-bold text-slate-900 font-mono-tabular mt-1">
                {current.overallScore} <span className="text-sm font-normal text-slate-500">/ 100</span>
              </div>
              {previousForSame && (
                <div className="text-xs text-slate-600 mt-1 tabular-nums">
                  Before: {previousForSame.overallScore}/100 → Now: {current.overallScore}/100 (
                  {current.overallScore - previousForSame.overallScore >= 0 ? '+' : ''}
                  {current.overallScore - previousForSame.overallScore})
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500">Employer JD Match Score</div>
              <div className="text-3xl font-bold text-iris-600 font-mono-tabular mt-1">
                {current.jobMatchScore !== null ? `${current.jobMatchScore}%` : 'N/A'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {current.jobMatchScore !== null ? 'Based on pasted JD' : 'Paste a JD above for match score'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Evaluation Mode</div>
              <div className="text-sm font-semibold text-slate-900 mt-2 capitalize">
                {current.analysisType.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {current.categories.map((cat) => (
              <div key={cat.name} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between text-sm font-medium text-slate-900">
                  <span>{cat.name}</span>
                  <span className="font-mono-tabular">
                    {cat.score}/{cat.maxScore}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-iris-600 rounded-full"
                    style={{ width: `${Math.round((cat.score / cat.maxScore) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 mt-1.5">{cat.notes}</p>
              </div>
            ))}
          </div>

          {/* Strengths / Weaknesses / Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Strengths
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                {current.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Weaknesses & Parsing Risks
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                {[...current.weaknesses, ...current.parsingRisks].map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Actionable Recommendations</h3>
            <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
              {current.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Recent ATS Analyses</h2>
          <div className="divide-y divide-slate-200 text-xs">
            {history.slice(0, 6).map((h, i) => (
              <div key={h.id || i} className="py-2.5 flex items-center justify-between">
                <span className="text-slate-700 capitalize">{h.analysisType.replace('_', ' ')} check</span>
                <span className="font-mono-tabular font-semibold text-slate-900">{h.overallScore}/100</span>
                <span className="text-slate-500 tabular-nums">
                  {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
