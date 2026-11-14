import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db, hashPassword, verifyPassword, logAudit, getPlatformSetting } from '../db.ts';
import {
  AuthenticatedRequest,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  ensureUserAuxiliaryRecords,
} from '../services/auth.ts';
import { getUserEntitlements } from '../services/entitlements.ts';

export const authRouter = Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const phoneSendSchema = z.object({
  countryCode: z.string().regex(/^\+\d{1,4}$/),
  phone: z.string().regex(/^\d{6,14}$/),
});

const phoneVerifySchema = z.object({
  countryCode: z.string().regex(/^\+\d{1,4}$/),
  phone: z.string().regex(/^\d{6,14}$/),
  otp: z.string().regex(/^\d{6}$/),
  fullName: z.string().trim().min(2).max(100).optional(),
});

function getProviderConfigFlags() {
  return {
    googleOAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    smsProviderConfigured: Boolean(
      process.env.SMS_PROVIDER && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ),
    razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  };
}

authRouter.get('/me', (req: AuthenticatedRequest, res) => {
  const providers = getProviderConfigFlags();
  const announcement = getPlatformSetting<string>('announcement', '');
  const disabledTemplateIds = getPlatformSetting<string[]>('disabledTemplateIds', []);

  if (!req.user) {
    res.json({
      user: null,
      entitlements: null,
      providers,
      platform: {
        announcement,
        disabledTemplateIds,
        premiumPriceInr: getPlatformSetting<number>('premiumPriceInr', 99),
        billingInterval: getPlatformSetting<string>('billingInterval', 'monthly'),
      },
    });
    return;
  }

  const entitlements = getUserEntitlements(req.user.id);
  res.json({
    user: req.user,
    entitlements,
    providers,
    platform: {
      announcement,
      disabledTemplateIds,
      premiumPriceInr: entitlements.priceInr,
      billingInterval: entitlements.billingInterval,
    },
  });
});

