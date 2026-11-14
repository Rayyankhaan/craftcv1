import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, Trash2, Wand2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import type { JobApplicationRecord, ResumeRecord } from '../../types/resume';

interface CareerToolsViewProps {
  resumes: ResumeRecord[];
  initialTab?: 'tracker' | 'linkedin' | 'interview';
}

const STATUSES: JobApplicationRecord['status'][] = [
  'Interested',
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Rejected',
];

export const CareerToolsView: React.FC<CareerToolsViewProps> = ({ resumes, initialTab = 'tracker' }) => {
  const [tab, setTab] = useState<'tracker' | 'linkedin' | 'interview'>(initialTab);

  // Job Tracker State
  const [apps, setApps] = useState<JobApplicationRecord[]>([]);
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [status, setStatus] = useState<JobApplicationRecord['status']>('Applied');
  const [notes, setNotes] = useState('');
  const [resumeVersionLabel, setResumeVersionLabel] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Career AI Tools State
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id || '');
  const [tool, setTool] = useState<
    | 'linkedin_headline'
    | 'linkedin_about'
    | 'linkedin_experience'
    | 'career_objective'
    | 'skills_gap'
    | 'professional_email'
    | 'interview_hr'
    | 'interview_technical'
    | 'star_answer'
    | 'mock_interview'
  >('linkedin_headline');
  const [targetRole, setTargetRole] = useState('');
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [toolBusy, setToolBusy] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);

  useEffect(() => {
    void apiRequest<{ applications: JobApplicationRecord[] }>('/api/jobs')
      .then((res) => setApps(res.applications))
      .catch(() => {});
  }, []);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest<{ application: JobApplicationRecord }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({
        company,
        position,
        jobUrl,
        status,
        notes,
        resumeVersionLabel,
        interviewDate,
      }),
    });
    setApps((prev) => [res.application, ...prev]);
    setCompany('');
    setPosition('');
    setJobUrl('');
    setNotes('');
  };

  const handleStatusChange = async (id: string, nextStatus: JobApplicationRecord['status']) => {
    await apiRequest(`/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus }),
    });
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: nextStatus } : a)));
  };

  const handleDeleteJob = async (id: string) => {
    await apiRequest(`/api/jobs/${id}`, { method: 'DELETE' });
    setApps((prev) => prev.filter((a) => a.id !== id));
  };

  const handleRunCareerTool = async () => {
    setToolBusy(true);
    setToolError(null);
    try {
      const res = await apiRequest<{ output: string }>('/api/ai/career-tool', {
        method: 'POST',
        body: JSON.stringify({
          tool,
          targetRole,
          resumeId: selectedResumeId || null,
          input: toolInput,
        }),
      });
      setToolOutput(res.output);
    } catch (err) {
      setToolError(err instanceof Error ? err.message : 'Career tool request failed.');
    } finally {
      setToolBusy(false);
    }
  };

  const filteredApps = apps.filter((a) => (statusFilter === 'All' ? true : a.status === statusFilter));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Career Tools & Application Tracker</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage active applications, optimize your LinkedIn profile, and prepare for HR and technical interviews.
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {[
            { id: 'tracker', label: 'Job Tracker' },
            { id: 'linkedin', label: 'LinkedIn & Outreach' },
            { id: 'interview', label: 'Interview Prep & STAR' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id as typeof tab);
                if (t.id === 'linkedin') setTool('linkedin_headline');
                if (t.id === 'interview') setTool('interview_hr');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tracker' ? (
        <div className="space-y-6">
          <form onSubmit={handleAddJob} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-iris-600" /> Log Job Application
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                required
                placeholder="Company *"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                required
                placeholder="Position *"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JobApplicationRecord['status'])}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                placeholder="Job Posting URL"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                placeholder="Resume Version Used"
                value={resumeVersionLabel}
                onChange={(e) => setResumeVersionLabel(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <input
                type="date"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex gap-3">
              <input
                placeholder="Notes (recruiter name, referral, assessment details)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> Add Application
              </button>
            </div>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Tracked Applications ({filteredApps.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {['All', ...STATUSES].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${
                      statusFilter === s ? 'bg-iris-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {filteredApps.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No job applications logged in this view yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Company & Role</th>
                      <th className="py-2.5 px-4 font-medium">Resume Version</th>
                      <th className="py-2.5 px-4 font-medium">Date</th>
                      <th className="py-2.5 px-4 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium">Notes</th>
                      <th className="py-2.5 px-4 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredApps.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{app.company}</div>
                          <div className="text-slate-600">{app.position}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{app.resumeVersionLabel || '—'}</td>
                        <td className="py-3 px-4 text-slate-600 tabular-nums">{app.applicationDate}</td>
                        <td className="py-3 px-4">
                          <select
                            value={app.status}
                            onChange={(e) =>
                              void handleStatusChange(app.id, e.target.value as JobApplicationRecord['status'])
                            }
                            className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{app.notes || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => void handleDeleteJob(app.id)}
                            className="text-slate-400 hover:text-red-600 p-1"
                            aria-label="Delete application"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Select Tool</label>
              <select
                value={tool}
                onChange={(e) => setTool(e.target.value as typeof tool)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {tab === 'linkedin' ? (
                  <>
                    <option value="linkedin_headline">LinkedIn Headline Generator</option>
                    <option value="linkedin_about">LinkedIn About Section Generator</option>
                    <option value="linkedin_experience">LinkedIn Experience Optimizer</option>
                    <option value="career_objective">Career Objective Generator</option>
                    <option value="skills_gap">Skills Gap Analyzer</option>
                    <option value="professional_email">Professional Outreach / Follow-up Email</option>
                  </>
                ) : (
                  <>
                    <option value="interview_hr">HR Interview Questions & Guidance</option>
                    <option value="interview_technical">Technical Interview Preparation</option>
                    <option value="star_answer">STAR Method Answer Builder</option>
                    <option value="mock_interview">Mock Interview Practice Feedback</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Resume Context</label>
              <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">None</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
            <input
              placeholder="Target Role (e.g. Backend Engineer)"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <textarea
              rows={5}
              placeholder="Provide context, interview question, or draft text..."
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            {toolError && <div className="text-xs text-red-700">{toolError}</div>}
            <button
              disabled={toolBusy}
              onClick={() => void handleRunCareerTool()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60"
            >
              <Wand2 className="w-4 h-4" />
              {toolBusy ? 'Generating...' : 'Run Career Tool'}
            </button>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Output</h2>
            {toolOutput ? (
              <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{toolOutput}</div>
            ) : (
              <div className="py-16 text-center text-sm text-slate-500">
                Choose a tool on the left and click Run Career Tool to generate tailored guidance.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
