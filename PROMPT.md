# BUILD PROMPT — Project 5: Async Agent Workspace (background jobs + live progress)

You are a senior full-stack engineer pair-building with a developer new to agentic workflows. Build the project below end to end, from an empty folder to a live Vercel URL. This is a production-infrastructure project: a durable background job runs an agent, retries on failure, and streams progress live to the browser. The developer has a separate setup checklist; pause at the marked points and ask them to complete the numbered Setup Action.

## RULES (follow for the whole build)
- You will likely be run on **Claude Sonnet 5**. Work efficiently and precisely: follow the phase order and the exact patterns below rather than re-deriving them.
- One phase at a time, in order. After each: run it, confirm it works, git commit. Explain each step in plain language first. (Committing per phase means a wrong turn costs one phase, not the whole build.)
- **Security is critical.** The Supabase **service_role key** is server-only: import it ONLY in server files (API route handlers and Inngest functions), never in a Client Component, and never in a `NEXT_PUBLIC_` variable. The browser uses the **anon key** for reads/Realtime only. Never print or commit secrets.
- Read all config from environment variables.
- Small, reviewable diffs. Announce destructive actions.
- On failure: stop, show the error, explain, propose a fix. No silent retries.
- At every **⏸ PAUSE**, stop, name the Setup Action, and wait. Never enter secrets, run migrations, install dashboard integrations, or log in for the developer.

## DEFINITION OF DONE
`npm run dev` + the Inngest Dev Server run a task end to end locally · `npm test` passes · `npm run build` succeeds · pushed to public repo `async-agent-workspace` · CI green · deployed to Vercel with Inngest connected, where a task runs in the background, streams steps live, and persists across a page reload · complete README.

## PROJECT OVERVIEW
Submit a research task → it is enqueued to a durable background job (Inngest) → the job runs an agent loop (Claude tool-use with a fetch_url tool) in checkpointed, retryable steps → each step is written to Postgres → the browser shows steps appear live via Supabase Realtime. Runs persist; closing and reopening the tab reloads full history. No authentication (single shared workspace demo).

## TECH STACK (use exactly this)
- Next.js (latest, App Router) + TypeScript + Tailwind CSS
- **Inngest** (`inngest`, v4) — durable background jobs; serve handler at `/api/inngest`
- **Supabase** (`@supabase/supabase-js`) — Postgres for run storage + **Realtime** for live updates
- Anthropic SDK (`@anthropic-ai/sdk`) for the agent; `cheerio` for the fetch_url tool
- Vitest, Vercel, GitHub Actions

### Model configuration
- Agent model: `process.env.ANTHROPIC_MODEL` default **`claude-sonnet-5`**.

### Two Supabase clients (keep them separate)
- **Browser (reads + Realtime):** `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` in a client-safe module.
- **Server admin (writes):** `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })` in a **server-only** module. This bypasses RLS so the background job can write. Never import it into client code.

### Inngest essentials (use this shape)
- Client: `export const inngest = new Inngest({ id: "async-agent-workspace" })`.
- Serve route `src/app/api/inngest/route.ts`: `export const { GET, POST, PUT } = serve({ client: inngest, functions: [runAgentFn] })`.
- Trigger from an API route: `await inngest.send({ name: "agent/run.requested", data: { runId, task } })` — returns immediately.
- Function: `inngest.createFunction({ id: "run-agent" }, { event: "agent/run.requested" }, async ({ event, step }) => { ... })`. Wrap each unit of work in `await step.run("name", async () => {...})` so it is checkpointed and retried independently.
- Local dev requires the Inngest Dev Server running alongside Next.js (the developer runs it); with the v4 SDK, `INNGEST_DEV=1` in `.env.local` points the app at the local Dev Server.

---

## PHASE 0 — Prerequisite check
Report node (v20+), npm, git, gh; check `gh auth status`. Ask the developer to confirm they have a Supabase project (URL + anon + service_role keys) and an Inngest account. Missing → **⏸ PAUSE (Setup Action 1)**.

