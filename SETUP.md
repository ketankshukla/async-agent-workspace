# SETUP — Project 5: Async Agent Workspace (background jobs + live progress)

Your checklist. This is a **production-infrastructure** project: a task runs in the background, survives you closing the tab, retries on failure, and streams its progress live. Two new pieces vs. Project 4: a background-job runner (**Inngest**) and **live updates** (Supabase Realtime). There's also a local quirk — you run **two dev servers** at once.

The file you hand to Windsurf is `PROMPT_5_async-agent-workspace.md`.

**What you're building:** submit a research task → it runs in the background as a durable, retryable job → you watch each step appear live → close the tab and come back to full run history. No login (single shared workspace for the demo).

---

## 1. Before you start (one-time)

**Accounts & keys:**
- [ ] GitHub, Vercel, Anthropic API key — reuse from earlier projects
- [ ] **A new Supabase project** (free) — same steps as Project 4 (New project → Settings → API → copy **Project URL**, **anon key**, and this time also the **service_role key**). See the note below about the service_role key.
- [ ] **Inngest account** (free, 50k runs/month) — inngest.com. *Only needed for deployment* — local development needs no account.

**Tools:** node v20+, git, gh (already set up). Login valid: `gh auth login`. *(No Vercel CLI — deploy via GitHub integration.)*

> **About the service_role key (important):** Project 4 didn't use it; this one does, correctly. Because the background job writes to the database with no logged-in user, it uses the **service_role key** — which is **server-only** and must **never** appear in client code or a `NEXT_PUBLIC_` variable. The browser only ever *reads* (with the anon key). The agent's code is structured so the service_role key is only ever imported in server files.

---

## 2. Start the build
1. Create an empty folder `async-agent-workspace`.
2. Put `PROMPT_5_async-agent-workspace.md` in it, renamed to `PROMPT.md`.
3. Open in Windsurf; pick **Claude Sonnet 5 (high)**; allow command execution.
4. Type:
   > Read `PROMPT.md` and complete every phase in order. Explain each step in plain language. Stop at every **⏸ PAUSE** and wait for me.

### Model & token tips
- **Default: Sonnet 5 (high).** Reserve **Opus 4.8** only for a stubborn bug (likely spots: the Inngest step loop, or Realtime not updating the UI).
- Commit after every phase so a bad turn costs one phase, not the whole build.

---

## 3. When the agent pauses — do the matching Action

### Action 1 — prerequisites + accounts
Confirm your Supabase project (URL + anon + service_role keys) and Inngest account exist. Fix anything Phase 0 flags.

### Action 2 — Add keys locally
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
INNGEST_DEV=1
```
Save, tell the agent "done." (Never commit this file. `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix on purpose — that keeps it server-only.)

### Action 3 — Run the database migration
The agent creates `supabase/migration.sql` (the `runs` and `run_steps` tables, public-read security rules, and Realtime enablement). Open Supabase → **SQL Editor → New query**, paste the file's contents, **Run**, confirm success, tell the agent "migration done."
> If a line about `supabase_realtime` errors with "already a member," that's harmless — the table is already enabled. Continue.

### Action 4 — Run BOTH dev servers (local testing)
This app needs two terminals running side by side:
- Terminal 1: `npm run dev` (your Next.js app)
- Terminal 2: `npx inngest-cli@latest dev` (the Inngest Dev Server — the background-job engine + a debug UI at http://127.0.0.1:8288)

The agent will tell you when to start these. Keep both running while you test. Submit a task in the app and watch steps appear live; check the Inngest UI to see the job, its steps, and any retries.

### Action 5 — (only if it asks) GitHub login
If the push fails, run `gh auth login`, then tell the agent to retry.

### Action 6 — Deploy by importing the repo into Vercel
1. vercel.com → **Add New… → Project** → **Import** the `async-agent-workspace` repo.
2. Add environment variables on the import screen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and optionally `ANTHROPIC_MODEL`. (Do **not** set `INNGEST_DEV` in production.)
3. Deploy, copy the **production URL**, give it to the agent.

### Action 7 — Connect Inngest to production
So the background jobs run in production:
1. Easiest: install the **Inngest integration from the Vercel Marketplace** (vercel.com → Integrations → Inngest → Add). It automatically sets `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` and auto-syncs your app on every deploy.
2. Redeploy once from the Vercel dashboard so the keys take effect.
3. In the Inngest dashboard, confirm your app synced and your function is listed. Tell the agent "Inngest connected."

---

## 4. You're done when
- The **live production URL** lets you submit a task, watch its steps stream in live, close the tab, reopen it, and still see the full run + history.
- If a step fails (e.g., a bad URL), the run shows the error gracefully and — where applicable — Inngest's automatic retry is visible in the Inngest dashboard.
- The repo `async-agent-workspace` exists with a **green Actions tab**; `.env.local` is not committed.
- There's a `README.md`.

Send me the live URL + repo link for your resume — this one says "I can build production-grade background infrastructure for agents."
