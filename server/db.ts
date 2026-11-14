import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'craftcv.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, 'hex');
  if (derived.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(derived, hashBuf);
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      email_verify_token TEXT,
      reset_token TEXT,
      reset_token_expires_at TEXT,
      full_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      career_stage TEXT,
      current_education TEXT,
      target_job_role TEXT,
      experience_level TEXT,
      main_career_goal TEXT,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      is_suspended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      target_role TEXT NOT NULL DEFAULT '',
      builder_type TEXT NOT NULL DEFAULT 'standard' CHECK (builder_type IN ('standard', 'fresher')),
      template_id TEXT NOT NULL DEFAULT 'ats-classic',
      content_json TEXT NOT NULL,
      share_token TEXT UNIQUE,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);

    CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      template_id TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ats_analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL,
      analysis_type TEXT NOT NULL DEFAULT 'general',
      overall_score INTEGER NOT NULL,
      job_match_score INTEGER,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_descriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      job_title TEXT NOT NULL,
      company_name TEXT NOT NULL DEFAULT '',
      raw_text TEXT NOT NULL,
      extracted_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_matches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      job_description_id TEXT REFERENCES job_descriptions(id) ON DELETE SET NULL,
      job_title TEXT NOT NULL,
      company_name TEXT NOT NULL DEFAULT '',
      match_score INTEGER NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cover_letters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL,
      job_title TEXT NOT NULL,
      company_name TEXT NOT NULL,
      hiring_manager TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT 'professional',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      job_url TEXT NOT NULL DEFAULT '',
      application_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Applied',
      notes TEXT NOT NULL DEFAULT '',
      resume_version_label TEXT NOT NULL DEFAULT '',
      interview_date TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      default_template_id TEXT NOT NULL DEFAULT 'ats-classic',
      email_notifications INTEGER NOT NULL DEFAULT 1,
      marketing_opt_in INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_estimated INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price_inr INTEGER NOT NULL,
      billing_interval TEXT NOT NULL DEFAULT 'monthly',
      features_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      status TEXT NOT NULL DEFAULT 'inactive',
      billing_interval TEXT NOT NULL DEFAULT 'monthly',
      razorpay_subscription_id TEXT,
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
      razorpay_order_id TEXT NOT NULL UNIQUE,
      razorpay_payment_id TEXT UNIQUE,
      razorpay_signature TEXT,
      amount_inr INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'created',
      method TEXT,
      coupon_code TEXT,
      receipt_number TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_usage (
      user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      resumes_created_count INTEGER NOT NULL DEFAULT 0,
      ai_generations_used INTEGER NOT NULL DEFAULT 0,
      ats_checks_used INTEGER NOT NULL DEFAULT 0,
      downloads_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      admin_reply TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      discount_percent INTEGER NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 100,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();

  // Seed default plans
  db.prepare(`
    INSERT OR IGNORE INTO plans (id, name, price_inr, billing_interval, features_json, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(
    'free',
    'Free Starter',
    0,
    'one_time',
    JSON.stringify([
      '1 total resume (Standard or Fresher)',
      'Basic ATS-friendly templates',
      'Unlimited edits to original resume',
      '1 basic AI generation & 1 basic ATS check',
      'PDF, DOCX, and TXT downloads',
    ]),
    now
  );

  db.prepare(`
    INSERT OR IGNORE INTO plans (id, name, price_inr, billing_interval, features_json, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(
    'premium',
    'Premium Career Suite',
    99,
    'monthly',
    JSON.stringify([
      'Unlimited resumes & versions',
      'All 22+ professional & fresher templates',
      'Unlimited AI resume writing & rewriting',
      'Advanced ATS analyzer & JD matching',
      'AI cover letters, LinkedIn & interview prep',
    ]),
    now
  );

  // Seed platform settings
  const defaultSettings: Record<string, unknown> = {
    premiumPriceInr: 99,
    billingInterval: 'monthly',
    freeResumeLimit: 1,
    freeAiLimit: 1,
    freeAtsLimit: 1,
    premiumFeaturesEnabled: true,
    disabledTemplateIds: [] as string[],
    announcement: '',
  };

  for (const [key, val] of Object.entries(defaultSettings)) {
    db.prepare(`
      INSERT OR IGNORE INTO platform_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
    `).run(key, JSON.stringify(val), now);
  }

  // Seed default coupon
  db.prepare(`
    INSERT OR IGNORE INTO coupons (code, discount_percent, max_uses, used_count, is_active, created_at)
    VALUES ('STUDENT20', 20, 500, 0, 1, ?)
  `).run(now);

  // Seed admin user if none exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@craftcv.local';
  const existingAdmin = db.prepare(`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`).get();
  if (!existingAdmin) {
    const adminId = crypto.randomUUID();
    const adminPass = process.env.ADMIN_SEED_PASSWORD || 'Admin@123456';
    db.prepare(`
      INSERT INTO profiles (
        id, email, password_hash, email_verified, full_name, role,
        onboarding_completed, created_at, updated_at
      ) VALUES (?, ?, ?, 1, 'Platform Administrator', 'admin', 1, ?, ?)
    `).run(adminId, adminEmail.toLowerCase(), hashPassword(adminPass), now, now);

    db.prepare(`INSERT OR IGNORE INTO user_usage (user_id, updated_at) VALUES (?, ?)`).run(adminId, now);
    db.prepare(`INSERT OR IGNORE INTO user_preferences (user_id, updated_at) VALUES (?, ?)`).run(adminId, now);
  }
}

export function getPlatformSetting<T>(key: string, fallback: T): T {
  const row = db.prepare(`SELECT value_json FROM platform_settings WHERE key = ?`).get(key) as
    | { value_json: string }
    | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return fallback;
  }
}

export function setPlatformSetting(key: string, value: unknown): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO platform_settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), now);
}

export function logAudit(
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null = null,
  metadata: Record<string, unknown> = {}
): void {
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    userId,
    action,
    resourceType,
    resourceId,
    JSON.stringify(metadata),
    new Date().toISOString()
  );
}