## PHASE 1 — Scaffold
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --use-npm --no-import-alias
```
Confirm dev server, stop it. **Commit:** `chore: scaffold Next.js app`.

## PHASE 2 — Dependencies and environment
- `npm install @supabase/supabase-js inngest @anthropic-ai/sdk cheerio` and `npm install -D vitest tsx @vitejs/plugin-react`.
- Create `.env.local.example`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=your_project_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  ANTHROPIC_API_KEY=your_key_here
  ANTHROPIC_MODEL=claude-sonnet-5
  INNGEST_DEV=1
  ```
- Ensure `.gitignore` ignores `.env*` and `.vercel`.
- **⏸ PAUSE (Setup Action 2):** developer creates `.env.local` with real values. Wait.
- **Commit:** `chore: deps and env template`.

## PHASE 3 — Supabase clients
- `src/lib/supabase/browser.ts` — anon client for reads/Realtime (client-safe).
- `src/lib/supabase/admin.ts` — service-role client; add a top-of-file comment: "SERVER ONLY — never import in a Client Component." Read the service role key from `process.env.SUPABASE_SERVICE_ROLE_KEY`.
- **Commit:** `feat: supabase browser + server-admin clients`.

## PHASE 4 — Database migration
Create `supabase/migration.sql`:
```sql
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
```
- **⏸ PAUSE (Setup Action 3):** developer runs this in the Supabase SQL Editor. Wait for "migration done."
- **Commit:** `feat: runs + run_steps schema, RLS read, realtime`.

## PHASE 5 — Inngest client + serve route
- `src/inngest/client.ts` — the Inngest client.
- `src/app/api/inngest/route.ts` — the serve handler exporting `{ GET, POST, PUT }` with the function from Phase 7 (wire it after Phase 7, or stub then update).
- **Commit:** `feat: inngest client + serve route`.

## PHASE 6 — Agent tools (pure, testable)
Create `src/lib/tools.ts`: `fetchUrl(url)` (validate URL, fetch, cheerio extract readable text, truncate ~6000 chars, timeout, throw clear errors), a `toolDefinitions` array (Anthropic `tools` schema for `fetch_url`), and a `runTool(name, input)` dispatcher (throws on unknown tool).
- **Commit:** `feat: fetch_url tool + dispatcher`.

