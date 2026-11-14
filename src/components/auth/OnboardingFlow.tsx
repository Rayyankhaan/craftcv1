import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import type { CareerStage, UserProfile } from '../../types/resume';

interface OnboardingFlowProps {
  user: UserProfile;
  onComplete: (recommendedView: 'dashboard' | 'fresher' | 'ats') => void;
}

const STAGES: { id: CareerStage; label: string; desc: string }[] = [
  { id: 'student', label: 'College Student', desc: 'Preparing for campus placements or internships' },
  { id: 'fresher', label: 'Fresher / Recent Graduate', desc: 'Building your first full-time job resume' },
  { id: 'internship_seeker', label: 'Internship Seeker', desc: 'Applying for summer or winter internships' },
  { id: 'experienced', label: 'Experienced Professional', desc: 'Advancing or switching into senior roles' },
  { id: 'career_switcher', label: 'Career Switcher', desc: 'Transitioning skills into a new domain' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ user, onComplete }) => {
  const [fullName, setFullName] = useState(user.fullName || '');
  const [careerStage, setCareerStage] = useState<CareerStage>('fresher');
  const [currentEducation, setCurrentEducation] = useState('');
  const [targetJobRole, setTargetJobRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [mainCareerGoal, setMainCareerGoal] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (skipOptional = false) => {
    setSaving(true);
    try {
      await apiRequest('/api/auth/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim() || user.fullName || 'Candidate',
          careerStage: skipOptional ? null : careerStage,
          currentEducation: skipOptional ? null : currentEducation,
          targetJobRole: skipOptional ? null : targetJobRole,
          experienceLevel: skipOptional ? null : experienceLevel,
          mainCareerGoal: skipOptional ? null : mainCareerGoal,
        }),
      });
      const rec =
        careerStage === 'student' || careerStage === 'fresher' || careerStage === 'internship_seeker'
          ? 'fresher'
          : 'dashboard';
      onComplete(rec);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-iris-600">Account Setup</div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Tailor your workspace to your career stage
          </h1>
          <p className="text-sm text-slate-600">
            Tell us what you are targeting so we can recommend the right templates and ATS scoring criteria. Optional fields can be skipped.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name as it appears on your resume"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iris-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Current Career Stage</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCareerStage(s.id)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    careerStage === s.id
                      ? 'border-iris-600 bg-iris-50/70'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-900">{s.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Current / Highest Education (Optional)
              </label>
              <input
                type="text"
                value={currentEducation}
                onChange={(e) => setCurrentEducation(e.target.value)}
                placeholder="e.g. B.Tech CSE, B.Com, MBA"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Job Role (Optional)
              </label>
              <input
                type="text"
                value={targetJobRole}
                onChange={(e) => setTargetJobRole(e.target.value)}
                placeholder="e.g. Software Developer, Data Analyst"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Experience Level (Optional)
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select level</option>
                <option value="0 years (Fresher)">0 years (Fresher)</option>
                <option value="1–2 years">1–2 years</option>
                <option value="3–5 years">3–5 years</option>
                <option value="5–10 years">5–10 years</option>
                <option value="10+ years">10+ years</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Main Career Goal (Optional)
              </label>
              <input
                type="text"
                value={mainCareerGoal}
                onChange={(e) => setMainCareerGoal(e.target.value)}
                placeholder="e.g. Land first software engineering role"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit(true)}
            className="text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            Skip optional questions
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit(false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-iris-600 text-white text-sm font-medium hover:bg-iris-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Continue to Workspace'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
