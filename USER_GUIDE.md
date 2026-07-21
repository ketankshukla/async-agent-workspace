# 🧭 How to use it

Open the [live app](https://async-agent-workspace.vercel.app/), type a task into the **New research task** box, and hit **Submit**. The run appears in the list on the left immediately (status `queued`), then updates live as it moves through `running` → `completed` (or `failed`). Click any run in the list to see its full step-by-step trace on the right — plan, tool calls, tool results, and the final answer — appearing live as each one is written.

Closing the tab and reopening it reloads your full run history; nothing is lost.

## 📂 What's in the sample content

There's no seeded sample data — this is a blank workspace. Every run you see was submitted by someone testing the app. The agent has exactly **one tool**: `fetch_url`, which can only read a page if you give it (or it guesses) an exact URL — it does not have a general web search tool.

## ✅ Example tasks that work

- **Give it a direct URL to read:**
  > "Fetch https://en.wikipedia.org/wiki/TypeScript and give me a 3-bullet summary."
- **Multiple URLs in one task** (exercises more than one tool-call iteration):
  > "Fetch https://en.wikipedia.org/wiki/TypeScript and https://en.wikipedia.org/wiki/JavaScript, then compare them in 3 bullet points."
- **General knowledge, no tool needed:**
  > "Explain what a durable background job is, in plain language."

## ⚠️ Example tasks that should NOT work / out-of-scope

- **Breaking news / very recent events without a URL:**
  > "Get me the score of [some recent sports final]."
  The agent has no search tool — without a URL to fetch, it can only answer from its own training knowledge, which may be outdated or simply wrong for recent events. Give it a direct, fetchable URL instead (see above).
- **Unreachable or invalid URLs:**
  > "Fetch https://this-domain-does-not-exist-xyz123.test and summarize it."
  This is expected to fail gracefully — the run's step trace will show a `tool_result` marked as an error, and the run may still produce a final answer noting the fetch failed (or end as `failed`, depending on how the model responds). This is a good way to see the failure path in action.
- **Empty task:** the form and the `/api/runs` endpoint both reject an empty or missing `task` field with a 400 error before anything is enqueued.

## 💡 Tips for best results

- Be specific and include a real URL if you want the agent to ground its answer in real content — it will not guess a URL correctly for most requests.
- Keep tasks scoped to what's readable from a single page's text content; the tool truncates page text to ~6000 characters, so very long pages get cut off.
- If a run seems stuck at `queued`, the background job engine (Inngest) may not have picked it up yet — check the Inngest dashboard, or locally, confirm the Inngest Dev Server is running.

## 🛠️ Troubleshooting

- **Run stuck at `queued` forever:** in production this means the background job was never picked up — check the Inngest dashboard for sync status. Locally, make sure `npx inngest-cli@latest dev` is running alongside `npm run dev`.
- **Run shows `failed` immediately after submitting:** the app couldn't enqueue the background job (e.g. the Inngest Dev Server wasn't running yet locally). The run's `error` field explains why; resubmit once the Dev Server / Inngest connection is confirmed working.
- **Steps don't appear live, only after a refresh:** open the browser console and check for Supabase Realtime channel errors — this usually means the Realtime subscription didn't connect, not that the backend failed.
- **The final answer is wrong or made up:** the agent only has one tool (`fetch_url`) and no general search — see "Example tasks that should NOT work" above.
