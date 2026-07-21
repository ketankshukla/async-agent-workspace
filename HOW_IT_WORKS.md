# 🔬 How This App Works

## 🧠 The short answer (explained like you're 5)

You type in a task and hit submit. The app writes down "someone asked this" in a notebook (Postgres) and immediately says "got it!" — it doesn't make you wait. A background helper (Inngest) picks up the note, does the research one small step at a time (writing each step down as it happens), and if it stumbles on one step, it only redoes that one step, not the whole thing from scratch. Meanwhile, you're watching the notebook update live on your screen, without ever having to refresh the page.

## ❓ Why enqueue instead of just running the agent in the request handler?

An agent loop can take many seconds (multiple Claude calls, page fetches). Doing that inside a single HTTP request risks timeouts and gives no resilience — if the server restarts mid-run, the whole task is lost. Handing it to Inngest means the request returns instantly, and every unit of work (`step.run(...)`) is checkpointed independently, so a crash or transient failure only costs the one step that failed, not the whole run.

## 🔁 Full request flow, end to end

```
Browser                         Next.js (Vercel)                Inngest                    Supabase Postgres
   │  fill in task, submit           │                              │                              │
   │ ───POST /api/runs { task }────► │                              │                              │
   │                                 │ ──insert runs (queued)──────────────────────────────────────►│
   │                                 │ ◄──────────────────────────────────────────row + id──────────│
   │                                 │ ──inngest.send("agent/run.requested")──────►│                │
   │ ◄──────{ runId }────────────────│                              │              │                │
   │  (immediately, job runs later)  │                              │              │                │
   │                                 │                              │  invokes runAgentFn            │
   │                                 │                              │  step.run("mark-running") ────►│ runs.status = running
   │                                 │                              │  step.run("plan") ─────────────►│ insert run_steps (plan)
   │                                 │                              │  step.run("iter-0"..."iter-5")  │
   │                                 │                              │    → Claude call w/ tools       │
   │                                 │                              │    → step.run("tool-exec-...")  │
   │                                 │                              │        → fetch_url + cheerio    │
   │                                 │                              │    → insert run_steps (tool_call/tool_result) ►│
   │                                 │                              │  step.run("finalize") ─────────►│ runs.status = completed, final_answer set
   │  Supabase Realtime pushes each new/changed row  ◄──────────────────────────────────────────────│
   │  RunsList + RunDetail re-render live                                                             │
```

## 🪜 Step by step

1. **Submit** — `@/e:/async-agent-workspace/src/components/NewTaskForm.tsx` posts `{ task }` to `POST /api/runs`.
2. **Enqueue** — `@/e:/async-agent-workspace/src/app/api/runs/route.ts` validates the task is a non-empty string, inserts a `runs` row (status `queued`) via the **service-role admin client**, then calls `inngest.send({ name: "agent/run.requested", data: { runId, task } })` and returns `{ runId }` immediately. If sending the event fails, the row is explicitly marked `failed` (with an explanatory `error`) rather than left orphaned at `queued` forever.
3. **Serve route** — `@/e:/async-agent-workspace/src/app/api/inngest/route.ts` exposes `{ GET, POST, PUT }` via Inngest's `serve()` helper, registering `runAgentFn` so Inngest (dev server locally, or Inngest Cloud in production via the Vercel integration) can discover and invoke it.
4. **The durable function** — `@/e:/async-agent-workspace/src/inngest/runAgent.ts`:
   - `step.run("mark-running")` flips `runs.status` to `running`.
   - `step.run("plan")` makes one Claude call for a short plan and inserts a `run_steps` row of type `plan`.
   - Delegates the tool-use loop to `runAgentIterations` (see below), passing the real Inngest `step` object and a Claude-backed `createMessage` function.
   - `step.run("finalize")` inserts the `final` step and marks `runs.status = completed` with `final_answer` set. On any thrown error, `step.run("mark-failed")` records an `error` step and sets `runs.status = failed`.
5. **The bounded agent loop** — `@/e:/async-agent-workspace/src/lib/agentLoop.ts` (`runAgentIterations`) is a pure, dependency-injected function: it takes a `StepLike` (anything shaped like `run(id, fn)`) and a `createMessage` function, and loops up to `MAX_ITERATIONS = 6` times. Each iteration calls the model; if the response contains a `tool_use` block, it inserts a `tool_call` step, executes the tool inside its **own** `step.run(...)` (so it retries independently), inserts a `tool_result` step, and feeds the result back into the conversation. It stops as soon as the model returns a final text answer, or after 6 iterations (returning a fallback message). This separation from Inngest's actual step engine is what makes the loop unit-testable — see `@/e:/async-agent-workspace/src/lib/agentLoop.test.ts`.
6. **The tool** — `@/e:/async-agent-workspace/src/lib/tools.ts` (`fetchUrl`) validates the URL scheme, fetches with a 10s timeout, strips `script`/`style`/`nav`/etc. with `cheerio`, extracts body text, and truncates to ~6000 characters. `runTool` dispatches by name and throws on an unknown tool.
7. **Live updates** — `@/e:/async-agent-workspace/src/components/RunsList.tsx` and `@/e:/async-agent-workspace/src/components/RunDetail.tsx` load initial data via the Supabase **browser** (anon key) client, then subscribe to `postgres_changes` on the `runs` and `run_steps` tables (the latter filtered by `run_id`). Every insert/update Postgres makes is pushed to the browser over the Realtime publication enabled in the migration — no polling.

## 🗄️ Data model

Defined in `@/e:/async-agent-workspace/supabase/migration.sql`:

**`runs`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key, default `gen_random_uuid()` |
| `task` | `text` | the submitted task |
| `status` | `text` | `queued` \| `running` \| `completed` \| `failed` |
| `final_answer` | `text` | set on completion |
| `error` | `text` | set on failure |
| `created_at` / `updated_at` | `timestamptz` | |

**`run_steps`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `run_id` | `uuid` | FK to `runs.id`, `on delete cascade` |
| `idx` | `int` | ordering within a run |
| `type` | `text` | `plan` \| `tool_call` \| `tool_result` \| `final` \| `error` |
| `title` | `text` | short label shown in the UI |
| `detail` | `text` | full content (plan text, tool input/output, final answer) |
| `created_at` | `timestamptz` | |

Row Level Security is enabled on both tables with a public **read-only** policy (`for select using (true)`) — no write policies exist for the anon role, since all writes happen server-side through the service-role client, which bypasses RLS entirely. Both tables are added to the `supabase_realtime` publication so Realtime can stream changes.

## 💾 Where does the data go?

Every write in this app goes through the **service-role admin client** (`@/e:/async-agent-workspace/src/lib/supabase/admin.ts`), used only in server-only files (the API route and the Inngest function) — never in a Client Component, never behind a `NEXT_PUBLIC_` variable. The **browser client** (`@/e:/async-agent-workspace/src/lib/supabase/browser.ts`), built with the anon key, is read-only in this app: it's used for the initial `select` queries and the Realtime subscriptions, and RLS enforces that it can never write.

## 🏁 Key takeaway

The whole system works because every unit of background work is wrapped in its own `step.run(...)` — that single pattern is what buys checkpointing, independent retries, and a durable audit trail, without the app needing to build any of that machinery itself.

## 🤖 See also

For example inputs and troubleshooting, see [`USER_GUIDE.md`](./USER_GUIDE.md). For the reasoning behind these design decisions, see [`THOUGHT_PROCESS.md`](./THOUGHT_PROCESS.md).
