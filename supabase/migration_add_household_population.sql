-- Run once in Supabase Dashboard → SQL Editor
-- Stores household resident count from the simulator start form.

alter table public.simulation_sessions
  add column if not exists household_population integer;

comment on column public.simulation_sessions.household_population is '家中常住人口数量（人）';
