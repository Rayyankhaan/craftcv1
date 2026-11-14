import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  Eye,
  FileText,
  GitCompare,
  GraduationCap,
  Layers,
  Mail,
  Maximize2,
  MessageSquare,
  SearchCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { BRAND_CONFIG } from '../../config/brand';
import { RESUME_TEMPLATES, SAMPLE_PREVIEW_CONTENT } from '../../lib/templates';
import { ResumeRenderer } from '../resume/ResumeRenderer';
import { PopupModal } from '../ui/PopupModal';

type CreateMode = 'standard' | 'fresher' | 'upload' | 'ats' | 'matcher' | 'cover-letters' | 'career';

interface LandingPageProps {
  isAuthenticated: boolean;
  priceInr: number;
  billingInterval: string;
  onStartCreate: (mode: CreateMode, templateId?: string) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenDashboard: () => void;
  onOpenLegal: (section: 'privacy' | 'terms' | 'refund' | 'support') => void;
}

const TEMPLATE_FILTERS = [
  'All',
  'ATS-Friendly',
  'Student & Fresher',
  'Software & AI',
  'Modern',
  'Corporate',
  'Executive',
  'Business & Finance',
  'Creative & Marketing',
  'Academic & Engineering',
];

const SHOWCASE_ROLES = [
  {
    role: 'Software Engineer',
    templateId: 'swe-systems',
    stream: 'Dev & Engineering',
    highlights: ['Technical skills matrix', 'Architecture impact bullets', 'GitHub & production metrics'],
    sampleSummary: 'Full-stack engineer focused on TypeScript, distributed APIs, and low-latency frontend architecture.',
  },
  {
    role: 'AI & ML Graduate',
    templateId: 'ai-ml-research',
    stream: 'Student & Fresher',
    highlights: ['Capstone & research links', 'Frameworks & dataset stack', 'Fresher-fair ATS layout'],
    sampleSummary: 'Computer Science graduate specializing in NLP evaluation pipelines, Python, and PyTorch model deployment.',
  },
  {
    role: 'Data Analyst',
    templateId: 'data-science-metrics',
    stream: 'Data & Analytics',
    highlights: ['SQL & BI dashboard stack', 'KPI outcome bullets', 'Clean tabular readability'],
    sampleSummary: 'Data analyst turning raw product telemetry into SQL models, cohort dashboards, and actionable stakeholder reports.',
  },
  {
    role: 'Product Manager',
    templateId: 'modern-metro',
    stream: 'Product',
    highlights: ['Launch ownership framing', 'Cross-functional leadership', 'Retention & growth metrics'],
    sampleSummary: 'Product manager experienced in B2B SaaS onboarding, experimentation, and customer discovery workflows.',
  },
  {
    role: 'B.Com / BBA Fresher',
    templateId: 'fresher-commerce-bba',
    stream: 'Student & Fresher',
    highlights: ['Coursework & certifications', 'Campus finance projects', 'Zero-experience penalty protection'],
    sampleSummary: 'Commerce graduate trained in financial modeling, Tally, Excel reporting, and corporate audit internships.',
  },
  {
    role: 'Digital Marketing',
    templateId: 'marketing-growth',
    stream: 'Marketing',
    highlights: ['Campaign ROI structure', 'Channel & SEO competencies', 'Editorial hierarchy'],
    sampleSummary: 'Performance marketer running paid acquisition, lifecycle email funnels, and organic search content programs.',
  },
  {
    role: 'Finance & Audit',
    templateId: 'finance-wallstreet',
    stream: 'Finance',
    highlights: ['Conservative single-column grid', 'Valuation & compliance keywords', 'Executive serif precision'],
    sampleSummary: 'Finance associate focused on statutory audit, variance analysis, and board-ready financial reporting.',
  },
  {
    role: 'Customer Success',
    templateId: 'customer-success-pro',
    stream: 'Customer Service',
    highlights: ['Account retention focus', 'CRM & onboarding workflows', 'Client escalation highlights'],
    sampleSummary: 'Customer success specialist managing enterprise onboarding, renewal health scores, and product adoption.',
  },
];

const TRACKER_SAMPLE_ROWS = [
  {
    company: 'Razorpay',
    role: 'Frontend Engineer',
    stage: 'Interview',
    date: '18 Nov 2026',
    version: 'SWE-React-v2',
    notes: 'Technical UI round scheduled. Tailored React performance & accessibility bullets attached.',
    location: 'Bengaluru · Hybrid',
  },
  {
    company: 'Zoho',
    role: 'Software Developer (Fresher)',
    stage: 'Assessment',
    date: '15 Nov 2026',
    version: 'Campus-CS-v1',
    notes: 'DSA & C/Java coding assessment completed. Fresher ATS score verified at 88/100.',
    location: 'Chennai · On-site',
  },
  {
    company: 'Swiggy',
    role: 'Product Analyst',
    stage: 'Applied',
    date: '12 Nov 2026',
    version: 'Data-SQL-v3',
    notes: 'Submitted tailored resume copy + role-matched cover letter via career portal.',
    location: 'Bengaluru · Hybrid',
  },
  {
    company: 'Freshworks',
    role: 'Associate PM',
    stage: 'Offer',
    date: '08 Nov 2026',
    version: 'APM-Tailored',
    notes: 'Final panel completed. Reviewing offer compensation and joining timeline.',
    location: 'Chennai · Hybrid',
  },
];

