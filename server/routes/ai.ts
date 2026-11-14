import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { AuthenticatedRequest, requireAuth } from '../services/auth.ts';
import { aiProvider, ANTI_FABRICATION_SYSTEM_RULE, checkAiRateLimit, logAiUsage, Type } from '../services/ai.ts';
import { getUserEntitlements, incrementAiUsage, incrementAtsUsage } from '../services/entitlements.ts';

export const aiRouter = Router();

aiRouter.post('/write', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    action: z.enum([
      'generate_summary',
      'generate_objective',
      'generate_bullets',
      'improve',
      'rewrite',
      'shorten',
      'expand',
      'fix_grammar',
      'recommend_skills',
    ]),
    targetRole: z.string().max(120).optional().default(''),
    text: z.string().max(5000).optional().default(''),
    context: z.string().max(4000).optional().default(''),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid AI writer input.' });
    return;
  }

  const entitlements = getUserEntitlements(req.user!.id);
  if (!entitlements.canUseAi) {
    res.status(403).json({
      code: 'ENTITLEMENT_REQUIRED',
      error: 'You have used your 1 free basic AI generation. Upgrade to Premium for unlimited AI writing.',
      entitlements,
    });
    return;
  }

  const limit = checkAiRateLimit(req.user!.id);
  if (!limit.allowed) {
    res.status(429).json({ error: `Rate limit reached. Try again in ${limit.retryAfterSec}s.` });
    return;
  }

  try {
    const result = await aiProvider.generateJson<{
      output: string;
      bullets?: string[];
      suggestedSkills?: string[];
      missingInfoQuestions: string[];
    }>({
      systemInstruction: `${ANTI_FABRICATION_SYSTEM_RULE}
You are an expert career writer. Perform the requested action accurately using ONLY facts provided by the user.`,
      prompt: JSON.stringify(parsed.data),
      schema: {
        type: Type.OBJECT,
        properties: {
          output: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingInfoQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['output', 'missingInfoQuestions'],
      },
    });

    incrementAiUsage(req.user!.id);
    logAiUsage(req.user!.id, parsed.data.action, 'success', 450);
    res.json({ result, entitlements: getUserEntitlements(req.user!.id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI request failed.';
    logAiUsage(req.user!.id, parsed.data.action, 'error', 0, msg);
    res.status(500).json({ error: msg });
  }
});

aiRouter.post('/fresher-project', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    title: z.string().min(2).max(150),
    domain: z.string().max(120).optional().default(''),
    technologies: z.string().max(300),
    problemSolved: z.string().max(800),
    features: z.string().max(1000).optional().default(''),
    contribution: z.string().max(800).optional().default(''),
    outcomes: z.string().max(600).optional().default(''),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please fill project title, technologies, and problem solved.' });
    return;
  }

  const entitlements = getUserEntitlements(req.user!.id);
  if (!entitlements.canUseAi) {
    res.status(403).json({
      code: 'ENTITLEMENT_REQUIRED',
      error: 'Free AI generation credit used. Upgrade to Premium for unlimited project generation.',
      entitlements,
    });
    return;
  }

  const limit = checkAiRateLimit(req.user!.id);
  if (!limit.allowed) {
    res.status(429).json({ error: `Rate limit reached. Try again in ${limit.retryAfterSec}s.` });
    return;
  }

  try {
    const result = await aiProvider.generateJson<{
      description: string;
      bullets: string[];
      technologies: string[];
      keywords: string[];
      missingInfoQuestions: string[];
    }>({
      systemInstruction: `${ANTI_FABRICATION_SYSTEM_RULE}
Generate an ATS-friendly academic or personal project entry for a student/fresher resume. Produce 1 concise description, 3-4 strong action-verb resume bullet points grounded strictly in the user's input, clean technology tags, and relevant keywords.`,
      prompt: JSON.stringify(parsed.data),
      schema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
          technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingInfoQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['description', 'bullets', 'technologies', 'keywords', 'missingInfoQuestions'],
      },
    });

    incrementAiUsage(req.user!.id);
    logAiUsage(req.user!.id, 'fresher_project_generator', 'success', 500);
    res.json({ result, entitlements: getUserEntitlements(req.user!.id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Project generation failed.';
    logAiUsage(req.user!.id, 'fresher_project_generator', 'error', 0, msg);
    res.status(500).json({ error: msg });
  }
});

aiRouter.post('/draft-resume', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    targetRole: z.string().min(2),
    careerStage: z.string(),
    educationSummary: z.string().max(1500),
    experienceOrProjects: z.string().max(4000),
    skillsInput: z.string().max(1000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please complete the guided questionnaire fields.' });
    return;
  }

  const entitlements = getUserEntitlements(req.user!.id);
  if (!entitlements.canUseAi) {
    res.status(403).json({
      code: 'ENTITLEMENT_REQUIRED',
      error: 'Free AI credit already used. Upgrade to Premium for unlimited AI draft generation.',
      entitlements,
    });
    return;
  }

  try {
    const draft = await aiProvider.generateJson<Record<string, unknown>>({
      systemInstruction: `${ANTI_FABRICATION_SYSTEM_RULE}
Convert the user's questionnaire answers into a clean editable resume draft. Never invent unstated companies, dates, or numerical claims.`,
      prompt: JSON.stringify(parsed.data),
      schema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          objective: { type: Type.STRING },
          technicalSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                role: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING },
                bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                institution: { type: Type.STRING },
                degree: { type: Type.STRING },
                specialization: { type: Type.STRING },
                endDate: { type: Type.STRING },
              },
            },
          },
        },
      },
    });
    incrementAiUsage(req.user!.id);
    logAiUsage(req.user!.id, 'ai_draft_resume', 'success', 700);
    res.json({ draft, entitlements: getUserEntitlements(req.user!.id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate AI resume draft.';
    logAiUsage(req.user!.id, 'ai_draft_resume', 'error', 0, msg);
    res.status(500).json({ error: msg });
  }
});

