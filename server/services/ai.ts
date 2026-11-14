import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { db } from '../db.ts';

const DEFAULT_MODEL = 'gemini-4-hydrogen';

// Simple per-user sliding window rate limiter (25 AI requests per 10 minutes)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 25;

export function checkAiRateLimit(userId: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(userId) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = timestamps[0];
    return { allowed: false, retryAfterSec: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000) };
  }
  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return { allowed: true };
}

export interface AIProvider {
  name: string;
  generateText(params: { systemInstruction: string; prompt: string }): Promise<string>;
  generateJson<T>(params: { systemInstruction: string; prompt: string; schema: Record<string, unknown> }): Promise<T>;
}

class GeminiAIProvider implements AIProvider {
  public name = 'gemini';
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.client;
  }

  async generateText({ systemInstruction, prompt }: { systemInstruction: string; prompt: string }): Promise<string> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    return (response.text || '').trim();
  }

  async generateJson<T>({
    systemInstruction,
    prompt,
    schema,
  }: {
    systemInstruction: string;
    prompt: string;
    schema: Record<string, unknown>;
  }): Promise<T> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schema as never,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const raw = (response.text || '{}').trim();
    return JSON.parse(raw) as T;
  }
}

export const aiProvider: AIProvider = new GeminiAIProvider();

export function logAiUsage(
  userId: string,
  action: string,
  status: 'success' | 'error',
  tokensEstimated = 0,
  errorMessage?: string
): void {
  db.prepare(`
    INSERT INTO ai_usage_logs (id, user_id, action, model, tokens_estimated, status, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    userId,
    action,
    DEFAULT_MODEL,
    tokensEstimated,
    status,
    errorMessage ? errorMessage.slice(0, 400) : null,
    new Date().toISOString()
  );
}

export const ANTI_FABRICATION_SYSTEM_RULE = `
STRICT INTEGRITY RULES:
1. NEVER fabricate employment history, companies, job titles, degrees, certifications, awards, numerical metrics, percentages, dollar/rupee figures, or skills that the user did not explicitly provide.
2. If quantitative results or details are missing, write clear impact-focused phrasing without inventing numbers, OR ask the user for those missing details in missingInfoQuestions.
3. Keep tone professional, concise, ATS-friendly, and authentic.
`.trim();

export { Type };