const CAREER_TOOLS = [
  {
    title: 'AI Resume Builder',
    desc: 'Split-screen editor with real-time A4 pagination and vector exports.',
    icon: FileText,
    mode: 'standard' as CreateMode,
    previewTitle: 'Split-Screen Editor + Grounded AI',
    previewPoints: [
      'Edit contact, summary, experience, projects, and education side-by-side with live A4 preview.',
      'Refine bullets for clarity without inventing jobs, metrics, or credentials.',
      'Export selectable-text PDF, Word DOCX, and plain TXT with zero watermarks.',
    ],
  },
  {
    title: 'Job Application Tracker',
    desc: 'Organize companies, interview dates, notes, and submitted versions.',
    icon: Briefcase,
    mode: 'career' as CreateMode,
    previewTitle: 'Centralized Application CRM',
    previewPoints: [
      'Track opportunities across Interested, Applied, Assessment, Interview, and Offer stages.',
      'Link the exact resume version used for each company so interview prep stays consistent.',
      'Keep interview dates, recruiter notes, and follow-up reminders in one table.',
    ],
  },
  {
    title: 'ATS Resume Checker',
    desc: 'Score structure, keywords, and parsing risks with fresher-fair logic.',
    icon: SearchCheck,
    mode: 'ats' as CreateMode,
    previewTitle: 'Transparent General & JD ATS Scoring',
    previewPoints: [
      'Breaks down Formatting, Section Completeness, Keyword Coverage, and Readability.',
      'Applies a dedicated Fresher Rubric so students are not penalized for zero full-time history.',
      'Flags missing links, passive wording, and weak section ordering with actionable fixes.',
    ],
  },
  {
    title: 'Job Description Matcher',
    desc: 'Identify skill gaps and create non-destructive tailored resume copies.',
    icon: GitCompare,
    mode: 'matcher' as CreateMode,
    previewTitle: 'Non-Destructive Job Tailoring',
    previewPoints: [
      'Paste any employer job description to compare required hard and soft skills side by side.',
      'See matched keywords vs missing qualifications before submitting your application.',
      'Generate a separate tailored copy while preserving your master resume untouched.',
    ],
  },
  {
    title: 'Cover Letter Generator',
    desc: 'Draft role-specific cover letters grounded in your resume and export PDF/DOCX.',
    icon: Mail,
    mode: 'cover-letters' as CreateMode,
    previewTitle: 'Grounded Cover Letters in Seconds',
    previewPoints: [
      'Draws directly from your selected resume and target company job description.',
      'Supports formal corporate, concise startup, and fresher internship tones.',
      'Edit in place and download as clean A4 PDF or Word DOCX.',
    ],
  },
  {
    title: 'Fresher Resume Studio',
    desc: 'Guided student onboarding and AI project bullet generation.',
    icon: GraduationCap,
    mode: 'fresher' as CreateMode,
    previewTitle: 'Built for Students & Campus Placements',
    previewPoints: [
      'Highlights degree, CGPA, coursework, academic capstones, hackathons, and internships.',
      'Converts short project descriptions into crisp 3-bullet engineering or business entries.',
      'Includes fresher-optimized single-page templates.',
    ],
  },
  {
    title: 'AI Interview & STAR Prep',
    desc: 'Practice HR and technical questions with structured STAR answers.',
    icon: MessageSquare,
    mode: 'career' as CreateMode,
    previewTitle: 'Role-Specific Interview Preparation',
    previewPoints: [
      'Generates likely HR and technical questions based on your actual projects and roles.',
      'Structures behavioral stories using Situation, Task, Action, and Result.',
      'Helps freshers articulate capstone architecture and trade-offs clearly.',
    ],
  },
  {
    title: 'LinkedIn & Version History',
    desc: 'Optimize your LinkedIn About/headline and manage resume snapshots.',
    icon: Layers,
    mode: 'career' as CreateMode,
    previewTitle: 'Profile Sync & Snapshot Recovery',
    previewPoints: [
      'Generate LinkedIn headlines and About sections aligned with your target roles.',
      'Automatically save resume snapshots before major rewrites and restore anytime.',
      'Create revocable public share links when recruiters ask for a live URL.',
    ],
  },
];

