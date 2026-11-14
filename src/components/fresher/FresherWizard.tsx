import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Wand2 } from 'lucide-react';
import { apiRequest, ApiError } from '../../lib/api';
import { RESUME_TEMPLATES } from '../../lib/templates';
import { createEmptyResumeContent, type ProjectItem, type ResumeRecord } from '../../types/resume';

interface FresherWizardProps {
  initialEmail?: string;
  initialFullName?: string;
  isPremium: boolean;
  onCancel: () => void;
  onCreated: (resume: ResumeRecord) => void;
  onRequireUpgrade: (reason: string) => void;
}

const FRESHER_ROLES = [
  'Software Developer',
  'Web Developer',
  'AI / Machine Learning Engineer',
  'Data Analyst / Data Scientist',
  'Electronics / Embedded Engineer',
  'Mechanical Engineer',
  'Civil Engineer',
  'Business / Financial Analyst (B.Com / BBA)',
  'Digital Marketing Associate',
  'Customer Support Executive',
];

const ROLE_SKILL_RECOMMENDATIONS: Record<string, string[]> = {
  'Software Developer': ['Data Structures', 'Algorithms', 'Java / Python / TypeScript', 'SQL', 'Git'],
  'Web Developer': ['HTML5', 'CSS3', 'JavaScript / TypeScript', 'React', 'Node.js', 'REST APIs'],
  'AI / Machine Learning Engineer': ['Python', 'PyTorch / TensorFlow', 'Scikit-learn', 'Linear Algebra', 'SQL'],
  'Data Analyst / Data Scientist': ['Python', 'SQL', 'Excel', 'Power BI / Tableau', 'Statistics'],
};