function computeTransparentHeuristicAts(resumeContent: Record<string, unknown>, isFresher: boolean) {
  const personal = (resumeContent.personal as Record<string, string>) || {};
  const summary = String(resumeContent.summary || resumeContent.objective || '').trim();
  const experience = Array.isArray(resumeContent.experience) ? resumeContent.experience : [];
  const internships = Array.isArray(resumeContent.internships) ? resumeContent.internships : [];
  const education = Array.isArray(resumeContent.education) ? resumeContent.education : [];
  const projects = Array.isArray(resumeContent.projects) ? resumeContent.projects : [];
  const techSkills = Array.isArray(resumeContent.technicalSkills) ? resumeContent.technicalSkills : [];
  const certs = Array.isArray(resumeContent.certifications) ? resumeContent.certifications : [];

  const contactScore =
    (personal.fullName ? 5 : 0) +
    (personal.email ? 5 : 0) +
    (personal.phone ? 4 : 0) +
    (personal.location ? 3 : 0) +
    (personal.linkedin || personal.github || personal.portfolio ? 3 : 0);

  const summaryScore = summary.length >= 120 ? 15 : summary.length >= 50 ? 10 : summary.length > 0 ? 5 : 0;

  let experienceOrProjectScore = 0;
  if (isFresher) {
    experienceOrProjectScore = Math.min(
      25,
      projects.length * 8 + internships.length * 9 + certs.length * 3 + experience.length * 8
    );
  } else {
    experienceOrProjectScore = Math.min(25, experience.length * 10 + projects.length * 5);
  }

  const educationScore = education.length > 0 ? 15 : 0;
  const skillsScore = Math.min(15, techSkills.length * 2);
  const structureScore = (education.length > 0 ? 5 : 0) + (techSkills.length > 2 ? 5 : 0);

  const categories = [
    { name: 'Contact & Links', score: contactScore, maxScore: 20, notes: 'Name, email, phone, location, and profile links.' },
    { name: 'Summary / Objective', score: summaryScore, maxScore: 15, notes: 'Clarity and role alignment of opening statement.' },
    {
      name: isFresher ? 'Projects, Internships & Certs' : 'Work Experience & Impact',
      score: experienceOrProjectScore,
      maxScore: 25,
      notes: isFresher
        ? 'Evaluated on projects, internships, and certifications without penalizing lack of full-time history.'
        : 'Evaluated on depth of roles, action verbs, and clarity.',
    },
    { name: 'Education & Credentials', score: educationScore, maxScore: 15, notes: 'Institution, degree, and graduation timeline.' },
    { name: 'Skills & Keyword Density', score: skillsScore, maxScore: 15, notes: 'Relevant technical and domain competencies.' },
    { name: 'ATS Structure & Readability', score: structureScore, maxScore: 10, notes: 'Standard section headings and parseable layout.' },
  ];

  const total = categories.reduce((acc, c) => acc + c.score, 0);
  return { categories, overallScore: Math.min(100, total) };
}