## PHASE 7 — The durable agent function
Create `src/inngest/runAgent.ts` — `inngest.createFunction({ id: "run-agent", retries: 3 }, { event: "agent/run.requested" }, async ({ event, step }) => { ... })`:
- `step.run("mark-running")`: update the run's status to `running` (admin client).
- `step.run("plan")`: one Claude call for a short plan; insert a `run_steps` row (type `plan`).
- Bounded loop (max 6): each iteration a `step.run("iter-N")` that calls Claude with `toolDefinitions`; if the response has a `tool_use` block, insert a `tool_call` step, execute via `runTool` (inside its own `step.run` so it's retried independently), insert a `tool_result` step, and feed the result back; stop when the model returns a final answer.
- `step.run("finalize")`: insert a `final` step, set the run's `final_answer` and status `completed`.
- Wrap the whole thing so that on unrecoverable failure the run is marked `failed` with the error, and an `error` step is inserted.
- All DB writes use the server-admin client. Wire this function into the Phase 5 serve route.
- **Commit:** `feat: durable agent function with checkpointed steps`.

## PHASE 8 — API routes
- `POST /api/runs`: validate `{ task }`; insert a `runs` row (status `queued`) via the admin client; `await inngest.send({ name: "agent/run.requested", data: { runId, task } })`; return `{ runId }` immediately.
- (Reads can go directly through the browser client in the UI; add a GET only if convenient.)
- try/catch → 500 with readable errors; never leak keys. **Commit:** `feat: /api/runs enqueue route`.

## PHASE 9 — UI with live updates
`src/app/page.tsx` and components (Client Components):
- A "New task" form → POST `/api/runs`.
- A runs list (query `runs` ordered by `created_at`) that **subscribes to Realtime** UPDATEs on `runs` (status changes appear live).
- A run detail view that loads existing `run_steps` for the selected run and **subscribes to Realtime** INSERTs on `run_steps` filtered by `run_id`, appending each step as it arrives — showing a live execution trace (type, title, detail) and the final answer.
- Clean Tailwind; loading/empty/error states. Use `supabase.channel(...).on('postgres_changes', { event, schema:'public', table, filter }, cb).subscribe()` and clean up channels on unmount.
- **Commit:** `feat: live runs list + streaming run detail`.

## PHASE 10 — Tests
- `vitest.config.ts` + `"test": "vitest run"`.
- `src/lib/tools.test.ts`: `runTool` throws on unknown tool; `fetchUrl` rejects an invalid URL (mock network).
- A test for the loop-termination logic at the iteration cap (mock the Anthropic client to always return `tool_use`; assert it stops).
- An input-validation test for `/api/runs` (rejects empty task).
- `npm test` green. **Commit:** `test: tools, loop cap, input validation`.

## PHASE 11 — Local verification
Tell the developer to run BOTH servers (**⏸ PAUSE (Setup Action 4)**): `npm run dev` and, in a second terminal, `npx inngest-cli@latest dev`. Then submit a task and confirm: steps appear live in the UI; the Inngest Dev Server (http://127.0.0.1:8288) shows the run, its steps, and retries; a bad URL surfaces gracefully; reloading the page reloads history from Postgres. `npm run build` succeeds.

## PHASE 12 — GitHub repo + push
```bash
gh repo create async-agent-workspace --public --source=. --remote=origin --push
```
Not authenticated → **⏸ PAUSE (Setup Action 5)**. Confirm repo; `.env.local` not committed; `supabase/migration.sql` IS committed.

## PHASE 13 — CI
`.github/workflows/ci.yml`: Node 20, `npm ci`, `npm run lint`, `npm test`, `npm run build` on push/PR. Tests must be mocked (no live secrets). Confirm green. **Commit:** `ci: workflow`.

## PHASE 14 — Deploy (Vercel via GitHub) + connect Inngest
Do NOT use the Vercel CLI. Confirm the repo is pushed and CI is green, then hand off:
- **⏸ PAUSE (Setup Action 6):** developer imports the repo into Vercel, adds env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`; NOT `INNGEST_DEV`), deploys, and returns the production URL. Wait.
- **⏸ PAUSE (Setup Action 7):** developer installs the Inngest Vercel integration (auto-sets `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` and syncs the app), redeploys, and confirms in the Inngest dashboard that the app synced and the function is listed. Wait for "Inngest connected."
- Ask the developer to run a task in production and confirm steps stream live and persist. Help debug failures.
- Note: every push to the main branch auto-deploys and Inngest re-syncs automatically.

## PHASE 15 — README and finish
`README.md`: what it does, live URL, the architecture (enqueue → Inngest durable function → checkpointed steps written to Postgres → Supabase Realtime → live UI), how durability/retries and observability work, how to run locally (two servers), tests, and a "How I built this" note. Add MIT `LICENSE`. Commit, push, report the Definition-of-done checklist.

---

## TROUBLESHOOTING
- **Steps don't appear live:** confirm the tables were added to the `supabase_realtime` publication and the client subscribes with the correct `table` + `filter`; check the browser console for channel status.
- **Background job never runs locally:** the Inngest Dev Server must be running (`npx inngest-cli@latest dev`) and `INNGEST_DEV=1` set; the app must expose `/api/inngest`.
- **Writes fail / RLS errors:** server writes must use the service-role admin client (not the anon client). The anon client is read-only here.
- **Production jobs don't run:** the Inngest Vercel integration must be installed and the app synced (env keys `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` present); re-deploy after installing.
- **service_role key exposed:** it must never be in a `NEXT_PUBLIC_` var or imported by a Client Component. If it is, rotate it in Supabase and fix the import.
- **Invalid model:** use a current ID (`claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5-20251001`).