authRouter.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration details.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const existing = db.prepare(`SELECT id FROM profiles WHERE email = ?`).get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const verifyToken = crypto.randomInt(100000, 999999).toString();

  db.prepare(`
    INSERT INTO profiles (
      id, email, password_hash, email_verified, email_verify_token,
      full_name, role, onboarding_completed, created_at, updated_at
    ) VALUES (?, ?, ?, 0, ?, ?, 'user', 0, ?, ?)
  `).run(id, email, hashPassword(parsed.data.password), verifyToken, parsed.data.fullName, now, now);

  ensureUserAuxiliaryRecords(id);
  logAudit(id, 'USER_REGISTERED', 'profile', id, { method: 'email' });

  const sessionToken = createSession(id, req);
  setSessionCookie(res, sessionToken);

  const user = db.prepare(`SELECT * FROM profiles WHERE id = ?`).get(id) as Record<string, unknown>;
  res.status(201).json({
    user: {
      id: String(user.id),
      email: String(user.email),
      phone: null,
      emailVerified: false,
      phoneVerified: false,
      fullName: String(user.full_name),
      role: 'user',
      onboardingCompleted: false,
      createdAt: String(user.created_at),
    },
    entitlements: getUserEntitlements(id),
    verificationNote: `Verification code generated: ${verifyToken} (SMTP email delivery requires mail server configuration).`,
  });
});

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please provide a valid email and password.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const user = db.prepare(`SELECT * FROM profiles WHERE email = ?`).get(email) as
    | Record<string, unknown>
    | undefined;

  if (!user || !user.password_hash || !verifyPassword(parsed.data.password, String(user.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (user.is_suspended) {
    res.status(403).json({ error: 'This account has been suspended. Contact support.' });
    return;
  }

  const sessionToken = createSession(String(user.id), req);
  setSessionCookie(res, sessionToken);
  logAudit(String(user.id), 'USER_LOGIN', 'profile', String(user.id), { method: 'email' });

  res.json({
    user: {
      id: String(user.id),
      email: String(user.email),
      phone: user.phone ? String(user.phone) : null,
      emailVerified: Boolean(user.email_verified),
      phoneVerified: Boolean(user.phone_verified),
      fullName: String(user.full_name),
      role: user.role === 'admin' ? 'admin' : 'user',
      careerStage: user.career_stage ? String(user.career_stage) : null,
      currentEducation: user.current_education ? String(user.current_education) : null,
      targetJobRole: user.target_job_role ? String(user.target_job_role) : null,
      experienceLevel: user.experience_level ? String(user.experience_level) : null,
      mainCareerGoal: user.main_career_goal ? String(user.main_career_goal) : null,
      onboardingCompleted: Boolean(user.onboarding_completed),
      createdAt: String(user.created_at),
    },
    entitlements: getUserEntitlements(String(user.id)),
  });
});

authRouter.post('/verify-email', requireAuth, (req: AuthenticatedRequest, res) => {
  const code = String(req.body?.code || '').trim();
  const profile = db.prepare(`SELECT email_verify_token FROM profiles WHERE id = ?`).get(req.user!.id) as
    | { email_verify_token: string | null }
    | undefined;
  if (!profile?.email_verify_token || profile.email_verify_token !== code) {
    res.status(400).json({ error: 'Invalid email verification code.' });
    return;
  }
  db.prepare(`UPDATE profiles SET email_verified = 1, email_verify_token = NULL, updated_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    req.user!.id
  );
  res.json({ verified: true });
});

authRouter.post('/forgot-password', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }
  const user = db.prepare(`SELECT id FROM profiles WHERE email = ?`).get(email) as { id: string } | undefined;
  if (!user) {
    // Return uniform response
    res.json({ message: 'If an account matches this email, a password reset code has been prepared.' });
    return;
  }
  const resetToken = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(`UPDATE profiles SET reset_token = ?, reset_token_expires_at = ?, updated_at = ? WHERE id = ?`).run(
    resetToken,
    expiresAt,
    new Date().toISOString(),
    user.id
  );
  res.json({
    message: 'Password reset code generated.',
    devResetCodeHint:
      process.env.NODE_ENV !== 'production'
        ? `Local dev reset code: ${resetToken} (configure SMTP to deliver reset emails in production).`
        : undefined,
  });
});

authRouter.post('/reset-password', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  if (!email || !code || newPassword.length < 8) {
    res.status(400).json({ error: 'Valid email, reset code, and new password (8+ chars) are required.' });
    return;
  }

  const user = db.prepare(`SELECT id, reset_token, reset_token_expires_at FROM profiles WHERE email = ?`).get(
    email
  ) as { id: string; reset_token: string | null; reset_token_expires_at: string | null } | undefined;

  if (
    !user ||
    !user.reset_token ||
    user.reset_token !== code ||
    !user.reset_token_expires_at ||
    user.reset_token_expires_at < new Date().toISOString()
  ) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  db.prepare(`
    UPDATE profiles
    SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, updated_at = ?
    WHERE id = ?
  `).run(hashPassword(newPassword), new Date().toISOString(), user.id);

  res.json({ message: 'Password updated. You can now sign in.' });
});

authRouter.post('/phone/send-otp', (req, res) => {
  const parsed = phoneSendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a valid country code and phone number.' });
    return;
  }

  const fullPhone = `${parsed.data.countryCode}${parsed.data.phone}`;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentCount = db
    .prepare(`SELECT COUNT(*) as cnt FROM otp_codes WHERE phone = ? AND created_at > ?`)
    .get(fullPhone, oneHourAgo) as { cnt: number };

  if (recentCount.cnt >= 5) {
    res.status(429).json({ error: 'Too many OTP requests. Please try again after 1 hour.' });
    return;
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const codeHash = crypto.createHash('sha256').update(otp).digest('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 5 * 60 * 1000);

  db.prepare(`
    INSERT INTO otp_codes (id, phone, code_hash, attempts, expires_at, used, created_at)
    VALUES (?, ?, ?, 0, ?, 0, ?)
  `).run(crypto.randomUUID(), fullPhone, codeHash, expires.toISOString(), now.toISOString());

  const smsConfigured = Boolean(
    process.env.SMS_PROVIDER && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  );

  res.json({
    sent: true,
    smsProviderConfigured: smsConfigured,
    expiresInSeconds: 300,
    notice: smsConfigured
      ? 'OTP sent via configured SMS provider.'
      : `SMS provider credentials (Twilio/MSG91) are not configured. Sandbox test OTP: ${otp}`,
  });
});

authRouter.post('/phone/verify-otp', (req: AuthenticatedRequest, res) => {
  const parsed = phoneVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter a valid phone number and 6-digit OTP.' });
    return;
  }

  const fullPhone = `${parsed.data.countryCode}${parsed.data.phone}`;
  const otpRecord = db.prepare(`
    SELECT * FROM otp_codes
    WHERE phone = ? AND used = 0
    ORDER BY created_at DESC
    LIMIT 1
  `).get(fullPhone) as
    | { id: string; code_hash: string; attempts: number; expires_at: string }
    | undefined;

  if (!otpRecord) {
    res.status(400).json({ error: 'No active OTP found. Please request a new code.' });
    return;
  }
  if (otpRecord.expires_at < new Date().toISOString()) {
    res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
    return;
  }
  if (otpRecord.attempts >= 5) {
    res.status(429).json({ error: 'Maximum OTP attempts exceeded. Request a new OTP.' });
    return;
  }

  const providedHash = crypto.createHash('sha256').update(parsed.data.otp).digest('hex');
  if (providedHash !== otpRecord.code_hash) {
    db.prepare(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?`).run(otpRecord.id);
    res.status(400).json({ error: 'Incorrect OTP code.' });
    return;
  }

  db.prepare(`UPDATE otp_codes SET used = 1 WHERE id = ?`).run(otpRecord.id);
  const now = new Date().toISOString();

  // If already logged in, link phone to existing verified account
  if (req.user) {
    const conflict = db
      .prepare(`SELECT id FROM profiles WHERE phone = ? AND id != ?`)
      .get(fullPhone, req.user.id);
    if (conflict) {
      res.status(409).json({ error: 'This phone number is already linked to another account.' });
      return;
    }
    db.prepare(`UPDATE profiles SET phone = ?, phone_verified = 1, updated_at = ? WHERE id = ?`).run(
      fullPhone,
      now,
      req.user.id
    );
    logAudit(req.user.id, 'PHONE_LINKED', 'profile', req.user.id);
    res.json({ linked: true, phone: fullPhone });
    return;
  }

  // Otherwise sign in or create profile by phone
  let user = db.prepare(`SELECT * FROM profiles WHERE phone = ?`).get(fullPhone) as
    | Record<string, unknown>
    | undefined;

  if (!user) {
    const newId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO profiles (
        id, phone, phone_verified, full_name, role, onboarding_completed, created_at, updated_at
      ) VALUES (?, ?, 1, ?, 'user', 0, ?, ?)
    `).run(newId, fullPhone, parsed.data.fullName || 'New User', now, now);
    ensureUserAuxiliaryRecords(newId);
    logAudit(newId, 'USER_REGISTERED', 'profile', newId, { method: 'phone_otp' });
    user = db.prepare(`SELECT * FROM profiles WHERE id = ?`).get(newId) as Record<string, unknown>;
  } else {
    db.prepare(`UPDATE profiles SET phone_verified = 1, updated_at = ? WHERE id = ?`).run(now, String(user.id));
  }

  const sessionToken = createSession(String(user.id), req);
  setSessionCookie(res, sessionToken);

  res.json({
    user: {
      id: String(user.id),
      email: user.email ? String(user.email) : null,
      phone: String(user.phone),
      emailVerified: Boolean(user.email_verified),
      phoneVerified: true,
      fullName: String(user.full_name),
      role: user.role === 'admin' ? 'admin' : 'user',
      onboardingCompleted: Boolean(user.onboarding_completed),
      createdAt: String(user.created_at),
    },
    entitlements: getUserEntitlements(String(user.id)),
  });
});

authRouter.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  if (!clientId) {
    res.status(501).json({
      configured: false,
      error: 'Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment secrets.',
    });
    return;
  }
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

authRouter.get('/google/callback', async (req, res) => {
  const code = String(req.query.code || '');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  if (!code || !clientId || !clientSecret) {
    res.redirect('/?authError=google_oauth_not_configured');
    return;
  }

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      res.redirect('/?authError=google_token_failed');
      return;
    }

    const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = (await userResp.json()) as { sub: string; email: string; name?: string };
    const email = googleUser.email.toLowerCase();
    const now = new Date().toISOString();

    let user = db
      .prepare(`SELECT * FROM profiles WHERE google_id = ? OR email = ?`)
      .get(googleUser.sub, email) as Record<string, unknown> | undefined;

    if (!user) {
      const newId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO profiles (
          id, email, google_id, email_verified, full_name, role, onboarding_completed, created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, 'user', 0, ?, ?)
      `).run(newId, email, googleUser.sub, googleUser.name || email.split('@')[0], now, now);
      ensureUserAuxiliaryRecords(newId);
      user = db.prepare(`SELECT * FROM profiles WHERE id = ?`).get(newId) as Record<string, unknown>;
    } else {
      db.prepare(`UPDATE profiles SET google_id = ?, email_verified = 1, updated_at = ? WHERE id = ?`).run(
        googleUser.sub,
        now,
        String(user.id)
      );
    }

    const sessionToken = createSession(String(user.id), req);
    setSessionCookie(res, sessionToken);
    res.redirect('/?view=dashboard');
  } catch {
    res.redirect('/?authError=google_oauth_error');
  }
});

