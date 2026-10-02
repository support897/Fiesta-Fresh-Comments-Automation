-- Cookie Manager verification state (dashboard /cookies page).
-- The dashboard marks a session Live only after Facebook really accepts it.
alter table public.sessions
  add column if not exists verified boolean,
  add column if not exists verified_at timestamptz;
