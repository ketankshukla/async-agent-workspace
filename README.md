# ⏳ Async Agent Workspace

[![CI](https://github.com/ketankshukla/async-agent-workspace/actions/workflows/ci.yml/badge.svg)](https://github.com/ketankshukla/async-agent-workspace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)
[![Deployed on Vercel](https://img.shields.io/badge/deployed-vercel-black.svg)](https://async-agent-workspace.vercel.app/)

✨ Submit a research task, watch a background AI agent work through it in real time, and see every step — plan, tool calls, results, final answer — persist and stream live, even across a page reload.

🔗 **Live URL:** https://async-agent-workspace.vercel.app/

📚 **Companion docs:**
- 📖 [`USER_GUIDE.md`](./USER_GUIDE.md) — how to use the app, example tasks that work, and troubleshooting
- 🔬 [`HOW_IT_WORKS.md`](./HOW_IT_WORKS.md) — end-to-end technical deep dive into the enqueue → durable job → live update flow
- 🧠 [`THOUGHT_PROCESS.md`](./THOUGHT_PROCESS.md) — the reasoning behind how this was built, plus a checklist for starting a project like this from scratch
- 🧩 [`PROJECT_STANDARDS.md`](./PROJECT_STANDARDS.md) — the shared style guide and file checklist used across this whole project series

📸 *(Screenshot placeholder — add a screenshot of the runs list + live step trace here.)*

## 🛠️ Tech stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Inngest** — durable background jobs, served at `/api/inngest`
- **Supabase** — Postgres for run storage, Realtime for live updates
- **Anthropic Claude** (`@anthropic-ai/sdk`) — the agent's reasoning; `cheerio` for the `fetch_url` tool
- **Vitest** — unit tests
- **Vercel** + **GitHub Actions** — deployment and CI

## 🎯 What it does

1. You submit a task (e.g. *"Fetch https://en.wikipedia.org/wiki/TypeScript and summarize it"*).
2. The task is enqueued as a durable background job — the request returns immediately.
3. A background agent loop calls Claude, optionally uses a `fetch_url` tool (fetches a page and extracts readable text with `cheerio`), and iterates (bounded to 6 iterations) until it produces a final answer.
4. Every step of that loop — plan, tool call, tool result, final answer, or error — is written to Postgres as it happens.
5. The browser is subscribed to Supabase Realtime, so each step appears in the UI the moment it's written — no polling.
6. Closing and reopening the tab reloads the full run history from Postgres.

There is no authentication — this is a single shared workspace demo.

## 🔍 How it works here

```
Browser (New Task form) → POST /api/runs → insert `runs` row → inngest.send(...)
   → Inngest durable function → checkpointed step.run(...) calls (plan, Claude + tools, finalize)
   → each step written to Postgres → Supabase Realtime → Browser (live UI update)
```

See [`HOW_IT_WORKS.md`](./HOW_IT_WORKS.md) for the full request-flow diagram, a step-by-step trace through the real code, and the Postgres data model.

## 🛡️ Safety limits

- The tool-use loop is hard-capped at `MAX_ITERATIONS = 6` (`src/lib/agentLoop.ts`) — the agent always terminates even if the model keeps requesting tool calls.
- `fetchUrl` (`src/lib/tools.ts`) validates the URL scheme, times out, and truncates page text (~6000 chars) before it ever reaches the model.
- Each Inngest step is retried independently (`retries: 3`) rather than the whole run restarting from scratch on failure.

## 🚀 Local setup

This app needs **two terminals** running at the same time:

```bash
npm install
cp .env.local.example .env.local   # fill in real values
npm run dev                        # terminal 1 — Next.js app on :3000

npx inngest-cli@latest dev         # terminal 2 — Inngest Dev Server on :8288
```

Then open http://localhost:3000, submit a task, and watch steps stream in. The Inngest Dev Server UI at http://127.0.0.1:8288 shows the run, its steps, and any retries.

The Supabase schema (`runs`, `run_steps` tables, RLS policies, and Realtime publication) is in `supabase/migration.sql` — run it once in the Supabase SQL Editor before first use.

### ⚙️ Model configuration

| Env var | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser + server) | — (required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser reads + Realtime) | — (required) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only writes) | — (required) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | — (required) |
| `ANTHROPIC_MODEL` | Model ID to use | `claude-sonnet-5` |
| `INNGEST_DEV` | Points the app at the local Inngest Dev Server | unset (local dev only, set to `1`) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Production Inngest credentials | auto-set by the Vercel Inngest integration |

## ✅ Running tests

```bash
npm test
```

Covers: the `fetch_url` tool's error handling (invalid URLs, unsupported protocols, network/HTTP failures) without hitting the network, the agent loop's iteration cap (mocked Claude client that always requests a tool call — asserts the loop stops at `MAX_ITERATIONS`), and `/api/runs` input validation.

## 📦 Production build

```bash
npm run build
```

## ☁️ Deployment

Deployed to Vercel via its **GitHub integration** (push to `master` auto-deploys; CI runs lint/test/build on every push via `.github/workflows/ci.yml`). Inngest is connected via the Vercel Marketplace integration, which syncs the app's functions automatically on each deploy.

## 📖 How I built this

Built incrementally, phase by phase — see [`THOUGHT_PROCESS.md`](./THOUGHT_PROCESS.md) for the full build reasoning and a generalizable checklist for starting a project like this from scratch.

## 📈 Scaling upgrade path

- Swap the single `fetch_url` tool for a real search API so the agent can find pages instead of requiring a known URL.
- Add per-user auth (Supabase Auth) so runs are scoped to a user instead of one shared workspace.
- Add a `runs` list pagination/archival strategy once history grows large.