aiRouter.post('/ats-analyze', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    resumeId: z.string().nullable().optional(),
    resumeContent: z.record(z.string(), z.unknown()),
    jobDescription: z.string().max(10000).optional().default(''),
    isFresher: z.boolean().optional().default(false),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid ATS analysis request.' });
    return;
  }

  const entitlements = getUserEntitlements(req.user!.id);
  if (!entitlements.canRunAts) {
    res.status(403).json({
      code: 'ENTITLEMENT_REQUIRED',
      error: 'You have used your 1 free basic ATS analysis. Upgrade to Premium for unlimited ATS checks.',
      entitlements,
    });
    return;
  }

  const heuristic = computeTransparentHeuristicAts(parsed.data.resumeContent, parsed.data.isFresher);

  let aiEvaluation: {
    strengths: string[];
    weaknesses: string[];
    missingInformation: string[];
    recommendations: string[];
    parsingRisks: string[];
    jobMatchScore: number | null;
  } = {
    strengths: heuristic.overallScore >= 65 ? ['Clear core resume sections present'] : [],
    weaknesses: heuristic.overallScore < 65 ? ['Several core resume sections are sparse or incomplete'] : [],
    missingInformation: [],
    recommendations: ['Add specific technologies and measurable outcomes where applicable.'],
    parsingRisks: ['Ensure dates use consistent MMM YYYY formatting.'],
    jobMatchScore: null,
  };

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      const geminiResult = await aiProvider.generateJson<typeof aiEvaluation>({
        systemInstruction: `${ANTI_FABRICATION_SYSTEM_RULE}
Evaluate this resume transparently. ${
          parsed.data.isFresher
            ? 'This is a FRESHER/STUDENT resume: DO NOT penalize for lack of prior full-time work experience; evaluate projects, education, skills, internships, and coursework.'
            : ''
        }
Never guarantee passing every ATS. Clearly separate general resume quality from job-specific match.`,
        prompt: JSON.stringify({
          resume: parsed.data.resumeContent,
          jobDescription: parsed.data.jobDescription || null,
          baselineScore: heuristic.overallScore,
        }),
        schema: {
          type: Type.OBJECT,
          properties: {
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingInformation: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            parsingRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
            jobMatchScore: { type: Type.INTEGER, nullable: true },
          },
          required: ['strengths', 'weaknesses', 'missingInformation', 'recommendations', 'parsingRisks'],
        },
      });
      aiEvaluation = {
        ...geminiResult,
        jobMatchScore: parsed.data.jobDescription.trim() ? geminiResult.jobMatchScore ?? null : null,
      };
      logAiUsage(req.user!.id, 'ats_analysis', 'success', 600);
    } catch (err) {
      logAiUsage(req.user!.id, 'ats_analysis', 'error', 0, err instanceof Error ? err.message : 'AI error');
    }
  }

  const fullResult = {
    resumeId: parsed.data.resumeId || null,
    analysisType: parsed.data.jobDescription.trim()
      ? 'job_match'
      : parsed.data.isFresher
      ? 'fresher'
      : 'general',
    overallScore: heuristic.overallScore,
    jobMatchScore: aiEvaluation.jobMatchScore,
    categories: heuristic.categories,
    strengths: aiEvaluation.strengths,
    weaknesses: aiEvaluation.weaknesses,
    missingInformation: aiEvaluation.missingInformation,
    recommendations: aiEvaluation.recommendations,
    parsingRisks: aiEvaluation.parsingRisks,
  };

  const analysisId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ats_analyses (id, user_id, resume_id, analysis_type, overall_score, job_match_score, result_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    analysisId,
    req.user!.id,
    parsed.data.resumeId || null,
    fullResult.analysisType,
    fullResult.overallScore,
    fullResult.jobMatchScore,
    JSON.stringify(fullResult),
    now
  );

  incrementAtsUsage(req.user!.id);

  res.json({
    analysis: { id: analysisId, ...fullResult, createdAt: now },
    entitlements: getUserEntitlements(req.user!.id),
  });
});

