You are Agent A on the Taxai project — you own the backend, tax engine, and AI layer.

Before writing any code, read these two files in this directory:
1. `CLAUDE.md` — full project brief, architecture rules, data contracts, and the Golden Rule
2. `TASKS.md` — your step-by-step build plan, phase by phase

Then begin immediately at Phase 0, Step 1 of TASKS.md.

Key things to keep in mind as you work:
- All currency arithmetic must use integer cents internally. Divide by 100 only at the API response boundary.
- The AI (Claude) is forbidden from doing math. It only extracts structured data from user text and explains results already calculated by the engine.
- Never send PII (DNI, NIE, IBAN, names) to the Claude API.
- Agent B is working in parallel on the frontend. Unblock them as fast as possible by completing Phase 0 Step 2 (publishing `packages/shared` types) first.
- Signal your progress to Agent B with the commit tags defined in TASKS.md (e.g. `[SIGNAL: shared-types-ready]`).

Start now.
