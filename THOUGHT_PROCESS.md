# 🧠 Thought Process

> **Rendering note:** GitHub strips custom CSS from rendered markdown, so this doc relies only on what GitHub actually renders — heading levels, emoji, blockquotes, tables, and horizontal rules. No forced colors or font sizes.

> **Grounding note:** every snag described below is real — pulled directly from this project's own commit history (`git log`) and the actual build session, not a dramatized reconstruction.

---

## 🗺️ Part 1 — how the build unfolded

The build followed `PROMPT.md` phase by phase, one commit per phase, so a wrong turn would cost one phase rather than the whole build. Real commit history:

```
chore: scaffold Next.js app
chore: deps and env template
feat: supabase browser + server-admin clients
feat: runs + run_steps schema, RLS read, realtime
feat: inngest client + serve route
feat: fetch_url tool + dispatcher
feat: durable agent function with checkpointed steps
feat: /api/runs enqueue route
feat: live runs list + streaming run detail
test: tools, loop cap, input validation
fix: suppress extension-caused hydration warning; mark run failed if enqueue fails
ci: workflow
docs: README and MIT license
```

The early phases (scaffold, dependencies, Supabase clients, schema) went smoothly — they're mostly following the exact patterns `PROMPT.md` specifies. The real decisions and snags showed up once the pieces started running together.

### 🛠️ Snag: a lint rule caught a real anti-pattern in the live-updating UI

While wiring up `RunDetail`'s `useEffect` to load a run and its steps, ESLint's `react-hooks/set-state-in-effect` rule flagged calling `setLoading(true)` / `setError(null)` directly in the effect body (before the async function). **Fix:** moved those calls inside the async `loadRunAndSteps` function itself, so state updates only happen as part of the async work, not synchronously during the effect's setup phase.

### 🛠️ Snag: extracting the agent loop exposed two real type mismatches

To make the tool-use loop unit-testable without simulating Inngest's whole step engine, the loop logic was pulled out of `runAgent.ts` into a standalone `agentLoop.ts` that takes an injectable `step`-like runner. This surfaced two things `tsc` caught immediately:
- A hand-rolled `ToolUseBlock` interface was missing the `caller` field the Anthropic SDK's real `ToolUseBlock` requires, so it wasn't a valid type-guard target against the SDK's `ContentBlock` union. **Fix:** derived the type from the SDK directly (`Extract<ContentBlock, { type: "tool_use" }>`) instead of hand-rolling it.
- Inngest's real `step.run` return type is wrapped in `Jsonify<...>` for checkpointing, which doesn't structurally match a plain `Promise<T>`. **Fix:** an explicit `as unknown as StepLike` cast at the one call site where the real Inngest step is handed to the extracted loop — safe because the loop's return values (strings, plain objects) round-trip through JSON without meaningful loss.

### 🛠️ Snag: a browser extension caused a hydration mismatch

During local verification, `npm run dev` logged a hydration warning showing an unexplained `webcrx=""` attribute on the `<html>` tag — never rendered anywhere in this app's own code. **Fix:** added `suppressHydrationWarning` to the `<html>` element in `layout.tsx`, since the mismatch is caused by a browser extension mutating the DOM before React hydrates, not by application logic.

### 🛠️ Snag: an orphaned `queued` run if enqueueing failed after the row was already inserted

Also during local verification, submitting a task before starting the Inngest Dev Server produced `TypeError: fetch failed ... ECONNREFUSED` from `inngest.send(...)` — expected, since nothing was listening on the dev server port yet. But this exposed a real gap: the `runs` row is inserted into Postgres *before* `inngest.send(...)` is called, so a failed send left a row stuck at `queued` forever, with no job ever going to process it. **Fix:** wrapped the send in its own try/catch that explicitly marks the run `failed` (with a clear `error` message) if enqueueing fails, instead of leaving a silent zombie row.

### 🛠️ Snag: `next build` failed in CI with zero env vars

CI has no real secrets by design. `npm run build` failed during Next.js's "Collecting page data" step with `Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables` — because Next.js imports API route modules to collect metadata even for fully dynamic (non-prerendered) routes, which triggered the admin Supabase client's startup validation. **Fix:** gave the CI workflow non-secret placeholder values (fake URLs/keys) purely so module-level validation passes — never a live credential.

### 🛠️ Snag: Inngest synced against the wrong URL in production

After installing the Inngest Vercel integration, the Inngest dashboard reported "We could not reach your URL" — because it had synced against a deployment-specific hashed preview URL rather than the stable production domain. **Fix:** re-synced explicitly against `https://async-agent-workspace.vercel.app/api/inngest`, the permanent production domain, not the per-deployment URL.

---

## 🎯 Part 2 — generalizable checklist

1️⃣ Read the installed framework's own docs (`AGENTS.md` pointed here) before trusting training-data knowledge of its APIs — breaking changes between versions are real and will fail silently otherwise.

2️⃣ Design for durability from the start: wrap every unit of background work in its own independently-retryable step, rather than one large all-or-nothing function.

3️⃣ Always hard-cap agentic loops with a maximum iteration count — never trust the model to terminate on its own.

4️⃣ Keep loop/business logic pure and framework-agnostic where possible (an injectable "step-like" interface instead of a concrete framework object) — it's what makes the hardest-to-test part of the system actually testable.

5️⃣ Strictly separate read-only (anon) and write (service-role) database clients by file/import boundary, never by convention alone.

6️⃣ Remember build tooling can execute more module-level code than you expect (e.g. Next.js importing routes at build time) — validate required env vars in a way that doesn't break CI, or give CI safe non-secret placeholders.

7️⃣ Whenever a multi-step operation can partially fail (a DB row created, then a follow-up call fails), explicitly handle the half-done state — don't leave orphaned records.

8️⃣ When connecting an external service to a Vercel deployment, always point it at the stable production domain, not a deployment-specific preview URL.

9️⃣ Commit after every phase of a build. It turns "one wrong turn ruins the session" into "one wrong turn costs one phase."
