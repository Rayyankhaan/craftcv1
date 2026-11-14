import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { AuthenticatedRequest, requireAuth } from '../services/auth.ts';

export const supportRouter = Router();

supportRouter.get('/tickets', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({
    tickets: rows.map((t) => ({
      id: String(t.id),
      email: String(t.email),
      subject: String(t.subject),
      category: String(t.category),
      message: String(t.message),
      status: String(t.status),
      adminReply: t.admin_reply ? String(t.admin_reply) : null,
      createdAt: String(t.created_at),
    })),
  });
});

supportRouter.post('/tickets', (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    email: z.string().trim().email(),
    subject: z.string().trim().min(3).max(160),
    category: z.enum(['general', 'billing', 'ats', 'bug', 'privacy']).optional().default('general'),
    message: z.string().trim().min(10).max(3000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please complete all support fields.' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO support_tickets (id, user_id, email, subject, category, message, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)
  `).run(
    id,
    req.user?.id || null,
    parsed.data.email.toLowerCase(),
    parsed.data.subject,
    parsed.data.category,
    parsed.data.message,
    now,
    now
  );

  res.status(201).json({
    ticket: {
      id,
      email: parsed.data.email.toLowerCase(),
      subject: parsed.data.subject,
      category: parsed.data.category,
      message: parsed.data.message,
      status: 'open',
      createdAt: now,
    },
  });
});
