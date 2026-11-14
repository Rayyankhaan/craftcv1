import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db, logAudit } from '../db.ts';
import { AuthenticatedRequest, requireAuth } from '../services/auth.ts';
import {
  getUserEntitlements,
  incrementResumeCreatedUsage,
  incrementDownloadUsage,
} from '../services/entitlements.ts';

export const resumesRouter = Router();

const createResumeSchema = z.object({
  title: z.string().trim().min(1).max(140),
  targetRole: z.string().trim().max(140).optional().default(''),
  builderType: z.enum(['standard', 'fresher']).optional().default('standard'),
  templateId: z.string().trim().min(1).max(80).optional().default('ats-classic'),
  content: z.record(z.string(), z.unknown()),
});

function formatResumeRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    targetRole: String(row.target_role || ''),
    builderType: row.builder_type === 'fresher' ? 'fresher' : 'standard',
    templateId: String(row.template_id),
    content: JSON.parse(String(row.content_json)),
    shareToken: row.share_token ? String(row.share_token) : null,
    isPublic: Boolean(row.is_public),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

resumesRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({ resumes: rows.map(formatResumeRow) });
});

resumesRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = createResumeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid resume payload.' });
    return;
  }

  const entitlements = getUserEntitlements(req.user!.id);
  if (!entitlements.canCreateResume) {
    res.status(403).json({
      code: 'ENTITLEMENT_REQUIRED',
      error: 'Free plan limit reached (1 total resume across standard and fresher builders). Upgrade to Premium to create more resumes.',
      entitlements,
    });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const contentJson = JSON.stringify(parsed.data.content);

  const createTx = () => {
    db.exec('BEGIN');
    try {
      db.prepare(`
        INSERT INTO resumes (id, user_id, title, target_role, builder_type, template_id, content_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.user!.id,
        parsed.data.title,
        parsed.data.targetRole,
        parsed.data.builderType,
        parsed.data.templateId,
        contentJson,
        now,
        now
      );

      db.prepare(`
        INSERT INTO resume_versions (id, resume_id, user_id, version_number, label, template_id, content_json, created_at)
        VALUES (?, ?, ?, 1, 'Initial Version', ?, ?, ?)
      `).run(crypto.randomUUID(), id, req.user!.id, parsed.data.templateId, contentJson, now);

      incrementResumeCreatedUsage(req.user!.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  createTx();
  logAudit(req.user!.id, 'RESUME_CREATED', 'resume', id, { builderType: parsed.data.builderType });

  const row = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(id) as Record<string, unknown>;
  res.status(201).json({
    resume: formatResumeRow(row),
    entitlements: getUserEntitlements(req.user!.id),
  });
});

resumesRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const row = db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Resume not found.' });
    return;
  }
  res.json({ resume: formatResumeRow(row) });
});

resumesRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Resume not found.' });
    return;
  }

  const title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : String(existing.title);
  const targetRole = typeof req.body.targetRole === 'string' ? req.body.targetRole.trim() : String(existing.target_role);
  const templateId = typeof req.body.templateId === 'string' && req.body.templateId.trim() ? req.body.templateId.trim() : String(existing.template_id);
  const contentJson = req.body.content ? JSON.stringify(req.body.content) : String(existing.content_json);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE resumes
    SET title = ?, target_role = ?, template_id = ?, content_json = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(title, targetRole, templateId, contentJson, now, req.params.id, req.user!.id);

  if (req.body.createVersion) {
    const last = db
      .prepare(`SELECT MAX(version_number) as max_ver FROM resume_versions WHERE resume_id = ?`)
      .get(req.params.id) as { max_ver: number | null };
    const nextVer = (last.max_ver || 0) + 1;
    const label = typeof req.body.versionLabel === 'string' && req.body.versionLabel.trim()
      ? req.body.versionLabel.trim()
      : `Saved Snapshot v${nextVer}`;
    db.prepare(`
      INSERT INTO resume_versions (id, resume_id, user_id, version_number, label, template_id, content_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), req.params.id, req.user!.id, nextVer, label, templateId, contentJson, now);
  }

  const updated = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(req.params.id) as Record<string, unknown>;
  res.json({ resume: formatResumeRow(updated) });
});

