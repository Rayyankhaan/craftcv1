-- CraftCV Supabase PostgreSQL + Row Level Security Migration
-- Run in Supabase SQL Editor or via `supabase db push`

create extension if not exists "pgcrypto";

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  phone text unique,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  full_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  career_stage text,
  current_education text,
  target_job_role text,
  experience_level text,
  main_career_goal text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. resume_templates
create table if not exists public.resume_templates (
  id text primary key,
  name text not null,
  category text not null,
  layout text not null,
  is_premium boolean not null default false,
  is_fresher_friendly boolean not null default false,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. resumes
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_role text not null default '',
  builder_type text not null default 'standard' check (builder_type in ('standard', 'fresher')),
  template_id text not null default 'ats-classic',
  content jsonb not null,
  share_token text unique,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_resumes_user_id on public.resumes(user_id);

-- 4. resume_sections
create table if not exists public.resume_sections (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  section_key text not null,
  title text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. resume_versions
create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null,
  label text not null,
  template_id text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_resume_versions_resume_id on public.resume_versions(resume_id);

-- 6. ats_analyses
create table if not exists public.ats_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  analysis_type text not null default 'general',
  overall_score integer not null,
  job_match_score integer,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- 7. job_descriptions
create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_title text not null,
  company_name text not null default '',
  raw_text text not null,
  extracted jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 8. job_matches
create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_description_id uuid references public.job_descriptions(id) on delete set null,
  job_title text not null,
  company_name text not null default '',
  match_score integer not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- 9. cover_letters
create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  job_title text not null,
  company_name text not null,
  hiring_manager text not null default '',
  tone text not null default 'professional',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. job_applications
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  position text not null,
  job_url text not null default '',
  application_date text not null,
  status text not null default 'Applied',
  notes text not null default '',
  resume_version_label text not null default '',
  interview_date text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. user_preferences
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_template_id text default 'ats-classic',
  email_notifications boolean not null default true,
  marketing_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 12. ai_usage_logs
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  model text not null,
  tokens_estimated integer not null default 0,
  status text not null default 'success',
  created_at timestamptz not null default now()
);

-- 13. plans
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_inr integer not null,
  billing_interval text not null default 'monthly',
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 14. subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'inactive',
  billing_interval text not null default 'monthly',
  razorpay_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 15. payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  razorpay_signature text,
  amount_inr integer not null,
  currency text not null default 'INR',
  status text not null default 'created',
  method text,
  receipt_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 16. user_usage (server-authoritative freemium counters; never decremented on delete)
create table if not exists public.user_usage (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  resumes_created_count integer not null default 0,
  ai_generations_used integer not null default 0,
  ats_checks_used integer not null default 0,
  downloads_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 17. subscription_events
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 18. support_tickets
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  subject text not null,
  category text not null default 'general',
  message text not null,
  status text not null default 'open',
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 19. coupons
create table if not exists public.coupons (
  code text primary key,
  discount_percent integer not null check (discount_percent between 1 and 100),
  max_uses integer not null default 100,
  used_count integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- 20. notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 21. audit_logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security on every user-data table
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_sections enable row level security;
alter table public.resume_versions enable row level security;
alter table public.ats_analyses enable row level security;
alter table public.job_descriptions enable row level security;
alter table public.job_matches enable row level security;
alter table public.cover_letters enable row level security;
alter table public.job_applications enable row level security;
alter table public.user_preferences enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.user_usage enable row level security;
alter table public.subscription_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- RLS Ownership Policies
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id);

create policy "Users manage own resumes" on public.resumes
  for all using (auth.uid() = user_id);

create policy "Public shared resumes read" on public.resumes
  for select using (is_public = true and share_token is not null);

create policy "Users manage own resume versions" on public.resume_versions
  for all using (auth.uid() = user_id);

create policy "Users manage own ats analyses" on public.ats_analyses
  for all using (auth.uid() = user_id);

create policy "Users manage own job descriptions" on public.job_descriptions
  for all using (auth.uid() = user_id);

create policy "Users manage own job matches" on public.job_matches
  for all using (auth.uid() = user_id);

create policy "Users manage own cover letters" on public.cover_letters
  for all using (auth.uid() = user_id);

create policy "Users manage own job applications" on public.job_applications
  for all using (auth.uid() = user_id);

create policy "Users manage own preferences" on public.user_preferences
  for all using (auth.uid() = user_id);

create policy "Users read own ai logs" on public.ai_usage_logs
  for select using (auth.uid() = user_id);

create policy "Users read own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "Users read own payments" on public.payments
  for select using (auth.uid() = user_id);

create policy "Users read own usage" on public.user_usage
  for select using (auth.uid() = user_id);

create policy "Users manage own support tickets" on public.support_tickets
  for all using (auth.uid() = user_id);

create policy "Users manage own notifications" on public.notifications
  for all using (auth.uid() = user_id);

-- Private storage bucket for uploaded resumes
insert into storage.buckets (id, name, public)
values ('resume-uploads', 'resume-uploads', false)
on conflict (id) do nothing;

create policy "Users access own uploaded resumes" on storage.objects
  for all using (bucket_id = 'resume-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