aiRouter.get('/ats-history', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM ats_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`)
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({
    analyses: rows.map((r) => ({
      id: String(r.id),
      ...JSON.parse(String(r.result_json)),
      createdAt: String(r.created_at),
    })),
  });
});

aiRouter.post('/job-match', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    resumeId: z.string(),
    jobTitle: z.string().max(150).optional().default(''),
    companyName: z.string().max(150).optional().default(''),
    jobDescription: z.string().min(40).max(15000),
    tailorResume: z.boolean().optional().default(false),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please paste a job description (at least 40 characters).' });
    return;
  }

  const entitlements = getUserEntitlements(req.user!.id);
  if (entitlements.plan !== 'premium' && parsed.data.tailorResume) {
    res.status(403).json({
      code: 'ENTITLEMENT_REQUIRED',
      error: 'One-click AI resume tailoring creates a tailored resume version and requires Premium.',
      entitlements,
    });
    return;
  }

  const resumeRow = db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(parsed.data.resumeId, req.user!.id) as Record<string, unknown> | undefined;
  if (!resumeRow) {
    res.status(404).json({ error: 'Selected resume not found.' });
    return;
  }

  const resumeContent = JSON.parse(String(resumeRow.content_json));

  try {
    const match = await aiProvider.generateJson<{
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
      tailoredSummary?: string;
    }>({
      systemInstruction: `${ANTI_FABRICATION_SYSTEM_RULE}
Compare the candidate resume against the job description. Never add skills or experience the candidate does not already possess.`,
      prompt: JSON.stringify({
        resume: resumeContent,
        jobDescription: parsed.data.jobDescription,
        providedJobTitle: parsed.data.jobTitle,
        providedCompanyName: parsed.data.companyName,
      }),
      schema: {
        type: Type.OBJECT,
        properties: {
          jobTitle: { type: Type.STRING },
          companyName: { type: Type.STRING },
          matchScore: { type: Type.INTEGER },
          requiredQualifications: { type: Type.ARRAY, items: { type: Type.STRING } },
          preferredQualifications: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          skillGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          relevantExperienceHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          tailoredSummary: { type: Type.STRING },
        },
        required: [
          'jobTitle',
          'matchScore',
          'matchingKeywords',
          'missingKeywords',
          'skillGaps',
          'recommendations',
        ],
      },
    });

    const jdId = crypto.randomUUID();
    const matchId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO job_descriptions (id, user_id, job_title, company_name, raw_text, extracted_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      jdId,
      req.user!.id,
      match.jobTitle || parsed.data.jobTitle || 'Target Role',
      match.companyName || parsed.data.companyName || '',
      parsed.data.jobDescription,
      JSON.stringify({
        requiredQualifications: match.requiredQualifications,
        preferredQualifications: match.preferredQualifications,
      }),
      now
    );

    db.prepare(`
      INSERT INTO job_matches (id, user_id, resume_id, job_description_id, job_title, company_name, match_score, result_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      matchId,
      req.user!.id,
      parsed.data.resumeId,
      jdId,
      match.jobTitle || parsed.data.jobTitle || 'Target Role',
      match.companyName || parsed.data.companyName || '',
      match.matchScore,
      JSON.stringify(match),
      now
    );

    let tailoredResumeId: string | null = null;
    if (parsed.data.tailorResume && match.tailoredSummary) {
      // Save as a separate tailored resume version without overwriting master resume
      const tailoredContent = {
        ...resumeContent,
        summary: match.tailoredSummary,
        personal: {
          ...(resumeContent.personal || {}),
          targetRole: match.jobTitle || resumeContent.personal?.targetRole || '',
        },
      };
      tailoredResumeId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO resumes (id, user_id, title, target_role, builder_type, template_id, content_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tailoredResumeId,
        req.user!.id,
        `${String(resumeRow.title)} — ${match.companyName || match.jobTitle || 'Tailored'}`,
        match.jobTitle || String(resumeRow.target_role),
        String(resumeRow.builder_type),
        String(resumeRow.template_id),
        JSON.stringify(tailoredContent),
        now,
        now
      );
    }

    logAiUsage(req.user!.id, 'job_match', 'success', 650);
    res.json({
      match: { id: matchId, resumeId: parsed.data.resumeId, ...match, createdAt: now },
      tailoredResumeId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Job match failed.';
    logAiUsage(req.user!.id, 'job_match', 'error', 0, msg);
    res.status(500).json({ error: msg });
  }
});