authRouter.post('/onboarding', requireAuth, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    fullName: z.string().trim().min(1).max(100),
    careerStage: z.string().trim().optional().nullable(),
    currentEducation: z.string().trim().optional().nullable(),
    targetJobRole: z.string().trim().optional().nullable(),
    experienceLevel: z.string().trim().optional().nullable(),
    mainCareerGoal: z.string().trim().optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid onboarding fields.' });
    return;
  }

  db.prepare(`
    UPDATE profiles SET
      full_name = ?,
      career_stage = ?,
      current_education = ?,
      target_job_role = ?,
      experience_level = ?,
      main_career_goal = ?,
      onboarding_completed = 1,
      updated_at = ?
    WHERE id = ?
  `).run(
    parsed.data.fullName,
    parsed.data.careerStage || null,
    parsed.data.currentEducation || null,
    parsed.data.targetJobRole || null,
    parsed.data.experienceLevel || null,
    parsed.data.mainCareerGoal || null,
    new Date().toISOString(),
    req.user!.id
  );

  res.json({ completed: true });
});

authRouter.post('/logout', (req: AuthenticatedRequest, res) => {
  if (req.sessionId) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(req.sessionId);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/sessions', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`SELECT id, user_agent, ip_address, expires_at, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({
    sessions: rows.map((r) => ({
      id: String(r.id),
      userAgent: String(r.user_agent),
      ipAddress: String(r.ip_address),
      expiresAt: String(r.expires_at),
      createdAt: String(r.created_at),
      isCurrent: String(r.id) === req.sessionId,
    })),
  });
});