const FAQS = [
  {
    q: 'Is my first resume really free to create and download?',
    a: 'Yes. Every new account receives 1 complete free resume (usable in either the Standard Builder or the Fresher Builder), unlimited editing of that resume, 1 basic AI generation, 1 basic ATS analysis, and watermark-free PDF, DOCX, and TXT exports.',
  },
  {
    q: 'How does the Dedicated Fresher Builder help students with no work history?',
    a: 'Our Fresher Builder adapts every section around your degree, coursework, academic and personal projects, internships, hackathons, and certifications. Its Fresher ATS analysis never penalizes you for not having prior full-time work experience.',
  },
  {
    q: 'Does the AI invent fake jobs, projects, or metrics?',
    a: 'Never. Our AI writing assistant only refines and formats details you provide. When measurable outcomes or facts are missing, it prompts you for clarification rather than fabricating numbers.',
  },
  {
    q: 'What happens to my saved resumes if I cancel or my ₹99 Premium plan ends?',
    a: 'Your resumes are never deleted. You keep full access to open, edit, and download your existing resumes in PDF, DOCX, and TXT formats even after a subscription expires.',
  },
  {
    q: 'Are PDF and DOCX downloads genuine text documents?',
    a: 'Yes. Exports are generated as clean A4 vector PDF and structured Word DOCX files with selectable text, clickable email/LinkedIn/GitHub links, and proper pagination—never screenshots.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  isAuthenticated,
  priceInr,
  billingInterval,
  onStartCreate,
  onOpenAuth,
  onOpenDashboard,
  onOpenLegal,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [heroTab, setHeroTab] = useState<'resumes' | 'tracker' | 'matching' | 'fresher'>('resumes');
  const [trackerFilter, setTrackerFilter] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  // Pop-up modal states (strictly triggered on user interaction)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [selectedRoleModal, setSelectedRoleModal] = useState<(typeof SHOWCASE_ROLES)[number] | null>(null);
  const [selectedToolModal, setSelectedToolModal] = useState<(typeof CAREER_TOOLS)[number] | null>(null);
  const [selectedTrackerRow, setSelectedTrackerRow] = useState<(typeof TRACKER_SAMPLE_ROWS)[number] | null>(null);
  const [matchingPopupOpen, setMatchingPopupOpen] = useState(false);
  const [quickLauncherOpen, setQuickLauncherOpen] = useState(false);

  // Spatial hero: the whole scene tilts toward the pointer
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 90, damping: 18 });
  const spy = useSpring(py, { stiffness: 90, damping: 18 });
  const rotY = useTransform(spx, [-0.5, 0.5], [-11, 11]);
  const rotX = useTransform(spy, [-0.5, 0.5], [8, -8]);

  const handleScenePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const resetScene = () => {
    px.set(0);
    py.set(0);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const visibleTemplates = RESUME_TEMPLATES.filter((t) =>
    selectedCategory === 'All' ? true : t.category === selectedCategory
  );

  const previewTemplateIndex = previewTemplateId
    ? RESUME_TEMPLATES.findIndex((t) => t.id === previewTemplateId)
    : -1;
  const previewTemplate = previewTemplateIndex >= 0 ? RESUME_TEMPLATES[previewTemplateIndex] : null;

  const filteredTrackerRows = TRACKER_SAMPLE_ROWS.filter((r) =>
    trackerFilter === 'All' ? true : r.stage === trackerFilter
  );

  const handleCycleTemplate = (dir: -1 | 1) => {
    if (previewTemplateIndex < 0) return;
    const nextIdx = (previewTemplateIndex + dir + RESUME_TEMPLATES.length) % RESUME_TEMPLATES.length;
    setPreviewTemplateId(RESUME_TEMPLATES[nextIdx].id);
  };

  const enter = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18, filter: 'blur(8px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  const stageColor: Record<string, string> = {
    Applied: 'bg-iris-50 text-iris-700',
    Assessment: 'bg-marigold-100 text-amber-800',
    Interview: 'bg-sky-50 text-sky-700',
    Offer: 'bg-mint-50 text-emerald-700',
  };

  const btnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-full bg-marigold-400 text-ink font-bold shadow-[0_12px_30px_-10px_rgba(255,182,39,0.75),inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-marigold-300 active:translate-y-px transition-all whitespace-nowrap';
  const btnGlass =
    'glass inline-flex items-center justify-center gap-2 rounded-full text-white font-semibold hover:bg-white/20 active:translate-y-px transition-all whitespace-nowrap';
  const btnIris =
    'inline-flex items-center justify-center gap-2 rounded-full bg-iris-600 text-white font-semibold shadow-[0_10px_24px_-10px_rgba(91,75,255,0.8)] hover:bg-iris-700 active:translate-y-px transition-all whitespace-nowrap';
  const btnLightGhost =
    'inline-flex items-center justify-center gap-2 rounded-full border border-ink/15 bg-white text-ink font-semibold hover:border-ink/40 active:translate-y-px transition-all whitespace-nowrap';
  const h2 = 'font-display font-extrabold tracking-[-0.03em] leading-[1.02] text-4xl sm:text-5xl';

  return (
    <div className="relative min-h-screen text-white overflow-x-clip" style={{ background: '#120d3a' }}>
      {/* Immersive environment */}
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(165deg, #140e45 0%, #2a1a8f 38%, #5b34c9 68%, #a04bb8 100%)' }} />
        <div className="absolute -top-32 left-[8%] w-[560px] h-[560px] rounded-full bg-iris-500/50 blur-[130px]" />
        <div className="absolute top-[30%] -right-40 w-[520px] h-[520px] rounded-full bg-fuchsia-500/35 blur-[130px]" />
        <div className="absolute -bottom-40 left-[20%] w-[620px] h-[460px] rounded-full bg-marigold-400/30 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse 80% 55% at 50% 20%, #000 20%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 55% at 50% 20%, #000 20%, transparent 75%)',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Floating glass navigation */}
        <header className="sticky top-0 z-40 px-4 pt-4">
          <div
            className={`glass max-w-6xl mx-auto flex items-center justify-between gap-6 rounded-full pl-5 pr-2 py-2 transition-shadow duration-300 ${
              scrolled ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_24px_50px_-18px_rgba(6,3,40,0.8)]' : ''
            }`}
          >
            <a href="#top" className="flex items-center gap-2 shrink-0 font-display text-lg font-extrabold tracking-tight">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-white text-iris-600">
                <FileText className="w-4 h-4" />
              </span>
              {BRAND_CONFIG.name}
            </a>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-white/75">
              {[
                ['#workspace-stage', 'Product'],
                ['#features', 'Features'],
                ['#templates', 'Templates'],
                ['#tools', 'Career tools'],
                ['#pricing', 'Pricing'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="px-3.5 py-2 rounded-full hover:bg-white/15 hover:text-white transition-colors whitespace-nowrap">
                  {label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 shrink-0">
              {isAuthenticated ? (
                <button onClick={onOpenDashboard} className="rounded-full bg-white text-ink px-5 py-2.5 text-sm font-bold hover:bg-marigold-300 transition-colors">
                  Open dashboard
                </button>
              ) : (
                <>
                  <button onClick={() => onOpenAuth('login')} className="hidden sm:inline-flex px-4 py-2.5 text-sm font-semibold text-white/85 rounded-full hover:bg-white/15 transition-colors">
                    Log in
                  </button>
                  <button onClick={() => onOpenAuth('register')} className="rounded-full bg-white text-ink px-5 py-2.5 text-sm font-bold hover:bg-marigold-300 transition-colors">
                    Start free
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Hero: text plus a tilting 3D scene of floating windows */}
        <section id="top" className="pt-10 pb-24 lg:pt-12 lg:pb-32">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-6 items-center">
            <div className="lg:col-span-6 space-y-7">
              <motion.div {...enter(0)}>
                <span className="glass inline-flex items-center gap-2 rounded-full pl-1.5 pr-4 py-1.5 text-xs font-semibold text-white/90">
                  <span className="rounded-full bg-marigold-400 text-ink px-2 py-0.5">Free</span>
                  Your first resume costs nothing
                </span>
              </motion.div>

              <motion.h1
                {...enter(0.08)}
                className="font-display font-extrabold tracking-[-0.035em] leading-[1] text-white drop-shadow-[0_6px_30px_rgba(10,5,60,0.5)]"
                style={{ fontSize: 'clamp(2.8rem, 6.2vw, 5rem)', textWrap: 'balance' }}
              >
                A resume that gets you past the first screen.
              </motion.h1>

              <motion.p {...enter(0.16)} className="text-lg text-white/75 leading-relaxed max-w-lg">
                Write it with AI that never invents facts, check it against real ATS rules, tailor it to each job, and download clean A4 PDF or DOCX in minutes.
              </motion.p>

              <motion.div {...enter(0.24)} className="flex flex-wrap items-center gap-3">
                <button onClick={() => onStartCreate('standard')} className={`${btnPrimary} px-7 py-3.5 text-[15px]`}>
                  Create my resume <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => onStartCreate('upload')} className={`${btnGlass} px-6 py-3.5 text-[15px]`}>
                  <Upload className="w-4 h-4" /> Upload existing
                </button>
              </motion.div>

              <motion.div {...enter(0.32)} className="space-y-3">
                <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75 font-medium">
                  {['No credit card', 'No watermark', 'PDF, DOCX and TXT'].map((t) => (
                    <li key={t} className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-marigold-400" strokeWidth={3} /> {t}
                    </li>
                  ))}
                </ul>
                <button onClick={() => onStartCreate('fresher')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-marigold-300 hover:text-marigold-400 underline-offset-4 hover:underline">
                  I'm a student or fresher <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            </div>

            {/* 3D scene */}
            <div
              className="lg:col-span-6 flex justify-center lg:justify-end py-6"
              style={{ perspective: 1300 }}
              onPointerMove={handleScenePointer}
              onPointerLeave={resetScene}
            >
              <motion.div
                {...(prefersReducedMotion ? {} : { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const } })}
                style={{ rotateX: prefersReducedMotion ? 0 : rotX, rotateY: prefersReducedMotion ? 0 : rotY, transformStyle: 'preserve-3d' }}
                className="relative scene-3d"
              >
                {/* back layer: tracker card */}
                <div
                  className="glass absolute -left-4 sm:-left-24 top-8 w-[210px] rounded-3xl p-4 hidden sm:block"
                  style={{ transform: 'translateZ(-70px)' }}
                >
                  <div className="text-xs font-semibold text-white/70 mb-3">Applications</div>
                  {[
                    ['Razorpay', 'Interview'],
                    ['Zoho', 'Assessment'],
                    ['Freshworks', 'Offer'],
                  ].map(([c, st]) => (
                    <div key={c} className="flex items-center justify-between py-2 border-t border-white/10 text-xs">
                      <span className="font-semibold">{c}</span>
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-white/85">{st}</span>
                    </div>
                  ))}
                </div>

                {/* middle layer: resume window */}
                <div className="glass rounded-[2rem] p-3" style={{ transform: 'translateZ(0px)' }}>
                  <div className="flex items-center gap-1.5 px-2 pb-2.5 pt-1" aria-hidden>
                    <span className="w-2.5 h-2.5 rounded-full bg-white/40" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
                    <span className="ml-2 text-[11px] font-semibold text-white/60">Aarav_Kulkarni_Resume.pdf</span>
                  </div>
                  <div className="relative w-[300px] h-[330px] sm:w-[360px] sm:h-[390px] overflow-hidden rounded-[1.4rem] bg-white shadow-inner">
                    <div className="origin-top-left scale-[0.378] sm:scale-[0.453] pointer-events-none select-none">
                      <ResumeRenderer content={SAMPLE_PREVIEW_CONTENT} templateId="swe-systems" />
                    </div>
                  </div>
                </div>

                {/* front ornament: ATS score */}
                <div
                  className="glass-light absolute -top-6 -right-4 sm:-right-14 flex items-center gap-3 rounded-3xl pl-3 pr-5 py-3 text-ink"
                  style={{ transform: 'translateZ(90px)' }}
                >
                  <div className="relative w-12 h-12">
                    <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#E7E5F5" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#12A67A" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${0.92 * 94.2} 94.2`} />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center text-sm font-extrabold font-display">92</span>
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-bold">ATS score</div>
                    <div className="text-xs text-ink/55">Parses cleanly</div>
                  </div>
                </div>

                {/* front ornament: AI suggestion */}
                <div
                  className="glass absolute -bottom-8 -left-2 sm:-left-16 w-[250px] rounded-3xl p-4"
                  style={{ transform: 'translateZ(120px)', background: 'linear-gradient(180deg, rgba(21,19,43,0.92), rgba(21,19,43,0.82))' }}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-marigold-400">
                    <Sparkles className="w-3.5 h-3.5" /> AI suggestion
                  </div>
                  <p className="mt-2 text-[13px] leading-snug text-white/85">
                    Add the number: <span className="text-white font-semibold">how many users did this API serve?</span> We only use facts you give us.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Workspace window with tab ornament */}
        <section id="workspace-stage" className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 lg:pb-32">
          <div className="max-w-2xl">
            <h2 className={h2} style={{ textWrap: 'balance' }}>Everything for the search, in one workspace.</h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed max-w-xl">Pick a tab and try it. These are real previews of what you get after signing up.</p>
          </div>

          <div className="mt-10 glass-light rounded-[2rem] text-ink overflow-hidden">
            <div className="px-6 py-3.5 flex items-center justify-between gap-4 border-b border-ink/8">
              <div className="flex items-center gap-1.5" aria-hidden>
                <span className="w-3 h-3 rounded-full bg-ink/15" />
                <span className="w-3 h-3 rounded-full bg-ink/15" />
                <span className="w-3 h-3 rounded-full bg-ink/15" />
              </div>
              <span className="text-xs font-semibold text-ink/50 truncate">
                {heroTab === 'resumes' ? 'Resume editor' : heroTab === 'tracker' ? 'Application tracker' : heroTab === 'matching' ? 'Job description match' : 'Fresher studio'}
              </span>
              <button onClick={() => setPreviewTemplateId('swe-systems')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-iris-600 hover:text-iris-700 whitespace-nowrap">
                <Maximize2 className="w-3.5 h-3.5" /> Full preview
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={heroTab}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {heroTab === 'resumes' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                    <div className="lg:col-span-5 p-7 sm:p-10 flex flex-col justify-between gap-8">
                      <div className="space-y-4">
                        <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">Edit on the left. See the page on the right.</h3>
                        <p className="text-ink/65 leading-relaxed">Change fonts, margins, section order and bullet style. Ask AI to tighten a summary or bullet without it making things up.</p>
                        <ul className="space-y-2.5 text-sm text-ink/80 pt-1">
                          {['Undo, redo and automatic version snapshots', 'Text-based PDF and Word export', 'Upload a PDF or DOCX and keep editing'].map((t) => (
                            <li key={t} className="flex items-start gap-2.5">
                              <span className="mt-0.5 grid place-items-center w-5 h-5 rounded-full bg-mint-50 text-mint-600 shrink-0"><Check className="w-3 h-3" strokeWidth={3} /></span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => onStartCreate('standard')} className={`${btnIris} px-5 py-3 text-sm`}>Open the editor</button>
                        <button onClick={() => onStartCreate('upload')} className={`${btnLightGhost} px-5 py-3 text-sm`}>Upload a resume</button>
                      </div>
                    </div>
                    <div className="lg:col-span-7 bg-iris-50 p-6 flex items-start justify-center max-h-[460px] overflow-hidden relative">
                      <div className="w-[310px] sm:w-[445px] h-[400px] overflow-hidden shadow-xl ring-1 ring-ink/10 bg-white shrink-0">
                        <div className="origin-top-left scale-[0.39] sm:scale-[0.56] pointer-events-none select-none">
                          <ResumeRenderer content={SAMPLE_PREVIEW_CONTENT} templateId="swe-systems" />
                        </div>
                      </div>
                      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-iris-50 to-transparent" />
                      <button onClick={() => setPreviewTemplateId('swe-systems')} className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-ink text-white text-xs font-semibold shadow-lg hover:bg-ink/90 transition-colors">
                        <Eye className="w-3.5 h-3.5 text-marigold-400" /> Inspect full page
                      </button>
                    </div>
                  </div>
                )}

                {heroTab === 'tracker' && (
                  <div className="p-6 sm:p-10 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight max-w-md">Every application, resume version and interview date.</h3>
                      <div className="flex flex-wrap gap-1 p-1 bg-ink/5 rounded-full self-start">
                        {['All', 'Applied', 'Assessment', 'Interview', 'Offer'].map((st) => (
                          <button key={st} onClick={() => setTrackerFilter(st)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${trackerFilter === st ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'}`}>
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-ink/10 bg-white overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="text-ink/50 text-xs">
                          <tr className="border-b border-ink/10">
                            <th className="py-3 px-5 font-semibold">Company</th>
                            <th className="py-3 px-5 font-semibold">Position</th>
                            <th className="py-3 px-5 font-semibold">Stage</th>
                            <th className="py-3 px-5 font-semibold">Resume version</th>
                            <th className="py-3 px-5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/8">
                          {filteredTrackerRows.map((row) => (
                            <tr key={row.company} onClick={() => setSelectedTrackerRow(row)} className="hover:bg-iris-50/60 cursor-pointer transition-colors">
                              <td className="py-3.5 px-5 font-bold">{row.company}</td>
                              <td className="py-3.5 px-5 text-ink/70">{row.role}</td>
                              <td className="py-3.5 px-5"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${stageColor[row.stage] || 'bg-ink/5'}`}>{row.stage}</span></td>
                              <td className="py-3.5 px-5 font-mono-tabular text-xs text-ink/60">{row.version}</td>
                              <td className="py-3.5 px-5 text-right text-iris-600 font-semibold text-xs">Details</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <span className="text-sm text-ink/55">Select a row to see its notes.</span>
                      <button onClick={() => onStartCreate('career')} className={`${btnIris} px-5 py-3 text-sm`}>Start tracking <ArrowRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}

                {heroTab === 'matching' && (
                  <div className="p-7 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-6 space-y-4">
                      <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">Match any job description without touching your master resume.</h3>
                      <p className="text-ink/65 leading-relaxed">Paste a job description, see which keywords you already cover, and save a tailored copy.</p>
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => onStartCreate('matcher')} className={`${btnIris} px-5 py-3 text-sm`}>Try job matching <ArrowRight className="w-4 h-4" /></button>
                        <button onClick={() => setMatchingPopupOpen(true)} className={`${btnLightGhost} px-5 py-3 text-sm`}>See a sample</button>
                      </div>
                    </div>
                    <button type="button" onClick={() => setMatchingPopupOpen(true)} className="lg:col-span-6 text-left p-6 rounded-3xl bg-white border border-ink/10 hover:border-iris-400 hover:shadow-lg transition-all space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-bold">Backend Software Engineer</div>
                          <div className="text-xs text-ink/50 mt-0.5">8 of 11 requirements matched</div>
                        </div>
                        <div className="relative w-16 h-16">
                          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="#E7E5F5" strokeWidth="4" />
                            <circle cx="18" cy="18" r="15" fill="none" stroke="#5B4BFF" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${0.84 * 94.2} 94.2`} />
                          </svg>
                          <span className="absolute inset-0 grid place-items-center font-display font-extrabold text-sm">84%</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {['TypeScript', 'Node.js', 'PostgreSQL', 'REST APIs', 'Docker', 'Git'].map((k) => (
                            <span key={k} className="rounded-full bg-mint-50 text-emerald-700 px-2.5 py-1 text-xs font-semibold">{k}</span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {['Redis caching', 'OpenAPI', 'Load testing'].map((k) => (
                            <span key={k} className="rounded-full bg-marigold-100 text-amber-800 px-2.5 py-1 text-xs font-semibold">Missing: {k}</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {heroTab === 'fresher' && (
                  <div className="p-7 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-6 space-y-4">
                      <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">Turn projects and internships into your first real resume.</h3>
                      <p className="text-ink/65 leading-relaxed">Built for B.Tech, B.Com, BBA, B.Sc and diploma graduates. The fresher ATS check never penalises you for having no full-time job yet.</p>
                      <button onClick={() => onStartCreate('fresher')} className={`${btnIris} px-5 py-3 text-sm`}>Open fresher studio <ArrowRight className="w-4 h-4" /></button>
                    </div>
                    <div className="lg:col-span-6 grid grid-cols-2 gap-3">
                      {[
                        { title: 'CS and software', desc: 'GitHub, DSA, capstones', templateId: 'swe-systems' },
                        { title: 'AI and data science', desc: 'Python, models, datasets', templateId: 'ai-ml-research' },
                        { title: 'ECE, Mech, Civil', desc: 'Embedded, CAD, labs', templateId: 'fresher-engineering' },
                        { title: 'B.Com, BBA, Marketing', desc: 'Finance, Excel, campaigns', templateId: 'fresher-commerce-bba' },
                      ].map((stream) => (
                        <button key={stream.title} onClick={() => setPreviewTemplateId(stream.templateId)} className="text-left p-4 rounded-2xl bg-white border border-ink/10 hover:border-iris-400 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                          <div className="font-bold text-sm">{stream.title}</div>
                          <div className="text-xs text-ink/55 mt-1">{stream.desc}</div>
                          <div className="text-xs text-iris-600 font-semibold mt-3">Preview layout</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Ornament: tab switcher floating below the window */}
          <div className="relative flex justify-center -mt-7" role="tablist">
            <div className="glass flex flex-wrap justify-center gap-1 rounded-full p-1.5 shadow-[0_24px_50px_-16px_rgba(6,3,40,0.8)]">
              {[
                { id: 'resumes', label: 'AI resumes', icon: <FileText className="w-4 h-4" /> },
                { id: 'tracker', label: 'Job tracker', icon: <Briefcase className="w-4 h-4" /> },
                { id: 'matching', label: 'Job matching', icon: <GitCompare className="w-4 h-4" /> },
                { id: 'fresher', label: 'Fresher studio', icon: <GraduationCap className="w-4 h-4" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={heroTab === tab.id}
                  onClick={() => setHeroTab(tab.id as typeof heroTab)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                    heroTab === tab.id ? 'bg-white text-ink shadow-md' : 'text-white/80 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Features: floating glass tiles */}
        <section id="features" className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 lg:pb-32">
          <div className="max-w-2xl mb-12">
            <h2 className={h2} style={{ textWrap: 'balance' }}>Tailor every application in minutes, not evenings.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 sm:gap-5">
            <div className="glass glass-hover md:col-span-4 group relative overflow-hidden rounded-[2rem] min-h-[360px] flex flex-col sm:flex-row">
              <div className="p-7 sm:p-9 sm:w-1/2 flex flex-col justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <span className="grid place-items-center w-11 h-11 rounded-2xl bg-white/20"><Sparkles className="w-5 h-5" /></span>
                  <h3 className="font-display text-2xl font-extrabold tracking-tight leading-tight">Write with AI that sticks to the facts</h3>
                  <p className="text-white/70 text-sm leading-relaxed">Sharpen summaries and bullets using keywords from the job description. When a number is missing, it asks you instead of inventing one.</p>
                </div>
                <button onClick={() => onStartCreate('standard')} className={`${btnPrimary} px-5 py-2.5 text-sm w-fit`}>Build with AI <ArrowRight className="w-4 h-4" /></button>
              </div>
              <div className="sm:w-1/2 h-56 sm:h-auto relative p-3">
                <img src="/src/assets/images/spotlight_ai_resume_1794639235813.jpg" alt="Laptop showing a resume layout on a sunlit desk" referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover rounded-[1.4rem] group-hover:scale-[1.02] transition-transform duration-700" />
              </div>
            </div>

            <div className="glass glass-hover md:col-span-2 rounded-[2rem] p-7 flex flex-col justify-between gap-6 min-h-[360px]">
              <div className="space-y-3">
                <span className="grid place-items-center w-11 h-11 rounded-2xl bg-white/20"><SearchCheck className="w-5 h-5" /></span>
                <h3 className="font-display text-2xl font-extrabold tracking-tight leading-tight">See your ATS score and why</h3>
                <p className="text-white/70 text-sm leading-relaxed">Formatting, sections, keywords and readability, scored separately with fixes.</p>
              </div>
              <div className="space-y-2.5">
                {[['Formatting', 96], ['Sections', 90], ['Keywords', 78], ['Readability', 94]].map(([label, v]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-xs font-semibold mb-1"><span>{label}</span><span className="font-mono-tabular">{v}</span></div>
                    <div className="h-1.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full bg-marigold-400" style={{ width: `${v}%` }} /></div>
                  </div>
                ))}
              </div>
              <button onClick={() => onStartCreate('ats')} className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline w-fit">Check my resume <ArrowRight className="w-4 h-4" /></button>
            </div>

            <div id="job-tracker" className="glass glass-hover md:col-span-3 group relative overflow-hidden rounded-[2rem] min-h-[340px]">
              <img src="/src/assets/images/spotlight_job_tracker_1794639236074.jpg" alt="Professional organising interviews with a notebook and laptop" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-[1.03] transition-transform duration-700" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#140e45] via-[#140e45]/60 to-transparent" />
              <div className="relative h-full p-7 sm:p-9 flex flex-col justify-end gap-4 min-h-[340px]">
                <h3 className="font-display text-2xl font-extrabold tracking-tight leading-tight max-w-sm">One place for the whole job search</h3>
                <p className="text-white/75 text-sm leading-relaxed max-w-md">Move jobs from Interested to Offer, link the exact resume you sent, and keep interview dates and notes together.</p>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => onStartCreate('career')} className={`${btnPrimary} px-5 py-2.5 text-sm`}>Start organising <ArrowRight className="w-4 h-4" /></button>
                  <button onClick={() => onStartCreate('cover-letters')} className={`${btnGlass} px-5 py-2.5 text-sm`}>Write a cover letter</button>
                </div>
              </div>
            </div>

            <div id="fresher-builder" className="glass glass-hover md:col-span-3 group relative overflow-hidden rounded-[2rem] min-h-[340px]">
              <img src="/src/assets/images/spotlight_fresher_studio_1794639236968.jpg" alt="Graduate preparing a fresher resume in a campus atrium" referrerPolicy="no-referrer" loading="lazy" className="absolute right-0 top-0 w-1/2 h-full object-cover opacity-90 [mask-image:linear-gradient(to_right,transparent,#000_50%)] group-hover:scale-[1.03] transition-transform duration-700 hidden sm:block" />
              <div className="relative h-full p-7 sm:p-9 flex flex-col justify-between gap-6 sm:w-3/5 min-h-[340px]">
                <div className="space-y-3">
                  <span className="grid place-items-center w-11 h-11 rounded-2xl bg-white/20"><GraduationCap className="w-5 h-5" /></span>
                  <h3 className="font-display text-2xl font-extrabold tracking-tight leading-tight">Your first resume, with no job history needed</h3>
                  <p className="text-white/70 text-sm leading-relaxed">Lead with degree, projects and coursework. Turn each project into three crisp bullets.</p>
                </div>
                <button onClick={() => onStartCreate('fresher')} className={`${btnPrimary} px-5 py-2.5 text-sm w-fit`}>Build my fresher resume <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </section>

        {/* How it works: genuine sequence on one glass shelf */}
        <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 lg:pb-32">
          <div className="glass rounded-[2rem] p-7 sm:p-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <h2 className="font-display font-extrabold tracking-[-0.03em] leading-[1.02] text-3xl sm:text-4xl max-w-xl" style={{ textWrap: 'balance' }}>From sign-up to submitted in four steps.</h2>
              <button onClick={() => onStartCreate('standard')} className={`${btnPrimary} px-6 py-3 text-sm w-fit`}>Get started free</button>
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
              {[
                { step: 'Sign up free', desc: 'Use email, Google or a mobile OTP, then pick your career stage and target role.' },
                { step: 'Build or upload', desc: 'Start from scratch, open the fresher studio, or import a PDF or DOCX.' },
                { step: 'Tailor and check', desc: 'Run ATS diagnostics, match a job description and refine bullets with AI.' },
                { step: 'Export and track', desc: 'Download watermark-free A4 files and log the application in your tracker.' },
              ].map((item, i) => (
                <li key={item.step}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-white text-iris-600 font-display font-extrabold shadow-lg">{i + 1}</span>
                    <span aria-hidden className="hidden lg:block flex-1 h-px bg-gradient-to-r from-white/40 to-transparent" />
                  </div>
                  <h3 className="font-display text-lg font-extrabold tracking-tight">{item.step}</h3>
                  <p className="mt-1.5 text-sm text-white/70 leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Templates */}
        <section id="templates" className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 lg:pb-32 space-y-10">
          <div className="max-w-2xl space-y-3">
            <h2 className={h2} style={{ textWrap: 'balance' }}>{RESUME_TEMPLATES.length} templates for the way you work.</h2>
            <p className="text-white/70 text-lg leading-relaxed">Open any template for a full-page preview before you start editing.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SHOWCASE_ROLES.map((r) => (
              <button key={r.role} onClick={() => setSelectedRoleModal(r)} className="glass rounded-full px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/25 transition-colors">
                {r.role}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap subtle-scroll">
            {TEMPLATE_FILTERS.map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3.5 py-1.5 text-sm font-semibold rounded-full transition-colors whitespace-nowrap shrink-0 ${selectedCategory === cat ? 'bg-white text-ink' : 'text-white/70 hover:text-white hover:bg-white/15'}`}>
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {visibleTemplates.slice(0, 8).map((tpl) => (
              <div key={tpl.id} className="glass glass-hover group flex flex-col rounded-[1.75rem] p-3">
                <button type="button" onClick={() => setPreviewTemplateId(tpl.id)} className="relative h-64 overflow-hidden rounded-[1.2rem] bg-white/90 text-left w-full p-4">
                  <div className="w-[207px] h-full mx-auto overflow-hidden shadow-md bg-white">
                    <div className="origin-top-left scale-[0.26] pointer-events-none select-none">
                      <ResumeRenderer content={SAMPLE_PREVIEW_CONTENT} templateId={tpl.id} />
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-end justify-center p-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity bg-gradient-to-t from-ink/40 to-transparent">
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-ink text-xs font-semibold shadow-md"><Eye className="w-3.5 h-3.5 text-iris-600" /> Preview</span>
                  </div>
                </button>
                <div className="px-2 pt-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{tpl.name}</h3>
                    <p className="text-xs text-white/60 mt-0.5 truncate">{tpl.category}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tpl.isPremium ? 'bg-marigold-400 text-ink' : 'bg-white/20 text-white'}`}>{tpl.isPremium ? 'Premium' : 'Free'}</span>
                </div>
                <button onClick={() => onStartCreate(tpl.isFresherFriendly ? 'fresher' : 'standard', tpl.id)} className="mt-3 mx-1 mb-1 px-3 py-2.5 rounded-full bg-white/15 border border-white/20 text-sm font-semibold hover:bg-white hover:text-ink transition-colors">
                  Use this template
                </button>
              </div>
            ))}
          </div>
          {visibleTemplates.length === 0 && <p className="text-white/70">No templates in this category yet. Pick another filter.</p>}
        </section>

        {/* Tools */}
        <section id="tools" className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 lg:pb-32">
          <div className="max-w-2xl mb-12">
            <h2 className={h2} style={{ textWrap: 'balance' }}>The rest of the job search, covered.</h2>
            <p className="text-white/70 text-lg mt-3">Select a tool to see how it works before you open it.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CAREER_TOOLS.map((tool, i) => {
              const Icon = tool.icon;
              const orbs = ['from-iris-300 to-iris-600', 'from-marigold-300 to-marigold-400 text-ink', 'from-emerald-300 to-mint-600', 'from-sky-300 to-sky-600'];
              return (
                <button key={tool.title} onClick={() => setSelectedToolModal(tool)} className="glass glass-hover group text-left p-6 rounded-[1.75rem] flex flex-col gap-4">
                  <span className={`grid place-items-center w-12 h-12 rounded-full bg-gradient-to-br ${orbs[i % orbs.length]} shadow-[0_10px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.5)]`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1">
                    <h3 className="font-display font-extrabold tracking-tight">{tool.title}</h3>
                    <p className="text-sm text-white/65 mt-1.5 leading-relaxed">{tool.desc}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-marigold-300 group-hover:gap-2 transition-all">Quick look <ArrowRight className="w-4 h-4" /></span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 lg:pb-32">
          <div className="max-w-2xl mb-12">
            <h2 className={h2} style={{ textWrap: 'balance' }}>Start free. Upgrade when you're applying widely.</h2>
            <p className="text-white/70 text-lg mt-3">No credit card needed to create, edit and download your first resume.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            <div className="glass rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between gap-8">
              <div>
                <h3 className="font-display text-xl font-extrabold">Free</h3>
                <div className="mt-3 flex items-baseline gap-1.5"><span className="font-display text-5xl font-extrabold tracking-tight">₹0</span><span className="text-sm text-white/60">forever</span></div>
                <p className="text-sm text-white/70 mt-3">One resume in either the standard or fresher builder.</p>
                <ul className="mt-7 space-y-3.5 text-sm">
                  {['1 resume (standard or fresher builder)', 'Unlimited edits to that resume', 'Free ATS-friendly and fresher templates', '1 basic AI generation and 1 basic ATS check', 'Watermark-free PDF, DOCX and TXT downloads'].map((f) => (
                    <li key={f} className="flex items-start gap-3"><Check className="w-4 h-4 text-white shrink-0 mt-0.5" strokeWidth={3} /><span className="text-white/85">{f}</span></li>
                  ))}
                </ul>
              </div>
              <button onClick={() => onStartCreate('standard')} className={`${btnGlass} w-full px-5 py-3.5 text-sm`}>Start free</button>
            </div>

            <div className="glass-light rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between gap-8 text-ink md:-translate-y-3 md:scale-[1.02] shadow-[0_50px_90px_-30px_rgba(255,182,39,0.45),inset_0_1px_0_#fff]">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-extrabold">Premium</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink text-marigold-400 text-xs font-bold px-3 py-1"><Sparkles className="w-3.5 h-3.5" /> Full career suite</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5"><span className="font-display text-5xl font-extrabold tracking-tight">₹{priceInr}</span><span className="text-sm text-ink/55">/ {billingInterval}</span></div>
                <p className="text-sm text-ink/65 mt-3">For active job seekers tailoring a resume to every application.</p>
                <ul className="mt-7 space-y-3.5 text-sm">
                  {['Unlimited resumes and version history', 'All premium, engineering and business templates', 'Unlimited AI rewriting and fresher project generation', 'Advanced ATS analysis and job description matching', 'Cover letters, LinkedIn optimisation and interview prep'].map((f) => (
                    <li key={f} className="flex items-start gap-3"><Check className="w-4 h-4 text-mint-600 shrink-0 mt-0.5" strokeWidth={3} /><span className="text-ink/85">{f}</span></li>
                  ))}
                </ul>
              </div>
              <button onClick={() => (isAuthenticated ? onOpenDashboard() : onOpenAuth('register'))} className={`${btnIris} w-full px-5 py-3.5 text-sm`}>
                {isAuthenticated ? 'Manage subscription' : 'Create account and upgrade'}
              </button>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-24 lg:pb-32">
          <h2 className="font-display font-extrabold tracking-[-0.03em] leading-[1.05] text-3xl sm:text-4xl max-w-xl mb-10" style={{ textWrap: 'balance' }}>
            How candidates organise their search with {BRAND_CONFIG.name}.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { quote: 'Using the Fresher Studio, I turned two final-year engineering capstones into crisp 3-bullet entries and ran the Fresher ATS check. Having a clean selectable-text PDF helped me shortlist for three campus software developer interviews.', name: 'Siddharth Nair', role: 'B.Tech CSE graduate, Bengaluru', img: '/src/assets/images/portrait_siddharth_new_1794639236517.jpg' },
              { quote: 'Matching Mode flagged six SQL and stakeholder reporting keywords missing from my summary, and saved a tailored copy without touching my master resume. Tracking each version inside the Job Tracker kept follow-ups effortless.', name: 'Ananya Deshmukh', role: 'Product analyst, Mumbai', img: '/src/assets/images/portrait_ananya_new_1794639236915.jpg' },
            ].map((t) => (
              <figure key={t.name} className="glass rounded-[2rem] p-7 sm:p-9 flex flex-col justify-between gap-6">
                <blockquote className="text-[17px] leading-relaxed text-white/90">“{t.quote}”</blockquote>
                <figcaption className="flex items-center gap-3">
                  <img src={t.img} alt={`${t.name} portrait`} referrerPolicy="no-referrer" loading="lazy" className="w-11 h-11 rounded-full object-cover ring-2 ring-white/60" />
                  <div><div className="text-sm font-bold">{t.name}</div><div className="text-xs text-white/60">{t.role}</div></div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-5 sm:px-6 pb-24 lg:pb-32">
          <h2 className="font-display font-extrabold tracking-[-0.03em] leading-[1.05] text-3xl sm:text-4xl mb-10">Questions, answered.</h2>
          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const open = openFaq === idx;
              return (
                <div key={item.q} className={`glass rounded-3xl transition-colors ${open ? 'bg-white/15' : ''}`}>
                  <button onClick={() => setOpenFaq(open ? null : idx)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 font-bold">
                    <span>{item.q}</span>
                    <span className={`grid place-items-center w-7 h-7 rounded-full shrink-0 transition-colors ${open ? 'bg-white text-iris-600' : 'bg-white/15 text-white'}`}>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {open && <p className="px-6 pb-5 -mt-1 text-white/75 leading-relaxed">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="px-5 sm:px-6 pb-24">
          <div className="glass max-w-6xl mx-auto relative overflow-hidden rounded-[2.5rem] px-7 sm:px-14 py-14 sm:py-20">
            <div aria-hidden className="absolute -right-20 -top-24 w-96 h-96 rounded-full bg-marigold-400/40 blur-[90px]" />
            <div className="relative max-w-2xl space-y-6">
              <h2 className="font-display font-extrabold tracking-[-0.035em] leading-[1] text-4xl sm:text-6xl" style={{ textWrap: 'balance' }}>Your next interview starts with a better page.</h2>
              <p className="text-white/80 text-lg">Build your first resume free. It takes about ten minutes.</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => onStartCreate('standard')} className={`${btnPrimary} px-7 py-3.5`}>Create my resume <ArrowRight className="w-4 h-4" /></button>
                <button onClick={() => setQuickLauncherOpen(true)} className={`${btnGlass} px-6 py-3.5`}>See all ways to start</button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 pb-6">
          <div className="glass max-w-6xl mx-auto rounded-[2rem]">
            <div className="px-6 sm:px-10 py-12 grid grid-cols-2 md:grid-cols-5 gap-10 text-sm">
              <div className="col-span-2 md:col-span-1 space-y-3">
                <div className="flex items-center gap-2 font-display text-lg font-extrabold">
                  <span className="grid place-items-center w-7 h-7 rounded-lg bg-white text-iris-600"><FileText className="w-4 h-4" /></span>
                  {BRAND_CONFIG.name}
                </div>
                <p className="text-white/60 leading-relaxed">Free AI resume tools and a career workspace for students and professionals.</p>
              </div>
              {[
                { title: 'Tools', items: [['AI resume builder', () => onStartCreate('standard')], ['Job application tracker', () => onStartCreate('career')], ['ATS resume checker', () => onStartCreate('ats')], ['Job description match', () => onStartCreate('matcher')]] },
                { title: 'Build', items: [[`Resume templates (${RESUME_TEMPLATES.length})`, () => document.getElementById('templates')?.scrollIntoView({ behavior: 'smooth' })], ['Fresher resume builder', () => onStartCreate('fresher')], ['Cover letter generator', () => onStartCreate('cover-letters')], ['Upload PDF or DOCX', () => onStartCreate('upload')]] },
                { title: 'Account', items: [['Sign up free', () => onOpenAuth('register')], ['Log in', () => onOpenAuth('login')], [`Pricing (₹0 / ₹${priceInr})`, () => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })], ['FAQ', () => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })]] },
                { title: 'Legal and support', items: [['Privacy policy', () => onOpenLegal('privacy')], ['Terms of service', () => onOpenLegal('terms')], ['Refund policy', () => onOpenLegal('refund')], ['Contact and support', () => onOpenLegal('support')]] },
              ].map((col) => (
                <div key={col.title} className="space-y-3">
                  <div className="font-bold">{col.title}</div>
                  <ul className="space-y-2.5 text-white/65">
                    {(col.items as [string, () => void][]).map(([label, fn]) => (
                      <li key={label}><button onClick={fn} className="hover:text-white transition-colors text-left">{label}</button></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-white/15 px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/55">
              <span>© {new Date().getFullYear()} {BRAND_CONFIG.name}. All rights reserved.</span>
              <span>A4 vector PDF and DOCX. Private by default.</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Pop-Up 1: Template Full-Page Browser with Next/Previous Switching */}
      <PopupModal
        isOpen={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplateId(null)}
        title={previewTemplate?.name}
        subtitle={
          previewTemplate
            ? `${previewTemplate.category} · ${previewTemplate.isPremium ? 'Premium' : 'Free'} · ${previewTemplate.description}`
            : undefined
        }
        maxWidthClass="max-w-4xl"
        bodyClassName="p-0 flex-1 overflow-auto bg-slate-100"
        headerActions={
          previewTemplate && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleCycleTemplate(-1)}
                aria-label="Previous template"
                className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleCycleTemplate(1)}
                aria-label="Next template"
                className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = previewTemplate.id;
                  const isFresher = previewTemplate.isFresherFriendly;
                  setPreviewTemplateId(null);
                  onStartCreate(isFresher ? 'fresher' : 'standard', id);
                }}
                className="px-4 py-2 rounded-xl bg-iris-600 text-white text-xs font-medium hover:bg-iris-700 transition-colors whitespace-nowrap"
              >
                Use Template
              </button>
            </div>
          )
        }
      >
        {previewTemplate && (
          <div className="p-6 flex justify-center">
            <ResumeRenderer content={SAMPLE_PREVIEW_CONTENT} templateId={previewTemplate.id} scale={0.78} />
          </div>
        )}
      </PopupModal>

      {/* Pop-Up 2: Role Quick-Peek Pop-Up */}
      <PopupModal
        isOpen={Boolean(selectedRoleModal)}
        onClose={() => setSelectedRoleModal(null)}
        title={selectedRoleModal ? `${selectedRoleModal.role} Starter Kit` : ''}
        subtitle={selectedRoleModal ? `${selectedRoleModal.stream} · Recommended Layout` : undefined}
        maxWidthClass="max-w-2xl"
        bodyClassName="p-6 space-y-5"
      >
        {selectedRoleModal && (
          <>
            <p className="text-sm text-slate-600 leading-relaxed">{selectedRoleModal.sampleSummary}</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">Included Section Blueprint</div>
              <ul className="space-y-2 text-sm text-slate-700">
                {selectedRoleModal.highlights.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-iris-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  const tplId = selectedRoleModal.templateId;
                  setSelectedRoleModal(null);
                  setPreviewTemplateId(tplId);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                Preview A4 Template
              </button>
              <button
                type="button"
                onClick={() => {
                  const isFresher = selectedRoleModal.stream === 'Student & Fresher';
                  const tplId = selectedRoleModal.templateId;
                  setSelectedRoleModal(null);
                  onStartCreate(isFresher ? 'fresher' : 'standard', tplId);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
              >
                Start {selectedRoleModal.role} Resume <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </PopupModal>

      {/* Pop-Up 3: Career Tool Quick-Peek Pop-Up */}
      <PopupModal
        isOpen={Boolean(selectedToolModal)}
        onClose={() => setSelectedToolModal(null)}
        title={selectedToolModal?.previewTitle}
        subtitle={selectedToolModal?.title}
        maxWidthClass="max-w-lg"
        bodyClassName="p-6 space-y-5"
      >
        {selectedToolModal && (
          <>
            <p className="text-sm text-slate-600 leading-relaxed">{selectedToolModal.desc}</p>
            <ul className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
              {selectedToolModal.previewPoints.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-iris-600 shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedToolModal(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetMode = selectedToolModal.mode;
                  setSelectedToolModal(null);
                  onStartCreate(targetMode);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
              >
                Open {selectedToolModal.title} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </PopupModal>

      {/* Pop-Up 4: Job Tracker Row Inspector Pop-Up */}
      <PopupModal
        isOpen={Boolean(selectedTrackerRow)}
        onClose={() => setSelectedTrackerRow(null)}
        title={selectedTrackerRow ? `${selectedTrackerRow.company} — ${selectedTrackerRow.role}` : ''}
        subtitle={selectedTrackerRow ? `${selectedTrackerRow.location} · ${selectedTrackerRow.date}` : undefined}
        maxWidthClass="max-w-md"
        bodyClassName="p-6 space-y-4"
      >
        {selectedTrackerRow && (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Current Stage</div>
                <div className="font-semibold text-iris-600 mt-1">{selectedTrackerRow.stage}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Linked Resume</div>
                <div className="font-mono-tabular font-semibold text-slate-900 mt-1">
                  {selectedTrackerRow.version}
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed">
              {selectedTrackerRow.notes}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedTrackerRow(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTrackerRow(null);
                  onStartCreate('career');
                }}
                className="px-4 py-2 rounded-xl bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
              >
                Open Real Job Tracker
              </button>
            </div>
          </>
        )}
      </PopupModal>

      {/* Pop-Up 5: Matching Mode Breakdown Pop-Up */}
      <PopupModal
        isOpen={matchingPopupOpen}
        onClose={() => setMatchingPopupOpen(false)}
        title="Backend Software Engineer — Match Diagnostics"
        subtitle="Non-destructive comparison against your master resume"
        maxWidthClass="max-w-xl"
        bodyClassName="p-6 space-y-5"
      >
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">Employer JD Alignment Score</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">8 of 11 key requirements matched</div>
          </div>
          <div className="text-3xl font-bold text-iris-600 font-mono-tabular">84%</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="font-semibold text-emerald-700">Present in Your Resume</div>
            <p className="text-slate-700 leading-relaxed">
              TypeScript · Node.js · PostgreSQL · REST APIs · Docker · Git · Automated Testing · CI/CD
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="font-semibold text-amber-700">Suggested to Address (if true)</div>
            <p className="text-slate-700 leading-relaxed">
              Redis Caching · OpenAPI Spec · Load Testing
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setMatchingPopupOpen(false)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-700"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              setMatchingPopupOpen(false);
              onStartCreate('matcher');
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-iris-600 text-white text-xs font-medium hover:bg-iris-700"
          >
            Paste Your Job Description <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </PopupModal>

      {/* Pop-Up 6: Quick Start Command Menu Pop-Up */}
      <PopupModal
        isOpen={quickLauncherOpen}
        onClose={() => setQuickLauncherOpen(false)}
        title="Quick Start Workspace"
        subtitle="Choose how you want to begin — 1 free resume included"
        maxWidthClass="max-w-lg"
        bodyClassName="p-6 space-y-3"
      >
        {[
          {
            title: 'Create Standard Resume',
            desc: 'Open the live split-screen editor with 22 customizable A4 templates',
            mode: 'standard' as CreateMode,
          },
          {
            title: 'Launch Fresher Resume Studio',
            desc: 'Guided project, coursework, and internship builder for students',
            mode: 'fresher' as CreateMode,
          },
          {
            title: 'Upload Existing PDF / DOCX',
            desc: 'Parse your current resume into clean editable sections',
            mode: 'upload' as CreateMode,
          },
          {
            title: 'Run Free ATS Score Check',
            desc: 'Inspect keyword gaps, formatting risks, and actionable fixes',
            mode: 'ats' as CreateMode,
          },
          {
            title: 'Match a Job Description',
            desc: 'Create a tailored application copy without altering your master CV',
            mode: 'matcher' as CreateMode,
          },
        ].map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => {
              setQuickLauncherOpen(false);
              onStartCreate(item.mode);
            }}
            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-iris-400 hover:bg-slate-50/70 transition-all flex items-center justify-between gap-4"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">{item.title}</div>
              <div className="text-xs text-slate-600 mt-0.5">{item.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-iris-600 shrink-0" />
          </button>
        ))}
      </PopupModal>
    </div>
  );
};
