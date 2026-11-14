import type { ResumeContent, ResumeDesignSettings } from '../types/resume';

export type TemplateLayoutType =
  | 'single-column'
  | 'left-sidebar'
  | 'right-sidebar'
  | 'split-header'
  | 'executive-serif'
  | 'compact-grid'
  | 'academic-cv'
  | 'modern-accent';

export type TemplateCategory =
  | 'ATS-Friendly'
  | 'Modern'
  | 'Minimalist'
  | 'Corporate'
  | 'Executive'
  | 'Student & Fresher'
  | 'Software & AI'
  | 'Business & Finance'
  | 'Creative & Marketing'
  | 'Academic & Engineering';

export interface ResumeTemplateDefinition {
  id: string;
  name: string;
  category: TemplateCategory;
  tags: string[];
  layout: TemplateLayoutType;
  isPremium: boolean;
  isFresherFriendly: boolean;
  description: string;
  defaultAccent: string;
  defaultFont: ResumeDesignSettings['fontFamily'];
  headerAlignment: 'left' | 'center';
}

export const RESUME_TEMPLATES: ResumeTemplateDefinition[] = [
  {
    id: 'ats-classic',
    name: 'ATS Classic',
    category: 'ATS-Friendly',
    tags: ['ATS-friendly', 'Single-column', 'General'],
    layout: 'single-column',
    isPremium: false,
    isFresherFriendly: true,
    description: 'Clean single-column chronological layout engineered for zero parsing ambiguity.',
    defaultAccent: '#1e293b',
    defaultFont: 'dm-sans',
    headerAlignment: 'left',
  },
  {
    id: 'ats-fresher-core',
    name: 'Campus Launch',
    category: 'Student & Fresher',
    tags: ['Fresher', 'Student', 'Internship', 'ATS-friendly'],
    layout: 'single-column',
    isPremium: false,
    isFresherFriendly: true,
    description: 'Education-first structure highlighting projects, coursework, and technical stack.',
    defaultAccent: '#3730a3',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'center',
  },
  {
    id: 'minimal-nordic',
    name: 'Nordic Minimal',
    category: 'Minimalist',
    tags: ['Minimalist', 'Product', 'Design'],
    layout: 'split-header',
    isPremium: false,
    isFresherFriendly: true,
    description: 'Generous negative space with a split contact header and crisp section dividers.',
    defaultAccent: '#0f172a',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'fresher-cs-sprint',
    name: 'CS & Engineering Sprint',
    category: 'Student & Fresher',
    tags: ['Computer Science', 'Software Development', 'Web Development', 'Fresher'],
    layout: 'modern-accent',
    isPremium: false,
    isFresherFriendly: true,
    description: 'Built for B.Tech/B.E. CS graduates showcasing GitHub repositories, stack, and internships.',
    defaultAccent: '#1d4ed8',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'fresher-commerce-bba',
    name: 'Commerce & BBA Ready',
    category: 'Student & Fresher',
    tags: ['B.Com', 'BBA', 'Business', 'Customer Support', 'Fresher'],
    layout: 'single-column',
    isPremium: false,
    isFresherFriendly: true,
    description: 'Structured for B.Com, BBA, and MBA freshers targeting analyst, operations, and support roles.',
    defaultAccent: '#0f766e',
    defaultFont: 'dm-sans',
    headerAlignment: 'center',
  },
  {
    id: 'corporate-ledger',
    name: 'Corporate Ledger',
    category: 'Corporate',
    tags: ['Corporate', 'Operations', 'Management'],
    layout: 'executive-serif',
    isPremium: false,
    isFresherFriendly: false,
    description: 'Authoritative corporate typography with balanced horizontal rules and clean date columns.',
    defaultAccent: '#1e3a8a',
    defaultFont: 'source-serif',
    headerAlignment: 'left',
  },
  {
    id: 'swe-systems',
    name: 'Systems Engineer',
    category: 'Software & AI',
    tags: ['Software Engineering', 'Backend', 'DevOps'],
    layout: 'compact-grid',
    isPremium: true,
    isFresherFriendly: true,
    description: 'High-density technical profile with dedicated skills matrix and project architecture blocks.',
    defaultAccent: '#312e81',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'ai-ml-research',
    name: 'AI & ML Lab',
    category: 'Software & AI',
    tags: ['AI and Machine Learning', 'Data Science', 'Research'],
    layout: 'left-sidebar',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Two-column technical layout keeping frameworks, publications, and math foundations scannable.',
    defaultAccent: '#4338ca',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'data-science-metrics',
    name: 'Data Analyst Precision',
    category: 'Software & AI',
    tags: ['Data Science', 'Analytics', 'BI'],
    layout: 'right-sidebar',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Right-hand competency rail paired with metric-forward impact bullets on the primary canvas.',
    defaultAccent: '#0369a1',
    defaultFont: 'dm-sans',
    headerAlignment: 'left',
  },
  {
    id: 'executive-boardroom',
    name: 'Boardroom Executive',
    category: 'Executive',
    tags: ['Executive', 'VP', 'Director'],
    layout: 'executive-serif',
    isPremium: true,
    isFresherFriendly: false,
    description: 'Editorial serif display header crafted for leadership mandates and board-level summaries.',
    defaultAccent: '#0f172a',
    defaultFont: 'playfair',
    headerAlignment: 'center',
  },
  {
    id: 'modern-metro',
    name: 'Metro Two-Column',
    category: 'Modern',
    tags: ['Modern', 'Product Manager', 'Design'],
    layout: 'left-sidebar',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Subtle tinted left rail for contact, core skills, and languages; wide right narrative column.',
    defaultAccent: '#4f46e5',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'finance-wallstreet',
    name: 'Capital & Finance',
    category: 'Business & Finance',
    tags: ['Finance', 'Investment Banking', 'CA'],
    layout: 'single-column',
    isPremium: true,
    isFresherFriendly: false,
    description: 'Strict single-page institutional layout favored by finance, consulting, and audit firms.',
    defaultAccent: '#1e293b',
    defaultFont: 'lora',
    headerAlignment: 'center',
  },
  {
    id: 'marketing-growth',
    name: 'Growth & Brand',
    category: 'Creative & Marketing',
    tags: ['Marketing', 'Digital Marketing', 'Growth'],
    layout: 'modern-accent',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Clean top accent bar with campaign highlight blocks for marketing and brand strategists.',
    defaultAccent: '#6d28d9',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'creative-atelier',
    name: 'Atelier Editorial',
    category: 'Creative & Marketing',
    tags: ['Creative', 'UX', 'Content'],
    layout: 'right-sidebar',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Editorial asymmetrical composition balancing portfolio links and visual storytelling.',
    defaultAccent: '#be185d',
    defaultFont: 'playfair',
    headerAlignment: 'left',
  },
  {
    id: 'academic-vita',
    name: 'Academic Curriculum Vitae',
    category: 'Academic & Engineering',
    tags: ['Academic', 'PhD', 'B.Sc', 'Research'],
    layout: 'academic-cv',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Multi-page academic CV format prioritizing publications, coursework, grants, and teaching.',
    defaultAccent: '#1e3a8a',
    defaultFont: 'source-serif',
    headerAlignment: 'center',
  },
  {
    id: 'core-electronics',
    name: 'ECE & Embedded',
    category: 'Academic & Engineering',
    tags: ['Electronics', 'Embedded', 'VLSI', 'Fresher'],
    layout: 'compact-grid',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Tailored for Electronics & Communication engineers detailing hardware tools, labs, and projects.',
    defaultAccent: '#0f766e',
    defaultFont: 'dm-sans',
    headerAlignment: 'left',
  },
  {
    id: 'core-mechanical',
    name: 'Mechanical & CAD',
    category: 'Academic & Engineering',
    tags: ['Mechanical', 'Manufacturing', 'Fresher'],
    layout: 'split-header',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Structured for Mechanical engineers emphasizing CAD/CAE toolchains, internships, and capstone builds.',
    defaultAccent: '#334155',
    defaultFont: 'dm-sans',
    headerAlignment: 'left',
  },
  {
    id: 'core-civil',
    name: 'Civil & Infrastructure',
    category: 'Academic & Engineering',
    tags: ['Civil', 'Structural', 'Fresher'],
    layout: 'single-column',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Clean engineering resume for Civil graduates covering AutoCAD, STAAD Pro, and site internships.',
    defaultAccent: '#1e293b',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'customer-success-pro',
    name: 'Client & Support Lead',
    category: 'Business & Finance',
    tags: ['Customer Service', 'Client Success', 'BPO'],
    layout: 'modern-accent',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Highlights communication metrics, SLA resolution, CRM tools, and languages clearly.',
    defaultAccent: '#0284c7',
    defaultFont: 'dm-sans',
    headerAlignment: 'left',
  },
  {
    id: 'internship-fasttrack',
    name: 'Internship Fast-Track',
    category: 'Student & Fresher',
    tags: ['Internship', 'Student', 'Diploma'],
    layout: 'split-header',
    isPremium: false,
    isFresherFriendly: true,
    description: 'Concise 1-page layout built specifically for summer/winter internship shortlists.',
    defaultAccent: '#4338ca',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'web-dev-studio',
    name: 'Full-Stack Web',
    category: 'Software & AI',
    tags: ['Web Development', 'Frontend', 'React'],
    layout: 'left-sidebar',
    isPremium: true,
    isFresherFriendly: true,
    description: 'Designed for frontend and full-stack developers with prominent live project links.',
    defaultAccent: '#2563eb',
    defaultFont: 'plus-jakarta',
    headerAlignment: 'left',
  },
  {
    id: 'swiss-monograph',
    name: 'Swiss Monograph',
    category: 'Minimalist',
    tags: ['Minimalist', 'Modern', 'Consulting'],
    layout: 'compact-grid',
    isPremium: true,
    isFresherFriendly: false,
    description: 'Swiss grid precision with tabular date alignment and crisp typographic hierarchy.',
    defaultAccent: '#09090b',
    defaultFont: 'dm-sans',
    headerAlignment: 'left',
  },
];