export const FresherWizard: React.FC<FresherWizardProps> = ({
  initialEmail = '',
  initialFullName = '',
  isPremium,
  onCancel,
  onCreated,
  onRequireUpgrade,
}) => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(initialFullName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [targetRole, setTargetRole] = useState('Software Developer');

  // Education
  const [college, setCollege] = useState('');
  const [degree, setDegree] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [graduationYear, setGraduationYear] = useState('2026');
  const [academicYear, setAcademicYear] = useState('Final Year');
  const [score, setScore] = useState('');

  // Skills
  const [techSkills, setTechSkills] = useState('');
  const [softSkills, setSoftSkills] = useState('');

  // Projects + AI Project Generator
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projTitle, setProjTitle] = useState('');
  const [projDomain, setProjDomain] = useState('');
  const [projTech, setProjTech] = useState('');
  const [projProblem, setProjProblem] = useState('');
  const [projFeatures, setProjFeatures] = useState('');
  const [projContrib, setProjContrib] = useState('');
  const [projOutcome, setProjOutcome] = useState('');
  const [generatingProj, setGeneratingProj] = useState(false);

  // Extras
  const [internshipCompany, setInternshipCompany] = useState('');
  const [internshipRole, setInternshipRole] = useState('');
  const [internshipDuration, setInternshipDuration] = useState('');
  const [internshipBullets, setInternshipBullets] = useState('');
  const [certifications, setCertifications] = useState('');
  const [achievements, setAchievements] = useState('');
  const [extracurricular, setExtracurricular] = useState('');

  const [selectedTemplateId, setSelectedTemplateId] = useState('ats-fresher-core');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommendedSkills = ROLE_SKILL_RECOMMENDATIONS[targetRole] || [
    'Communication',
    'Problem Solving',
    'MS Office / Excel',
  ];

  const handleGenerateProject = async () => {
    if (!projTitle.trim() || !projTech.trim() || !projProblem.trim()) {
      setError('Enter project title, technologies, and problem solved to generate bullets.');
      return;
    }
    setGeneratingProj(true);
    setError(null);
    try {
      const res = await apiRequest<{
        result: {
          description: string;
          bullets: string[];
          technologies: string[];
        };
      }>('/api/ai/fresher-project', {
        method: 'POST',
        body: JSON.stringify({
          title: projTitle,
          domain: projDomain,
          technologies: projTech,
          problemSolved: projProblem,
          features: projFeatures,
          contribution: projContrib,
          outcomes: projOutcome,
        }),
      });
      setProjects((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2, 10),
          title: projTitle,
          domain: projDomain,
          technologies: res.result.technologies,
          link: '',
          startDate: '',
          endDate: '',
          description: res.result.description,
          bullets: res.result.bullets,
        },
      ]);
      setProjTitle('');
      setProjProblem('');
      setProjFeatures('');
      setProjContrib('');
      setProjOutcome('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        onRequireUpgrade(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Project generation failed.');
      }
    } finally {
      setGeneratingProj(false);
    }
  };

  const handleAddManualProject = () => {
    if (!projTitle.trim()) return;
    setProjects((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 10),
        title: projTitle,
        domain: projDomain,
        technologies: projTech.split(',').map((s) => s.trim()).filter(Boolean),
        link: '',
        startDate: '',
        endDate: '',
        description: projProblem,
        bullets: projFeatures ? projFeatures.split('\n').filter(Boolean) : [],
      },
    ]);
    setProjTitle('');
    setProjProblem('');
    setProjFeatures('');
  };

  const handleCreateResume = async () => {
    setCreating(true);
    setError(null);
    try {
      const content = createEmptyResumeContent('fresher');
      content.personal = {
        fullName: fullName.trim() || 'Graduate Candidate',
        targetRole,
        email,
        phone,
        location,
        linkedin: '',
        github: '',
        portfolio: '',
      };
      content.objective = `${academicYear} ${degree || 'graduate'} ${
        specialization ? `in ${specialization}` : ''
      } seeking an entry-level ${targetRole} position to apply academic projects and technical foundations.`;

      if (college || degree) {
        content.education = [
          {
            id: 'edu-1',
            institution: college,
            degree,
            specialization,
            location: '',
            startDate: '',
            endDate: graduationYear,
            score,
            academicYear,
          },
        ];
      }

      content.technicalSkills = techSkills.split(',').map((s) => s.trim()).filter(Boolean);
      content.softSkills = softSkills.split(',').map((s) => s.trim()).filter(Boolean);
      content.projects = projects;

      if (internshipCompany || internshipRole) {
        content.internships = [
          {
            id: 'int-1',
            company: internshipCompany,
            role: internshipRole,
            location: '',
            startDate: internshipDuration,
            endDate: '',
            current: false,
            bullets: internshipBullets.split('\n').filter(Boolean),
          },
        ];
      }

      content.certifications = certifications
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((name, i) => ({ id: `c-${i}`, name, issuer: '', date: '', credentialUrl: '' }));

      content.achievements = achievements
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((title, i) => ({ id: `a-${i}`, title, context: '', date: '' }));

      content.extracurricular = extracurricular.split('\n').map((l) => l.trim()).filter(Boolean);

      const res = await apiRequest<{ resume: ResumeRecord }>('/api/resumes', {
        method: 'POST',
        body: JSON.stringify({
          title: `${fullName || 'Fresher'} — ${targetRole}`,
          targetRole,
          builderType: 'fresher',
          templateId: selectedTemplateId,
          content,
        }),
      });
      onCreated(res.resume);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ENTITLEMENT_REQUIRED') {
        onRequireUpgrade(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create fresher resume.');
      }
    } finally {
      setCreating(false);
    }
  };

  const fresherTemplates = RESUME_TEMPLATES.filter((t) => t.isFresherFriendly);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-iris-600">Dedicated Fresher Resume Builder</div>
            <h1 className="text-lg font-bold text-slate-900">Build My First Resume</h1>
          </div>
          <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 text-xs font-medium">
          {['1. Profile', '2. Education', '3. Skills & Projects', '4. Internships & Extras', '5. Template'].map(
            (label, idx) => (
              <button
                key={label}
                onClick={() => setStep(idx + 1)}
                className={`py-2.5 px-2 text-center border-b-2 transition-colors ${
                  step === idx + 1
                    ? 'border-iris-600 text-iris-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Job Role *</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {FRESHER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">City / Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Hyderabad, Telangana"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">College / University</label>
                <input
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="National Institute of Technology..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Degree / Diploma</label>
                <input
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  placeholder="B.Tech / B.Com / BBA / B.Sc"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Specialization / Branch</label>
                <input
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="Computer Science & Engineering"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Graduation Year</label>
                <input
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">CGPA / Percentage (Optional)</label>
                <input
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="8.6 CGPA or 84%"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Academic Year</label>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Pre-Final Year">Pre-Final Year</option>
                  <option value="Final Year">Final Year</option>
                  <option value="Recent Graduate">Recent Graduate</option>
                  <option value="Diploma Graduate">Diploma Graduate</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Your Technical Skills (comma separated)
                  </label>
                  <input
                    value={techSkills}
                    onChange={(e) => setTechSkills(e.target.value)}
                    placeholder="Python, SQL, React, Git"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Recommended to learn for {targetRole}: {recommendedSkills.join(', ')}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Soft Skills (Optional)
                  </label>
                  <input
                    value={softSkills}
                    onChange={(e) => setSoftSkills(e.target.value)}
                    placeholder="Team Collaboration, Technical Writing"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  Academic & Personal Project Description Generator
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    placeholder="Project Title *"
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    placeholder="Domain (e.g. FinTech, Healthcare)"
                    value={projDomain}
                    onChange={(e) => setProjDomain(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    placeholder="Technologies * (React, Python)"
                    value={projTech}
                    onChange={(e) => setProjTech(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <textarea
                  rows={2}
                  placeholder="Problem solved & main features *"
                  value={projProblem}
                  onChange={(e) => setProjProblem(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    placeholder="Your specific contribution (Optional)"
                    value={projContrib}
                    onChange={(e) => setProjContrib(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    placeholder="Actual outcome / result (Optional)"
                    value={projOutcome}
                    onChange={(e) => setProjOutcome(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={generatingProj}
                    onClick={() => void handleGenerateProject()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700 disabled:opacity-60"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {generatingProj ? 'Generating Project Bullets...' : 'Generate AI Project Bullets'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualProject}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Without AI
                  </button>
                </div>
              </div>

              {projects.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Added Projects ({projects.length})</div>
                  {projects.map((p) => (
                    <div key={p.id} className="p-3 rounded-lg border border-slate-200 flex justify-between items-start gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{p.title}</div>
                        <p className="text-xs text-slate-600 mt-0.5">{p.description}</p>
                      </div>
                      <button
                        onClick={() => setProjects((prev) => prev.filter((x) => x.id !== p.id))}
                        className="text-xs text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                All fields on this step are optional. Leave blank if you do not have internships or workshops yet.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  placeholder="Internship Company (Optional)"
                  value={internshipCompany}
                  onChange={(e) => setInternshipCompany(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  placeholder="Intern Role"
                  value={internshipRole}
                  onChange={(e) => setInternshipRole(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  placeholder="Duration (e.g. May–Jul 2025)"
                  value={internshipDuration}
                  onChange={(e) => setInternshipDuration(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Internship work bullets (one per line)"
                value={internshipBullets}
                onChange={(e) => setInternshipBullets(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <textarea
                  rows={3}
                  placeholder="Certifications & Workshops (one per line)"
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <textarea
                  rows={3}
                  placeholder="Achievements & Hackathons (one per line)"
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Extracurricular activities or club responsibilities (one per line)"
                value={extracurricular}
                onChange={(e) => setExtracurricular(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fresherTemplates.map((tpl) => {
                const locked = tpl.isPremium && !isPremium;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      if (locked) {
                        onRequireUpgrade(`"${tpl.name}" is a Premium fresher template.`);
                        return;
                      }
                      setSelectedTemplateId(tpl.id);
                    }}
                    className={`text-left p-4 rounded-xl border transition-colors ${
                      selectedTemplateId === tpl.id
                        ? 'border-iris-600 bg-iris-50/70'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{tpl.name}</span>
                      <span className="text-xs text-slate-500">{tpl.isPremium ? 'Premium' : 'Free'}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{tpl.description}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
              >
                Next Step
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={creating}
                onClick={() => void handleCreateResume()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-iris-600 text-white text-xs font-medium hover:bg-iris-700 disabled:opacity-60"
              >
                {creating ? 'Creating Resume...' : 'Open in Live Editor'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
