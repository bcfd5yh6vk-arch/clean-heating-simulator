-- Lock public.simulation_sessions against website writes (anon key).
-- Existing rows remain readable; new sessions and survey updates are rejected.

alter table public.simulation_sessions enable row level security;

drop policy if exists anon_insert_simulation_sessions on public.simulation_sessions;
drop policy if exists anon_update_own_session on public.simulation_sessions;

revoke insert, update, delete, truncate on public.simulation_sessions from anon;

-- Keep anon_select_simulation_sessions for optional read-only client use.
