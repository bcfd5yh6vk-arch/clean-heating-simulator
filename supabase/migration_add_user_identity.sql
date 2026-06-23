-- Run once in Supabase Dashboard → SQL Editor
-- Adds identity fields collected from the simulator start form.

alter table public.simulation_sessions
  add column if not exists user_identity text,
  add column if not exists identity_detail text;

comment on column public.simulation_sessions.user_identity is '学生 / 已煤改农户 / 未煤改农户 / 其他';
comment on column public.simulation_sessions.identity_detail is '年级、村名或自定义身份说明';
