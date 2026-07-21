# 🧩 Project Standards

> **What this document is:** the shared style guide and file/structure checklist across `ai-data-extractor`, `rag-qa-assistant`, and `research-agent` — the three "AI-first programming" learning projects. Use it as the starting checklist for **every future project** in this series, even ones that add a database, auth, queues, or other tech these three don't have.

> **Scope note:** the *tech stack* section below (Next.js/TypeScript/Tailwind/Vitest/Vercel) reflects what these three projects happen to use. Future projects can swap or add technology (a database, an auth provider, a queue, etc.) — what should **stay constant** is the doc structure, emoji/heading style, file checklist, `.gitignore`/secrets pattern, and git/CI/deploy conventions described here.

---

## 📋 Required file checklist

Every project in this series ships with all of these, at the repo root:

| File | Purpose | Style |
|---|---|---|
| `PROMPT.md` | The exact build spec handed to the AI pair-programming agent (phases, rules, definition of done) | **Plain — no emoji.** This is a machine-followed spec, not a human-facing doc. |
| `SETUP.md` | The human's checklist: accounts/keys to get ready, and which Setup Action to do at each pause | **Plain — no emoji.** Mirrors `PROMPT.md`'s tone. |
| `README.md` | The main human-facing doc: what it is, live URL, how it works, setup, tests, deployment | **Emoji-heavy**, badges, "Companion docs" links (see below). |
| `USER_GUIDE.md` | How to actually use the deployed app: example inputs that work, ones that don't, tips, troubleshooting | **Emoji-heavy.** |
| `HOW_IT_WORKS.md` | Technical deep dive: a request-flow diagram + step-by-step trace through the real code | **Emoji-heavy.** |
| `THOUGHT_PROCESS.md` | The build reasoning, grounded in real commit history/code, plus a generalizable checklist | **Emoji-heavy.** See the rigor rule below — never invent snags you have no evidence for. |
| `AGENTS.md` | Framework-generated warning to read installed docs before coding (don't assume training-data APIs are current) | Framework-generated; leave as-is. |
| `CLAUDE.md` | One line: `@AGENTS.md` | Framework-generated; leave as-is. |
| `LICENSE` | MIT license, `Copyright (c) <year> ketankshukla` | Standard MIT text, no emoji. |
| `.env.local.example` | Template of required env var **names** (no real values) | Committed. Real `.env.local` is git-ignored. |
| `.github/workflows/ci.yml` | Node 20, `npm ci` → `npm run lint` → `npm test` → `npm run build`, on push/PR to `master`/`main` | Standard GitHub Actions workflow. |
| `PROJECT_STANDARDS.md` | This document — the shared style guide and file checklist, identical (or updated together) across every project | **Emoji-heavy.** Copy into every new project's root. |

If a future project doesn't have a clean analog for one of these (e.g. no separate "ingest" step to document), keep the file but adapt its content — don't drop the file from the checklist.

---

## 🎨 Doc style: the emoji + heading system

### Title emoji
Each project's `README.md` H1 gets **one** thematic emoji tied to what the app does (`📚` for the RAG assistant, `🧾` for the data extractor, `🧭` for the research agent). Pick something that reads naturally, not just "AI" clip art.

### Standard section emoji (use these exact ones — don't invent new emoji for the same concept)

| Emoji | Heading | Used in |
|---|---|---|
| ✨ | (intro sentence, no heading) | README |
| 🔗 | **Live URL:** | README |
| 📚 | **Companion docs:** | README |
| 📸 | *(Screenshot placeholder...)* | README |
| 🛠️ | Tech stack | README |
| 🎯 | What it does | README |
| 🔍 | How \[X\] works here | README |
| ⚙️ | Model configuration | README |
| 🚀 | Local setup | README |
| ✅ | Running tests | README |
| 📦 | Production build | README |
| ☁️ | Deployment | README |
| 📖 | How I built this | README |
| 🛡️ | Safety limits *(optional, if relevant)* | README |
| 📈 | Scaling upgrade path *(optional, if relevant)* | README |
| ➕ | Adding your own content *(optional, if relevant)* | README |
| 🧭 | How to use it | USER_GUIDE |
| 📂 | What's in the sample content | USER_GUIDE |
| ✅ | Example \[inputs/tasks/questions\] that work | USER_GUIDE |
| ⚠️ | Example \[inputs\] that should NOT work / out-of-scope | USER_GUIDE |
| 💡 | Tips for best results | USER_GUIDE |
| 🛠️ | Troubleshooting | USER_GUIDE |
| 🔬 | How This App Works (title) | HOW_IT_WORKS |
| 🤖 | "See also" cross-reference callout | HOW_IT_WORKS |
| 🧠 | The short answer (explained like you're 5) | HOW_IT_WORKS / THOUGHT_PROCESS title |
| ❓ | Why \[design decision\] | HOW_IT_WORKS |
| 🔁 | Full request flow, end to end / one-sentence version | HOW_IT_WORKS / THOUGHT_PROCESS |
| 🪜 | Step by step | HOW_IT_WORKS |
| 💾 | Where does the data go? | HOW_IT_WORKS |
| 🏁 | Key takeaway | HOW_IT_WORKS |
| 🗺️ | Part 1 — how the build unfolded | THOUGHT_PROCESS |
| 🎯 | Part 2 — generalizable checklist | THOUGHT_PROCESS |
| 🛠️ | "Fix:" callout inside a snag | THOUGHT_PROCESS |
| 1️⃣2️⃣3️⃣... | Numbered checklist rows | THOUGHT_PROCESS |
| 🧩 | PROJECT_STANDARDS.md title + its Companion docs link | README / PROJECT_STANDARDS |
| 🗄️ | Data model | HOW_IT_WORKS |

Keep this table itself updated if a future project introduces a genuinely new recurring heading (e.g. a database project might add a `🗄️ Data model` section) — add the new emoji here so the *next* project reuses it instead of picking a different one.

### Badges (top of every README, in this order)
```markdown
[![CI](https://github.com/ketankshukla/<repo>/actions/workflows/ci.yml/badge.svg)](https://github.com/ketankshukla/<repo>/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)
[![Deployed on Vercel](https://img.shields.io/badge/deployed-vercel-black.svg)](<live-url>)
```

### "Companion docs" block (right after the Live URL line)
```markdown
📚 **Companion docs:**
- 📖 [`USER_GUIDE.md`](./USER_GUIDE.md) — how to use the app, example inputs that work, and troubleshooting
- 🔬 [`HOW_IT_WORKS.md`](./HOW_IT_WORKS.md) — end-to-end technical deep dive into the [core flow]
- 🧠 [`THOUGHT_PROCESS.md`](./THOUGHT_PROCESS.md) — the reasoning behind how this was built, plus a checklist for starting a project like this from scratch
- 🧩 [`PROJECT_STANDARDS.md`](./PROJECT_STANDARDS.md) — the shared style guide and file checklist used across this whole project series
```

### README section order
1. H1 with title emoji
2. Badges
3. ✨ One-line intro
4. 🔗 Live URL
5. 📚 Companion docs block
6. 📸 Screenshot placeholder
7. 🛠️ Tech stack
8. 🎯 What it does *(if not already fully covered by the intro)*
9. 🔍 How it works here *(short version — points to `HOW_IT_WORKS.md` for the deep dive)*
10. *(project-specific sections, e.g. ➕ Adding your own content, 🛡️ Safety limits)*
11. 🚀 Local setup *(includes ⚙️ Model configuration sub-section as a table)*
12. ✅ Running tests
13. 📦 Production build
14. ☁️ Deployment
15. 📖 How I built this *(points to `THOUGHT_PROCESS.md`)*
16. *(project-specific closing sections, e.g. 📈 Scaling upgrade path)*

### Model configuration table format
```markdown
| Env var | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | — (required) |
| `ANTHROPIC_MODEL` | Model ID to use | `claude-opus-4-8` |
```
When a future project adds new required config (a database URL, an auth secret, a queue connection string, etc.), add a row here rather than a separate ad-hoc section — keep all env vars in one table.

### GitHub rendering constraint
GitHub sanitizes custom CSS out of markdown — no forced colors or custom font sizes on github.com. `THOUGHT_PROCESS.md` (and any doc leaning on visual hierarchy) should rely only on what GitHub *does* render: heading levels, emoji, blockquotes, tables, and horizontal rules. State this rendering-note explicitly at the top of `THOUGHT_PROCESS.md`.

---

## 🧠 The rigor rule for `THOUGHT_PROCESS.md`

`THOUGHT_PROCESS.md` must be **grounded in real evidence** — the actual commit history, real diffs, and real code — not a dramatized reconstruction of bugs that may not have happened. When writing or updating one:
- If you personally lived through the build (same session), you may describe real snags and fixes directly.
- If you're documenting a *past* build you don't have first-hand memory of, check `git log`/diffs first. Only describe a "snag" if you can point to verifiable evidence (a diff that fixes something, a config line that only makes sense as a fix, etc.). Otherwise, describe the **design reasoning visible in the code** instead of inventing a debugging story.
- Never fabricate specific error messages, timings, or events that aren't verifiable.

---

## ⚙️ Config file conventions

### `.gitignore` — env file handling
```gitignore
# env files (can opt-in for committing if needed)
.env*
!.env.local.example
```
This exact pattern (blanket-ignore `.env*`, then negate the one template file) is required in every project — it's the smallest change that keeps secrets ignored while letting the committed template through. If a project needs more than one template file, add more explicit negations rather than a broader wildcard.

### `package.json` script names (keep these exact names across projects)
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
}
```
Add project-specific scripts (like `"ingest": "tsx scripts/ingest.ts"` in the RAG project) as extra entries, never by renaming/removing the standard five.

### CI workflow (`.github/workflows/ci.yml`)
```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```
If a future project needs a database or other service in CI (e.g. a test database), add it as an additional service/step — keep the four core steps (`npm ci`, lint, test, build) in that order regardless.

### `LICENSE`
MIT, `Copyright (c) <current year> ketankshukla`. Same boilerplate text in every project — copy verbatim, only update the year if a project starts in a later year.

---

## 🛠️ Baseline tech stack (current three projects)

- Next.js (App Router) + TypeScript + Tailwind CSS
- Anthropic SDK (`@anthropic-ai/sdk`) for the AI feature
- Vitest for unit tests
- GitHub Actions for CI
- Vercel for hosting, connected via its **GitHub integration** (push to `master` auto-deploys) — not direct `vercel`/`vercel --prod` CLI deploys, per standing account rules

## 🧱 Extending the stack for future projects

These three projects are deliberately minimal — no database, no auth, no background jobs. Future projects in this series may add:
- **A database** (e.g. Postgres/Supabase) — document its schema in `HOW_IT_WORKS.md` under a new `🗄️ Data model` section (add this emoji to the legend above once used), add connection env vars to the Model configuration table, and add the DB file/migration folder to the required-file checklist for that project type.
- **Auth** — document the auth flow in `HOW_IT_WORKS.md`, add a `🔐 Auth` section, add provider secrets to the env var table.
- **Background jobs/queues** — treat like the RAG project's `ingest.ts`: a separate, documented, manually-triggered (or scheduled) script, not hidden inside the request path.

Whatever the new technology, the **rule that doesn't change**: one committed env-var template, one `.gitignore` pattern protecting secrets, one Model/Config table listing every required env var, one CI workflow running lint/test/build, and the same doc set (`README`/`USER_GUIDE`/`HOW_IT_WORKS`/`THOUGHT_PROCESS`) describing it in the same emoji/structure style.

---

## 🔀 Git & workflow conventions

- **One phase, one commit.** Commit messages use a `type: description` prefix — `chore:`, `feat:`, `test:`, `ci:`, `docs:` — matching the phase being completed.
- **Never commit secrets.** Verify `.env.local` *exists* (e.g. `Test-Path`), never read or print its contents.
- **When two instructions conflict** (e.g. a build spec says use the Vercel CLI, but a standing account rule says deploy via GitHub only), **stop and ask** — don't silently pick a side, especially for deployment/account actions.
- **Public repos**, named after the project folder (`ai-data-extractor`, `rag-qa-assistant`, `research-agent`, ...).
- **Verify, don't assume:** run the real command (`npm test`, `npm run build`, a real API call against a real deployed URL) and read its actual output before claiming something works.

---

## 🔁 The one-sentence version

> **Same file checklist, same emoji-and-heading system, same secrets/CI/deploy conventions, every project — no matter what new technology a future project adds on top.**
