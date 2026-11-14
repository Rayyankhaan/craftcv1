import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db.ts';

export const SESSION_COOKIE_NAME = 'craftcv_session';
const SESSION_TTL_DAYS = 30;

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  fullName: string;
  role: 'user' | 'admin';
  careerStage: string | null;
  currentEducation: string | null;
  targetJobRole: string | null;
  experienceLevel: string | null;
  mainCareerGoal: string | null;
  onboardingCompleted: boolean;
  isSuspended: boolean;
  createdAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sessionId?: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(userId: string, req: Request): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const sessionId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    userId,
    tokenHash,
    String(req.headers['user-agent'] || '').slice(0, 200),
    String(req.ip || '').slice(0, 64),
    expires.toISOString(),
    now.toISOString()
  );

  return rawToken;
}

export function setSessionCookie(res: Response, rawToken: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    path: '/',
  });
}

export function getUserBySessionToken(rawToken: string | undefined): { user: AuthenticatedUser; sessionId: string } | null {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const nowIso = new Date().toISOString();

  const row = db.prepare(`
    SELECT s.id as session_id, s.expires_at, p.*
    FROM sessions s
    JOIN profiles p ON p.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash, nowIso) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    sessionId: String(row.session_id),
    user: {
      id: String(row.id),
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      emailVerified: Boolean(row.email_verified),
      phoneVerified: Boolean(row.phone_verified),
      fullName: String(row.full_name || ''),
      role: row.role === 'admin' ? 'admin' : 'user',
      careerStage: row.career_stage ? String(row.career_stage) : null,
      currentEducation: row.current_education ? String(row.current_education) : null,
      targetJobRole: row.target_job_role ? String(row.target_job_role) : null,
      experienceLevel: row.experience_level ? String(row.experience_level) : null,
      mainCareerGoal: row.main_career_goal ? String(row.main_career_goal) : null,
      onboardingCompleted: Boolean(row.onboarding_completed),
      isSuspended: Boolean(row.is_suspended),
      createdAt: String(row.created_at),
    },
  };
}

export function attachAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const found = getUserBySessionToken(rawToken);
  if (found && !found.user.isSuspended) {
    req.user = found.user;
    req.sessionId = found.sessionId;
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  if (req.user.isSuspended) {
    res.status(403).json({ error: 'This account has been suspended.' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  next();
}

export function ensureUserAuxiliaryRecords(userId: string): void {
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO user_usage (user_id, updated_at) VALUES (?, ?)`).run(userId, now);
  db.prepare(`INSERT OR IGNORE INTO user_preferences (user_id, updated_at) VALUES (?, ?)`).run(userId, now);
}
