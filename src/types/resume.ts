export type CareerStage =
  | 'student'
  | 'fresher'
  | 'experienced'
  | 'career_switcher'
  | 'internship_seeker';

export type ResumeBuilderType = 'standard' | 'fresher';

export type ResumeSectionKey =
  | 'summary'
  | 'objective'
  | 'experience'
  | 'education'
  | 'technicalSkills'
  | 'softSkills'
  | 'projects'
  | 'internships'
  | 'certifications'
  | 'achievements'
  | 'awards'
  | 'languages'
  | 'publications'
  | 'volunteer'
  | 'coursework'
  | 'responsibilities'
  | 'extracurricular'
  | 'custom';

export interface PersonalInfo {
  fullName: string;
  targetRole: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  specialization: string;
  location: string;
  startDate: string;
  endDate: string;
  score: string;
  academicYear?: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  domain: string;
  technologies: string[];
  link: string;
  startDate: string;
  endDate: string;
  description: string;
  bullets: string[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credentialUrl: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  context: string;
  date: string;
}

export interface LanguageItem {
  id: string;
  language: string;
  proficiency: string;
}

export interface PublicationItem {
  id: string;
  title: string;
  venue: string;
  date: string;
  url: string;
}

export interface CustomSectionItem {
  id: string;
  title: string;
  items: { id: string; heading: string; subheading: string; date: string; description: string }[];
}

export interface ResumeDesignSettings {
  fontFamily: 'plus-jakarta' | 'dm-sans' | 'source-serif' | 'playfair' | 'lora' | 'jetbrains-mono';
  fontSize: number; // pt: 9.5 to 11.5
  lineHeight: number; // 1.25 to 1.65
  sectionSpacing: number; // px: 10 to 24
  marginMm: number; // 10 to 22
  accentColor: string;
  bulletStyle: 'disc' | 'square' | 'dash';
  dateFormat: 'MMM YYYY' | 'MM/YYYY' | 'YYYY';
}

export interface ResumeContent {
  personal: PersonalInfo;
  summary: string;
  objective: string;
  experience: ExperienceItem[];
  internships: ExperienceItem[];
  education: EducationItem[];
  technicalSkills: string[];
  softSkills: string[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  achievements: AchievementItem[];
  awards: AchievementItem[];
  languages: LanguageItem[];
  publications: PublicationItem[];
  volunteer: ExperienceItem[];
  coursework: string[];
  responsibilities: AchievementItem[];
  extracurricular: string[];
  customSections: CustomSectionItem[];
  sectionOrder: ResumeSectionKey[];
  hiddenSections: ResumeSectionKey[];
  sectionHeadings: Partial<Record<ResumeSectionKey, string>>;
  design: ResumeDesignSettings;
}

export interface ResumeRecord {
  id: string;
  userId: string;
  title: string;
  targetRole: string;
  builderType: ResumeBuilderType;
  templateId: string;
  content: ResumeContent;
  shareToken: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeVersionRecord {
  id: string;
  resumeId: string;
  versionNumber: number;
  label: string;
  templateId: string;
  content: ResumeContent;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  fullName: string;
  role: 'user' | 'admin';
  careerStage: CareerStage | null;
  currentEducation: string | null;
  targetJobRole: string | null;
  experienceLevel: string | null;
  mainCareerGoal: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface EntitlementSummary {
  plan: 'free' | 'premium';
  subscriptionStatus: 'inactive' | 'active' | 'cancelled' | 'expired';
  billingInterval: 'monthly' | 'yearly' | 'lifetime' | 'one_time';
  priceInr: number;
  expiresAt: string | null;
  resumesCreatedCount: number;
  freeResumeLimit: number;
  canCreateResume: boolean;
  aiGenerationsUsed: number;
  freeAiLimit: number;
  canUseAi: boolean;
  atsChecksUsed: number;
  freeAtsLimit: number;
  canRunAts: boolean;
}

export interface AtsAnalysisResult {
  id?: string;
  resumeId: string | null;
  analysisType: 'general' | 'fresher' | 'job_match';
  overallScore: number;
  jobMatchScore: number | null;
  categories: {
    name: string;
    score: number;
    maxScore: number;
    notes: string;
  }[];
  strengths: string[];
  weaknesses: string[];
  missingInformation: string[];
  recommendations: string[];
  parsingRisks: string[];
  createdAt?: string;
}

export interface JobMatchResult {
  id?: string;
  resumeId: string;
  jobTitle: string;
  companyName: string;
  matchScore: number;
  requiredQualifications: string[];
  preferredQualifications: string[];
  matchingKeywords: string[];
  missingKeywords: string[];
  skillGaps: string[];
  relevantExperienceHighlights: string[];
  recommendations: string[];
  createdAt?: string;
}

export interface CoverLetterRecord {
  id: string;
  userId: string;
  resumeId: string | null;
  jobTitle: string;
  companyName: string;
  hiringManager: string;
  tone: 'professional' | 'enthusiastic' | 'executive' | 'fresher';
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplicationRecord {
  id: string;
  userId: string;
  company: string;
  position: string;
  jobUrl: string;
  applicationDate: string;
  status: 'Interested' | 'Applied' | 'Assessment' | 'Interview' | 'Offer' | 'Rejected';
  notes: string;
  resumeVersionLabel: string;
  interviewDate: string;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyResumeContent(builderType: ResumeBuilderType = 'standard'): ResumeContent {
  return {
    personal: {
      fullName: '',
      targetRole: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      portfolio: '',
    },
    summary: '',
    objective: '',
    experience: [],
    internships: [],
    education: [],
    technicalSkills: [],
    softSkills: [],
    projects: [],
    certifications: [],
    achievements: [],
    awards: [],
    languages: [],
    publications: [],
    volunteer: [],
    coursework: [],
    responsibilities: [],
    extracurricular: [],
    customSections: [],
    sectionOrder:
      builderType === 'fresher'
        ? [
            'objective',
            'education',
            'technicalSkills',
            'projects',
            'internships',
            'certifications',
            'achievements',
            'coursework',
            'responsibilities',
            'softSkills',
            'extracurricular',
            'languages',
          ]
        : [
            'summary',
            'experience',
            'projects',
            'technicalSkills',
            'education',
            'certifications',
            'achievements',
            'softSkills',
            'languages',
            'publications',
            'volunteer',
          ],
    hiddenSections: [],
    sectionHeadings: {},
    design: {
      fontFamily: 'plus-jakarta',
      fontSize: 10,
      lineHeight: 1.42,
      sectionSpacing: 14,
      marginMm: 14,
      accentColor: '#3730a3',
      bulletStyle: 'disc',
      dateFormat: 'MMM YYYY',
    },
  };
}
