create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  final_answer text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  idx int not null,
  type text not null check (type in ('plan','tool_call','tool_result','final','error')),
  title text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists run_steps_run_idx on public.run_steps(run_id, idx);

-- Public read (demo, no auth). No client write policies: writes happen server-side with the service_role key, which bypasses RLS.
alter table public.runs enable row level security;
alter table public.run_steps enable row level security;
create policy "public read runs" on public.runs for select using (true);
create policy "public read steps" on public.run_steps for select using (true);

-- Live updates
alter publication supabase_realtime add table public.runs;
alter publication supabase_realtime add table public.run_steps;
