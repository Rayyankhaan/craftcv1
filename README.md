# CraftCV — AI Resume Builder & Career Platform

A full-stack AI Resume Builder, Fresher Resume Studio, ATS Analyzer, Job Description Matcher, Cover Letter Generator, and Job Application Tracker built with React, TypeScript, Tailwind CSS, Express, SQLite (plus Supabase PostgreSQL + RLS migration), Google Gemini API (`@google/genai`), and Razorpay.

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons
- **Backend**: Express (`server.ts`) with HTTP-only session cookies, Zod validation, Multer upload checks, and rate-limited server-side AI endpoints
- **Database**: Persistent local SQLite via Node `node:sqlite` (`./data/craftcv.db`) out of the box, plus complete Supabase PostgreSQL + Row Level Security migration in `supabase/migrations/001_initial_schema.sql`
- **Document Processing & Export**:
  - Upload parsing: `pdfjs-dist` (PDF) and `mammoth` (DOCX)
  - Vector exports: `jsPDF` (selectable-text A4 PDF with clickable links), `docx` (structured A4 Word document), and plain-text ATS `.txt`
- **AI Layer**: Server-side `@google/genai` (`gemini-4-hydrogen`) with strict anti-fabrication prompts and usage tracking
- **Payments**: Razorpay order creation, HMAC SHA-256 signature verification, signed webhook handler, and coupon codes (`STUDENT20`)

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set your environment variables:
   - `GEMINI_API_KEY`: Required for AI resume writing, ATS semantic evaluation, job matching, cover letters, and career tools.
   - Optional integrations (clear notices are shown in UI when unconfigured):
     - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth login
     - `SMS_PROVIDER` / `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`: Live SMS OTP delivery (when unconfigured, sandbox OTP verification is displayed for local testing)
     - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`: Live/Test Razorpay checkout & webhooks (when unconfigured, Sandbox Verification Mode is available for local testing)
     - `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: Cloud PostgreSQL & Storage
3. Start development server on port 3000:
   ```bash
   npm run dev
   ```

## Admin Access

On first boot, an administrator account is seeded using `ADMIN_EMAIL` (default `admin@craftcv.local`) and `ADMIN_SEED_PASSWORD` (default `Admin@123456`). Sign in with those credentials to access the **Admin Console** in the dashboard sidebar.

## Supabase Deployment

Apply `/supabase/migrations/001_initial_schema.sql` to your Supabase project via the SQL Editor or `supabase db push`. It provisions all 21 tables, indexes, private `resume-uploads` storage bucket, and Row Level Security policies.

## Build & Verification

```bash
npm run lint
npm run build
```
