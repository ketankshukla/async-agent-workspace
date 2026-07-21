# Async Agent Workspace

**Live app:** https://async-agent-workspace.vercel.app/

Submit a research task, watch a background AI agent work through it in real time, and see every step (plan, tool calls, results, final answer) persist and stream live — even across a page reload.

## What it does

1. You submit a task (e.g. *"Fetch https://en.wikipedia.org/wiki/TypeScript and summarize it"*).
2. The task is enqueued as a durable background job — the request returns immediately.
3. A background agent loop calls Claude, optionally uses a `fetch_url` tool (fetches a page and extracts readable text with `cheerio`), and iterates (bounded to 6 iterations) until it produces a final answer.
4. Every step of that loop — plan, tool call, tool result, final answer, or error — is written to Postgres as it happens.
5. The browser is subscribed to Supabase Realtime, so each step appears in the UI the moment it's written — no polling.
6. Closing and reopening the tab reloads the full run history from Postgres.

There is no authentication — this is a single shared workspace demo.

## Architecture

```
Browser (New Task form)
      │  POST /api/runs { task }
      ▼
Next.js API route ──► inserts `runs` row (status: queued) ──► Supabase Postgres
      │  inngest.send("agent/run.requested")
      ▼
Inngest (durable background job engine)
      │  invokes the run-agent function
      ▼
runAgentFn (src/inngest/runAgent.ts)
      │  step.run("mark-running")     → runs.status = running
      │  step.run("plan")             → Claude call, insert run_steps (plan)
      │  step.run("iter-N")           → Claude call w/ tools
      │  step.run("tool-exec-...")    → fetch_url via cheerio, insert tool_call/tool_result
      │  step.run("finalize")         → runs.status = completed, final_answer set
      ▼
Supabase Postgres (runs, run_steps tables)
      │  Realtime (postgres_changes)
      ▼
Browser (RunsList + RunDetail) — live updates, no refresh needed
```

### Durability, retries, and observability

- Each `step.run(...)` call in the Inngest function is **checkpointed independently**. If the process crashes or a step throws, Inngest retries just that step (up to `retries: 3` at the function level) without re-running already-completed steps or re-charging the whole task from scratch.
- The bounded loop (`MAX_ITERATIONS = 6` in `src/lib/agentLoop.ts`) guarantees the agent always terminates, even if the model keeps requesting tool calls.
- Every step of every run is visible in the **Inngest dashboard** (function runs, step timeline, retries, errors) — a full audit trail independent of the app's own UI.
- Failures anywhere in the loop mark the `runs` row `failed` with a human-readable `error` message (visible in the app UI) rather than leaving it silently stuck.

## Tech stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Inngest** — durable background jobs, served at `/api/inngest`
- **Supabase** — Postgres for run storage, Realtime for live updates
- **Anthropic Claude** (`@anthropic-ai/sdk`) — the agent's reasoning; `cheerio` for the `fetch_url` tool
- **Vitest** — unit tests
- **Vercel** + **GitHub Actions** — deployment and CI

## Running locally

You need **two terminals** running at the same time:

```bash
npm install
cp .env.local.example .env.local   # fill in real values
npm run dev                        # terminal 1 — Next.js app on :3000

npx inngest-cli@latest dev         # terminal 2 — Inngest Dev Server on :8288
```

Required env vars in `.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-sonnet-5
INNGEST_DEV=1
```

Then open http://localhost:3000, submit a task, and watch steps stream in. The Inngest Dev Server UI at http://127.0.0.1:8288 shows the run, its steps, and any retries.

The Supabase schema (`runs`, `run_steps` tables, RLS policies, and Realtime publication) is in `supabase/migration.sql` — run it once in the Supabase SQL Editor before first use.

## Tests

```bash
npm test
```

Covers: the `fetch_url` tool's error handling (invalid URLs, unsupported protocols, network/HTTP failures) without hitting the network, the agent loop's iteration cap (mocked Claude client that always requests a tool call — asserts the loop stops at `MAX_ITERATIONS`), and `/api/runs` input validation.

## Deployment

Deployed to Vercel via GitHub integration (push to `master` auto-deploys; CI runs lint/test/build on every push via `.github/workflows/ci.yml`). Inngest is connected via the Vercel integration, which syncs the app's functions automatically on each deploy.

## How I built this

Built incrementally, phase by phase: scaffold → dependencies/env → Supabase schema (with Realtime enabled) → Inngest client/serve route → the `fetch_url` tool (pure, testable) → the durable agent function with checkpointed steps → the `/api/runs` enqueue route → the live-updating UI (Supabase Realtime subscriptions) → tests → local end-to-end verification → GitHub + CI → Vercel deployment + Inngest production sync. Each phase was verified (type-check, lint, build, or tests) and committed independently before moving on, so a wrong turn only cost one phase rather than the whole build.

Along the way this surfaced a few real issues worth calling out: the Anthropic SDK's `ToolUseBlock` type is richer than a hand-rolled version (fixed by deriving the type from the SDK itself); Inngest's `step.run` return type is wrapped for checkpointing purposes; Next.js evaluates API route modules at build time even for fully dynamic routes, which meant CI needed non-secret placeholder env vars for `next build` to succeed; and enqueue failures could otherwise leave a `runs` row stuck at `queued` forever, so failures there now mark the run `failed` explicitly.