export function getTemplateById(id: string): ResumeTemplateDefinition {
  return RESUME_TEMPLATES.find((t) => t.id === id) || RESUME_TEMPLATES[0];
}

export const SAMPLE_PREVIEW_CONTENT: ResumeContent = {
  personal: {
    fullName: 'Aarav Kulkarni',
    targetRole: 'Software Engineer',
    email: 'aarav.kulkarni@example.in',
    phone: '+91 98201 44210',
    location: 'Bengaluru, India',
    linkedin: 'linkedin.com/in/aaravkulkarni',
    github: 'github.com/aaravk',
    portfolio: '',
  },
  summary:
    'Software Engineer with 3+ years of experience building high-throughput TypeScript and React web applications, PostgreSQL data pipelines, and accessible user interfaces.',
  objective:
    'Final-year Computer Science undergraduate seeking an entry-level Software Engineer role to apply full-stack TypeScript, API design, and database modeling skills.',
  experience: [
    {
      id: 'exp-1',
      company: 'FinStack Technologies',
      role: 'Software Engineer',
      location: 'Bengaluru',
      startDate: 'Jul 2023',
      endDate: 'Present',
      current: true,
      bullets: [
        'Architected a React & TypeScript reconciliation dashboard handling 40,000+ daily settlement records.',
        'Reduced PostgreSQL reporting query latency by 42% through composite indexing and query batching.',
      ],
    },
    {
      id: 'exp-2',
      company: 'CloudScale Labs',
      role: 'Associate Developer',
      location: 'Pune',
      startDate: 'Jun 2021',
      endDate: 'Jun 2023',
      current: false,
      bullets: [
        'Built REST API endpoints in Node.js with Zod validation and automated integration tests.',
        'Collaborated with product designers to ship responsive onboarding flows across mobile and desktop.',
      ],
    },
  ],
  internships: [
    {
      id: 'int-1',
      company: 'CloudScale Labs',
      role: 'Software Engineering Intern',
      location: 'Pune',
      startDate: 'Jan 2021',
      endDate: 'May 2021',
      current: false,
      bullets: [
        'Implemented automated CSV export pipelines and unit test coverage for internal tooling.',
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'Pune Institute of Computer Technology',
      degree: 'B.E. in Computer Engineering',
      specialization: 'Distributed Systems',
      location: 'Pune',
      startDate: '2017',
      endDate: '2021',
      score: '8.9 CGPA',
    },
  ],
  technicalSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Docker', 'Git'],
  softSkills: ['Technical Documentation', 'Cross-functional Collaboration', 'Code Review'],
  projects: [
    {
      id: 'proj-1',
      title: 'Distributed Task Scheduler',
      domain: 'Backend Systems',
      technologies: ['Go', 'Redis', 'PostgreSQL'],
      link: 'github.com/aaravk/task-grid',
      startDate: '2024',
      endDate: '2024',
      description: 'Fault-tolerant job queue with exponential backoff and worker heartbeats.',
      bullets: [
        'Designed idempotent task locking using Redis Lua scripts and PostgreSQL audit logs.',
      ],
    },
  ],
  certifications: [
    { id: 'cert-1', name: 'AWS Certified Developer – Associate', issuer: 'Amazon Web Services', date: '2024', credentialUrl: '' },
  ],
  achievements: [
    { id: 'ach-1', title: 'Finalist — Smart India Hackathon', context: 'Built an offline-first civic grievance portal.', date: '2020' },
  ],
  awards: [],
  languages: [
    { id: 'lang-1', language: 'English', proficiency: 'Fluent' },
    { id: 'lang-2', language: 'Hindi', proficiency: 'Native' },
  ],
  publications: [],
  volunteer: [],
  coursework: ['Data Structures & Algorithms', 'Operating Systems', 'Database Management Systems'],
  responsibilities: [],
  extracurricular: [],
  customSections: [],
  sectionOrder: ['summary', 'experience', 'projects', 'technicalSkills', 'education', 'certifications'],
  hiddenSections: [],
  sectionHeadings: {},
  design: {
    fontFamily: 'plus-jakarta',
    fontSize: 10,
    lineHeight: 1.4,
    sectionSpacing: 13,
    marginMm: 14,
    accentColor: '#3730a3',
    bulletStyle: 'disc',
    dateFormat: 'MMM YYYY',
  },
};
