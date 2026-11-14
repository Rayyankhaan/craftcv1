import { db, getPlatformSetting } from '../db.ts';

export interface ServerEntitlements {
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

export function getUserEntitlements(userId: string): ServerEntitlements {
  const nowIso = new Date().toISOString();
  const priceInr = getPlatformSetting<number>('premiumPriceInr', 99);
  const billingInterval = getPlatformSetting<'monthly' | 'yearly' | 'lifetime' | 'one_time'>(
    'billingInterval',
    'monthly'
  );
  const freeResumeLimit = getPlatformSetting<number>('freeResumeLimit', 1);
  const freeAiLimit = getPlatformSetting<number>('freeAiLimit', 1);
  const freeAtsLimit = getPlatformSetting<number>('freeAtsLimit', 1);
  const premiumFeaturesEnabled = getPlatformSetting<boolean>('premiumFeaturesEnabled', true);

  // Check active subscription
  const sub = db.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId) as Record<string, unknown> | undefined;

  let subscriptionStatus: 'inactive' | 'active' | 'cancelled' | 'expired' = 'inactive';
  let isPremium = false;
  let expiresAt: string | null = null;
  let activeInterval = billingInterval;

  if (sub) {
    expiresAt = sub.current_period_end ? String(sub.current_period_end) : null;
    activeInterval = (String(sub.billing_interval || billingInterval) as typeof billingInterval);
    const rawStatus = String(sub.status);
    if (rawStatus === 'active' || rawStatus === 'cancelled') {
      if (!expiresAt || expiresAt > nowIso) {
        isPremium = premiumFeaturesEnabled;
        subscriptionStatus = rawStatus as 'active' | 'cancelled';
      } else {
        // Mark expired cleanly without deleting any user resumes
        db.prepare(`UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`).run(
          nowIso,
          String(sub.id)
        );
        subscriptionStatus = 'expired';
      }
    } else if (rawStatus === 'expired') {
      subscriptionStatus = 'expired';
    }
  }

  // Admins have full access
  const profile = db.prepare(`SELECT role FROM profiles WHERE id = ?`).get(userId) as
    | { role: string }
    | undefined;
  if (profile?.role === 'admin') {
    isPremium = true;
    subscriptionStatus = 'active';
  }

  // Read permanent server-side usage counters (never reset on delete or logout)
  let usage = db.prepare(`SELECT * FROM user_usage WHERE user_id = ?`).get(userId) as
    | {
        resumes_created_count: number;
        ai_generations_used: number;
        ats_checks_used: number;
      }
    | undefined;

  if (!usage) {
    db.prepare(`INSERT OR IGNORE INTO user_usage (user_id, updated_at) VALUES (?, ?)`).run(userId, nowIso);
    usage = { resumes_created_count: 0, ai_generations_used: 0, ats_checks_used: 0 };
  }

  return {
    plan: isPremium ? 'premium' : 'free',
    subscriptionStatus,
    billingInterval: activeInterval,
    priceInr,
    expiresAt,
    resumesCreatedCount: usage.resumes_created_count,
    freeResumeLimit,
    canCreateResume: isPremium || usage.resumes_created_count < freeResumeLimit,
    aiGenerationsUsed: usage.ai_generations_used,
    freeAiLimit,
    canUseAi: isPremium || usage.ai_generations_used < freeAiLimit,
    atsChecksUsed: usage.ats_checks_used,
    freeAtsLimit,
    canRunAts: isPremium || usage.ats_checks_used < freeAtsLimit,
  };
}

export function incrementResumeCreatedUsage(userId: string): void {
  db.prepare(`
    UPDATE user_usage
    SET resumes_created_count = resumes_created_count + 1, updated_at = ?
    WHERE user_id = ?
  `).run(new Date().toISOString(), userId);
}

export function incrementAiUsage(userId: string): void {
  db.prepare(`
    UPDATE user_usage
    SET ai_generations_used = ai_generations_used + 1, updated_at = ?
    WHERE user_id = ?
  `).run(new Date().toISOString(), userId);
}

export function incrementAtsUsage(userId: string): void {
  db.prepare(`
    UPDATE user_usage
    SET ats_checks_used = ats_checks_used + 1, updated_at = ?
    WHERE user_id = ?
  `).run(new Date().toISOString(), userId);
}

export function incrementDownloadUsage(userId: string): void {
  db.prepare(`
    UPDATE user_usage
    SET downloads_count = downloads_count + 1, updated_at = ?
    WHERE user_id = ?
  `).run(new Date().toISOString(), userId);
}