resumesRouter.post('/:id/duplicate', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Resume not found.' });
    return;
  }

  const entitlements = getUserEntitlements(req.user!.id);
  if (!entitlements.canCreateResume) {
    res.status(403).json({
      code: 'ENTITLEMENT_REQUIRED',
      error: 'Creating a duplicate resume requires a Premium plan.',
      entitlements,
    });
    return;
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const newTitle = typeof req.body?.title === 'string' && req.body.title.trim()
    ? req.body.title.trim()
    : `${String(existing.title)} (Copy)`;

  db.prepare(`
    INSERT INTO resumes (id, user_id, title, target_role, builder_type, template_id, content_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    req.user!.id,
    newTitle,
    String(existing.target_role),
    String(existing.builder_type),
    String(existing.template_id),
    String(existing.content_json),
    now,
    now
  );

  db.prepare(`
    INSERT INTO resume_versions (id, resume_id, user_id, version_number, label, template_id, content_json, created_at)
    VALUES (?, ?, ?, 1, 'Duplicated Version', ?, ?, ?)
  `).run(crypto.randomUUID(), newId, req.user!.id, String(existing.template_id), String(existing.content_json), now);

  incrementResumeCreatedUsage(req.user!.id);
  const created = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(newId) as Record<string, unknown>;
  res.status(201).json({
    resume: formatResumeRow(created),
    entitlements: getUserEntitlements(req.user!.id),
  });
});

resumesRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare(`SELECT id FROM resumes WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Resume not found.' });
    return;
  }
  // Note: Deleting a resume does NOT decrement user_usage.resumes_created_count
  db.prepare(`DELETE FROM resumes WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
  logAudit(req.user!.id, 'RESUME_DELETED', 'resume', String(req.params.id));
  res.json({ deleted: true, entitlements: getUserEntitlements(req.user!.id) });
});

resumesRouter.get('/:id/versions', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM resume_versions WHERE resume_id = ? AND user_id = ? ORDER BY version_number DESC`)
    .all(req.params.id, req.user!.id) as Record<string, unknown>[];
  res.json({
    versions: rows.map((v) => ({
      id: String(v.id),
      resumeId: String(v.resume_id),
      versionNumber: Number(v.version_number),
      label: String(v.label),
      templateId: String(v.template_id),
      content: JSON.parse(String(v.content_json)),
      createdAt: String(v.created_at),
    })),
  });
});

resumesRouter.post('/:id/versions/:versionId/restore', requireAuth, (req: AuthenticatedRequest, res) => {
  const ver = db
    .prepare(`SELECT * FROM resume_versions WHERE id = ? AND resume_id = ? AND user_id = ?`)
    .get(req.params.versionId, req.params.id, req.user!.id) as Record<string, unknown> | undefined;
  if (!ver) {
    res.status(404).json({ error: 'Version not found.' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE resumes SET template_id = ?, content_json = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `).run(String(ver.template_id), String(ver.content_json), now, req.params.id, req.user!.id);

  const updated = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(req.params.id) as Record<string, unknown>;
  res.json({ resume: formatResumeRow(updated) });
});

resumesRouter.post('/:id/share', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare(`SELECT * FROM resumes WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Resume not found.' });
    return;
  }

  const enable = Boolean(req.body?.isPublic);
  const shareToken = enable
    ? (existing.share_token ? String(existing.share_token) : crypto.randomBytes(12).toString('hex'))
    : null;

  db.prepare(`UPDATE resumes SET is_public = ?, share_token = ?, updated_at = ? WHERE id = ?`).run(
    enable ? 1 : 0,
    shareToken,
    new Date().toISOString(),
    req.params.id
  );

  res.json({ isPublic: enable, shareToken });
});

resumesRouter.post('/:id/track-download', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare(`SELECT id FROM resumes WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Resume not found.' });
    return;
  }
  incrementDownloadUsage(req.user!.id);
  logAudit(req.user!.id, 'RESUME_DOWNLOADED', 'resume', String(req.params.id), {
    format: String(req.body?.format || 'pdf'),
  });
  res.json({ ok: true });
});

export const publicResumeRouter = Router();
publicResumeRouter.get('/:shareToken', (req, res) => {
  const row = db
    .prepare(`SELECT * FROM resumes WHERE share_token = ? AND is_public = 1`)
    .get(req.params.shareToken) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Shared resume link is invalid or has been revoked.' });
    return;
  }
  res.json({ resume: formatResumeRow(row) });
});
