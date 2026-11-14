import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { AuthenticatedRequest, requireAuth } from '../services/auth.ts';

export const jobsRouter = Router();

const jobSchema = z.object({
  company: z.string().trim().min(1).max(150),
  position: z.string().trim().min(1).max(150),
  jobUrl: z.string().trim().max(500).optional().default(''),
  applicationDate: z.string().trim().max(40).optional().default(''),
  status: z.enum(['Interested', 'Applied', 'Assessment', 'Interview', 'Offer', 'Rejected']).default('Applied'),
  notes: z.string().max(2000).optional().default(''),
  resumeVersionLabel: z.string().max(150).optional().default(''),
  interviewDate: z.string().max(40).optional().default(''),
});

jobsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM job_applications WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({
    applications: rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      company: String(r.company),
      position: String(r.position),
      jobUrl: String(r.job_url || ''),
      applicationDate: String(r.application_date || ''),
      status: String(r.status),
      notes: String(r.notes || ''),
      resumeVersionLabel: String(r.resume_version_label || ''),
      interviewDate: String(r.interview_date || ''),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    })),
  });
});

jobsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Company and position are required.' });
    return;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO job_applications (
      id, user_id, company, position, job_url, application_date, status, notes, resume_version_label, interview_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.id,
    parsed.data.company,
    parsed.data.position,
    parsed.data.jobUrl,
    parsed.data.applicationDate || now.slice(0, 10),
    parsed.data.status,
    parsed.data.notes,
    parsed.data.resumeVersionLabel,
    parsed.data.interviewDate,
    now,
    now
  );

  const row = db.prepare(`SELECT * FROM job_applications WHERE id = ?`).get(id) as Record<string, unknown>;
  res.status(201).json({
    application: {
      id: String(row.id),
      userId: String(row.user_id),
      company: String(row.company),
      position: String(row.position),
      jobUrl: String(row.job_url || ''),
      applicationDate: String(row.application_date || ''),
      status: String(row.status),
      notes: String(row.notes || ''),
      resumeVersionLabel: String(row.resume_version_label || ''),
      interviewDate: String(row.interview_date || ''),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    },
  });
});

jobsRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare(`SELECT * FROM job_applications WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Job application not found.' });
    return;
  }

  const parsed = jobSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid fields.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE job_applications
    SET company = ?, position = ?, job_url = ?, application_date = ?, status = ?, notes = ?, resume_version_label = ?, interview_date = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    parsed.data.company ?? String(existing.company),
    parsed.data.position ?? String(existing.position),
    parsed.data.jobUrl ?? String(existing.job_url),
    parsed.data.applicationDate ?? String(existing.application_date),
    parsed.data.status ?? String(existing.status),
    parsed.data.notes ?? String(existing.notes),
    parsed.data.resumeVersionLabel ?? String(existing.resume_version_label),
    parsed.data.interviewDate ?? String(existing.interview_date),
    now,
    req.params.id,
    req.user!.id
  );
  res.json({ ok: true });
});

jobsRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare(`DELETE FROM job_applications WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
  res.json({ deleted: true });
});