authRouter.delete('/sessions/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare(`DELETE FROM sessions WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
  res.json({ ok: true });
});

authRouter.get('/export-data', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const profile = db.prepare(`SELECT id, email, phone, full_name, career_stage, current_education, target_job_role, experience_level, main_career_goal, created_at FROM profiles WHERE id = ?`).get(userId);
  const resumes = db.prepare(`SELECT id, title, target_role, builder_type, template_id, content_json, created_at, updated_at FROM resumes WHERE user_id = ?`).all(userId);
  const coverLetters = db.prepare(`SELECT * FROM cover_letters WHERE user_id = ?`).all(userId);
  const applications = db.prepare(`SELECT * FROM job_applications WHERE user_id = ?`).all(userId);
  const atsHistory = db.prepare(`SELECT * FROM ats_analyses WHERE user_id = ?`).all(userId);

  logAudit(userId, 'PERSONAL_DATA_EXPORTED', 'profile', userId);
  res.json({
    exportedAt: new Date().toISOString(),
    profile,
    resumes,
    coverLetters,
    jobApplications: applications,
    atsAnalyses: atsHistory,
  });
});

authRouter.delete('/account', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  logAudit(null, 'ACCOUNT_DELETED', 'profile', userId);
  db.prepare(`DELETE FROM profiles WHERE id = ?`).run(userId);
  clearSessionCookie(res);
  res.json({ deleted: true });
});
