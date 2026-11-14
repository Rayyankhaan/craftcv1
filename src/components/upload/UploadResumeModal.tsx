import React, { useEffect, useState } from 'react';
import { Upload, Wand2 } from 'lucide-react';
import { apiRequest, ApiError } from '../../lib/api';
import { createEmptyResumeContent, type ResumeContent, type ResumeRecord } from '../../types/resume';
import { PopupModal } from '../ui/PopupModal';

interface UploadResumeModalProps {
  isOpen: boolean;
  initialMode: 'upload' | 'ai_draft';
  onClose: () => void;
  onCreated: (resume: ResumeRecord) => void;
  onRequireUpgrade: (reason: string) => void;
}

export const UploadResumeModal: React.FC<UploadResumeModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onCreated,
  onRequireUpgrade,
}) => {
  const [mode, setMode] = useState<'upload' | 'ai_draft'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewContent, setReviewContent] = useState<ResumeContent | null>(null);
  const [resumeTitle, setResumeTitle] = useState('Imported Resume');

  // AI Draft fields
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [careerStage, setCareerStage] = useState('Experienced');
  const [educationSummary, setEducationSummary] = useState('');
  const [experienceOrProjects, setExperienceOrProjects] = useState('');
  const [skillsInput, setSkillsInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [isOpen, initialMode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiRequest<{ extracted: Partial<ResumeContent>; notice?: string }>(
        '/api/upload/parse-resume',
        { method: 'POST', body: fd }
      );
      const base = createEmptyResumeContent('standard');
      const ex = res.extracted;
      const merged: ResumeContent = {
        ...base,
        personal: { ...base.personal, ...(ex.personal || {}) },
        summary: ex.summary || '',
        technicalSkills: ex.technicalSkills || [],
        softSkills: ex.softSkills || [],
        experience: (ex.experience || []).map((item, idx) => ({
          id: `exp-${idx}`,
          company: item.company || '',
          role: item.role || '',
          location: item.location || '',
          startDate: item.startDate || '',
          endDate: item.endDate || '',
          current: false,
          bullets: item.bullets || [],
        })),
        education: (ex.education || []).map((item, idx) => ({
          id: `edu-${idx}`,
          institution: item.institution || '',
          degree: item.degree || '',
          specialization: item.specialization || '',
          location: '',
          startDate: item.startDate || '',
          endDate: item.endDate || '',
          score: item.score || '',
        })),
        projects: (ex.projects || []).map((item, idx) => ({
          id: `proj-${idx}`,
          title: item.title || '',
          domain: '',
          technologies: item.technologies || [],
          link: '',
          startDate: '',
          endDate: '',
          description: item.description || '',
          bullets: item.bullets || [],
        })),
      };
      setResumeTitle(merged.personal.fullName ? `${merged.personal.fullName} Resume` : file.name.replace(/\.\w+$/, ''));
      setReviewContent(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse resume file.');
    } finally {
      setLoading(false);
    }
  };

  const handleAiDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ draft: Partial<ResumeContent> }>('/api/ai/draft-resume', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          targetRole,
          careerStage,
          educationSummary,
          experienceOrProjects,
          skillsInput,
        }),
      });
      const base = createEmptyResumeContent(careerStage === 'Fresher' ? 'fresher' : 'standard');
      base.personal.fullName = fullName;
      base.personal.targetRole = targetRole;
      base.summary = res.draft.summary || '';
      base.objective = res.draft.objective || '';
      base.technicalSkills = res.draft.technicalSkills || [];
      base.softSkills = res.draft.softSkills || [];
      base.experience = (res.draft.experience || []).map((it, i) => ({
        id: `e-${i}`,
        company: it.company || '',
        role: it.role || '',
        location: '',
        startDate: it.startDate || '',
        endDate: it.endDate || '',
        current: false,
        bullets: it.bullets || [],
      }));
      base.projects = (res.draft.projects || []).map((it, i) => ({
        id: `p-${i}`,
        title: it.title || '',
        domain: '',
        technologies: it.technologies || [],
        link: '',
        startDate: '',
        endDate: '',
        description: it.description || '',
        bullets: it.bullets || [],
      }));
      base.education = (res.draft.education || []).map((it, i) => ({
        id: `ed-${i}`,
        institution: it.institution || '',
        degree: it.degree || '',
        specialization: it.specialization || '',
        location: '',
        startDate: '',
        endDate: it.endDate || '',
        score: '',
      }));
      setResumeTitle(`${fullName} — ${targetRole}`);
      setReviewContent(base);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        onRequireUpgrade(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'AI draft failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReviewed = async () => {
    if (!reviewContent) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ resume: ResumeRecord }>('/api/resumes', {
        method: 'POST',
        body: JSON.stringify({
          title: resumeTitle.trim() || 'My Resume',
          targetRole: reviewContent.personal.targetRole,
          builderType: 'standard',
          templateId: 'ats-classic',
          content: reviewContent,
        }),
      });
      onCreated(res.resume);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        onRequireUpgrade(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Could not save resume.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      title={reviewContent ? 'Review Extracted Resume Details' : 'Import or Generate Resume'}
      subtitle="Extracts only your real document facts for editing in our split-screen workspace"
      maxWidthClass="max-w-2xl"
      bodyClassName="p-6 space-y-5"
    >
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {!reviewContent ? (
            <>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setMode('upload')}
                  className={`py-2 text-xs font-medium rounded-md ${
                    mode === 'upload' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Upload PDF / DOCX
                </button>
                <button
                  onClick={() => setMode('ai_draft')}
                  className={`py-2 text-xs font-medium rounded-md ${
                    mode === 'ai_draft' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  AI-Assisted Questionnaire
                </button>
              </div>

              {mode === 'upload' ? (
                <label className="block border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-iris-500 transition-colors">
                  <Upload className="w-6 h-6 text-iris-600 mx-auto mb-3" />
                  <div className="text-sm font-medium text-slate-900">
                    {loading ? 'Extracting resume sections...' : 'Click to choose a PDF or DOCX file (max 5 MB)'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    We extract only what is in your document and let you review every field before saving.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
              ) : (
                <form onSubmit={handleAiDraft} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      required
                      placeholder="Target Role"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <select
                    value={careerStage}
                    onChange={(e) => setCareerStage(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Experienced">Experienced Professional</option>
                    <option value="Fresher">Student / Fresher</option>
                    <option value="Career Switcher">Career Switcher</option>
                  </select>
                  <textarea
                    rows={2}
                    required
                    placeholder="Education background (degree, college, graduation year)"
                    value={educationSummary}
                    onChange={(e) => setEducationSummary(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <textarea
                    rows={3}
                    required
                    placeholder="Work experience or academic projects (roles, companies, tasks, real outcomes)"
                    value={experienceOrProjects}
                    onChange={(e) => setExperienceOrProjects(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    required
                    placeholder="Key skills (comma separated)"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60"
                  >
                    <Wand2 className="w-4 h-4" />
                    {loading ? 'Generating Draft...' : 'Generate Editable Draft'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Resume Title</label>
                <input
                  value={resumeTitle}
                  onChange={(e) => setResumeTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-800">Contact Extracted</div>
                  <div className="mt-1 text-slate-600">
                    {reviewContent.personal.fullName || 'Not detected'} · {reviewContent.personal.email || 'No email'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-800">Sections Found</div>
                  <div className="mt-1 text-slate-600">
                    {reviewContent.experience.length} roles · {reviewContent.projects.length} projects ·{' '}
                    {reviewContent.education.length} education · {reviewContent.technicalSkills.length} skills
                  </div>
                </div>
              </div>
              <textarea
                rows={4}
                value={reviewContent.summary}
                onChange={(e) => setReviewContent({ ...reviewContent, summary: e.target.value })}
                placeholder="Extracted Summary"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setReviewContent(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                >
                  Start Over
                </button>
                <button
                  disabled={loading}
                  onClick={() => void handleSaveReviewed()}
                  className="px-5 py-2 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
                >
                  {loading ? 'Saving...' : 'Save & Open Editor'}
                </button>
              </div>
            </div>
          )}
    </PopupModal>
  );
};
