-- Run once in Supabase Dashboard → SQL Editor
-- Stores the 2-minute post-game survey as JSON on each simulation session.

alter table public.simulation_sessions
  add column if not exists post_survey jsonb,
  add column if not exists post_survey_at timestamptz;

comment on column public.simulation_sessions.post_survey is 'Post-game 2-minute survey responses (common + identity-specific + end)';
comment on column public.simulation_sessions.post_survey_at is 'When the post-game survey was submitted';