aiRouter.get('/job-matches', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM job_matches WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`)
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({
    matches: rows.map((r) => ({
      id: String(r.id),
      resumeId: String(r.resume_id),
      ...JSON.parse(String(r.result_json)),
      createdAt: String(r.created_at),
    })),
  });
});

aiRouter.get('/cover-letters', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM cover_letters WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({
    coverLetters: rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      resumeId: r.resume_id ? String(r.resume_id) : null,
      jobTitle: String(r.job_title),
      companyName: String(r.company_name),
      hiringManager: String(r.hiring_manager || ''),
      tone: String(r.tone),
      content: String(r.content),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    })),
  });
});

aiRouter.post('/cover-letter', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    resumeId: z.string().nullable().optional(),
    jobTitle: z.string().min(2).max(140),
    companyName: z.string().min(1).max(140),
    hiringManager: z.string().max(120).optional().default(''),
    jobDescription: z.string().max(8000).optional().default(''),
    tone: z.enum(['professional', 'enthusiastic', 'executive', 'fresher']).optional().default('professional'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Job title and company name are required.' });
    return;
  }

  let resumeContext: unknown = null;
  if (parsed.data.resumeId) {
    const r = db
      .prepare(`SELECT content_json FROM resumes WHERE id = ? AND user_id = ?`)
      .get(parsed.data.resumeId, req.user!.id) as { content_json: string } | undefined;
    if (r) resumeContext = JSON.parse(r.content_json);
  }

  try {
    const text = await aiProvider.generateText({
      systemInstruction: `${ANTI_FABRICATION_SYSTEM_RULE}
Write a tailored, sincere, well-structured cover letter in ${parsed.data.tone} tone based strictly on the candidate's resume context.`,
      prompt: JSON.stringify({ ...parsed.data, resume: resumeContext }),
    });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO cover_letters (id, user_id, resume_id, job_title, company_name, hiring_manager, tone, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user!.id,
      parsed.data.resumeId || null,
      parsed.data.jobTitle,
      parsed.data.companyName,
      parsed.data.hiringManager,
      parsed.data.tone,
      text,
      now,
      now
    );

    logAiUsage(req.user!.id, 'cover_letter', 'success', 550);
    res.status(201).json({
      coverLetter: {
        id,
        userId: req.user!.id,
        resumeId: parsed.data.resumeId || null,
        jobTitle: parsed.data.jobTitle,
        companyName: parsed.data.companyName,
        hiringManager: parsed.data.hiringManager,
        tone: parsed.data.tone,
        content: text,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cover letter generation failed.';
    logAiUsage(req.user!.id, 'cover_letter', 'error', 0, msg);
    res.status(500).json({ error: msg });
  }
});

aiRouter.put('/cover-letters/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare(`SELECT id FROM cover_letters WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Cover letter not found.' });
    return;
  }
  db.prepare(`UPDATE cover_letters SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?`).run(
    String(req.body?.content || ''),
    new Date().toISOString(),
    req.params.id,
    req.user!.id
  );
  res.json({ ok: true });
});

aiRouter.delete('/cover-letters/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare(`DELETE FROM cover_letters WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
  res.json({ deleted: true });
});

aiRouter.post('/career-tool', requireAuth, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    tool: z.enum([
      'linkedin_headline',
      'linkedin_about',
      'linkedin_experience',
      'career_objective',
      'interview_hr',
      'interview_technical',
      'star_answer',
      'mock_interview',
      'skills_gap',
      'professional_email',
    ]),
    targetRole: z.string().max(140).optional().default(''),
    resumeId: z.string().nullable().optional(),
    input: z.string().max(5000).optional().default(''),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid career tool parameters.' });
    return;
  }

  let resumeContext: unknown = null;
  if (parsed.data.resumeId) {
    const r = db
      .prepare(`SELECT content_json FROM resumes WHERE id = ? AND user_id = ?`)
      .get(parsed.data.resumeId, req.user!.id) as { content_json: string } | undefined;
    if (r) resumeContext = JSON.parse(r.content_json);
  }

  const limit = checkAiRateLimit(req.user!.id);
  if (!limit.allowed) {
    res.status(429).json({ error: `Rate limit reached. Try again in ${limit.retryAfterSec}s.` });
    return;
  }

  try {
    const output = await aiProvider.generateText({
      systemInstruction: `${ANTI_FABRICATION_SYSTEM_RULE}
You are an executive career coach. Execute tool "${parsed.data.tool}" for target role "${parsed.data.targetRole}" using only truthful details from the user's resume and prompt.`,
      prompt: JSON.stringify({ input: parsed.data.input, resume: resumeContext }),
    });
    logAiUsage(req.user!.id, `career_tool_${parsed.data.tool}`, 'success', 450);
    res.json({ output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Career tool request failed.';
    logAiUsage(req.user!.id, `career_tool_${parsed.data.tool}`, 'error', 0, msg);
    res.status(500).json({ error: msg });
  }
});
