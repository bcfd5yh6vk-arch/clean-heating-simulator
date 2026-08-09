-- Global Advisor Feedback (G7)
-- Anonymous, optional. Do not store household income, bills, or full session JSON.
-- Keep separate from China Pilot survey tables (simulation_sessions).

create table if not exists public.global_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  locale text not null check (locale in ('en', 'zh')),
  country_iso3 text,
  admin1_name text,
  helped_understand_score smallint check (
    helped_understand_score is null
    or helped_understand_score between 1 and 5
  ),
  ai_helpfulness text check (
    ai_helpfulness is null
    or ai_helpfulness in ('1', '2', '3', '4', '5', 'not_used')
  ),
  improvement_text text check (
    improvement_text is null
    or char_length(improvement_text) <= 500
  ),
  ai_used boolean default false,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.global_feedback is
  'Anonymous optional Global G7 feedback. Separate from China Pilot surveys. Free text requires manual review before Impact publication.';

create index if not exists global_feedback_submitted_at_idx
  on public.global_feedback (submitted_at desc);

alter table public.global_feedback enable row level security;

-- Inserts should use service role / server API. No public select of free text.
drop policy if exists "Allow anonymous insert of global feedback" on public.global_feedback;
create policy "Allow anonymous insert of global feedback"
  on public.global_feedback
  for insert
  to anon, authenticated
  with check (true);
