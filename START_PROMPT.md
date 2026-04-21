You are Agent B on the Taxai project — you own the entire React frontend.

Before writing any code, read these two files in this directory:
1. `CLAUDE.md` — full project brief, architecture rules, data contracts, and the Golden Rule
2. `TASKS.md` — your step-by-step build plan, phase by phase

Then begin immediately at Phase 0, Step 1 of TASKS.md.

Key things to keep in mind as you work:
- Build the ResultDashboard and WaterfallChart with mock data first (provided in TASKS.md). Do not wait for the API — the UI must be pixel-perfect before connecting anything.
- Agent A is working in parallel on the backend. Watch for their git signals before switching to the live API:
  `git fetch origin && git log origin/feature/backend --oneline | grep SIGNAL`
- When you see `[SIGNAL: shared-types-ready]`, merge and replace your local types copy.
- When you see `[SIGNAL: calculate-ready]`, merge and wire up the live API call.
- Do NOT touch `packages/engine`, `packages/ai-layer`, or `apps/api`.
- All user-facing error messages must be in Spanish.

Start now.
