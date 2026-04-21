# Agent B — Integration Sprint: Connect Live API + 2025 Labels

You are Agent B. Your branch is `feature/frontend`. The project is now in integration phase — Agent A is fixing the backend engine. Your job is 3 small but important fixes so the UI connects to the real API correctly.

---

## Fix 1 — Remove mock data from initial state (MOST IMPORTANT)

**File:** `packages/frontend/src/App.tsx`

The app currently loads `MOCK_RESULT` as the initial state, so the user always sees fake data on load. Fix it:

Find the line that looks like:
```ts
const [result, setResult] = useState<TaxResult | null>(MOCK_RESULT)
```
Change it to:
```ts
const [result, setResult] = useState<TaxResult | null>(null)
```

Then remove the `MOCK_RESULT` import from the top of the file. The mock file (`src/mocks/taxResult.ts`) can stay — it is used by tests — but it must not load in the app.

Verify the empty state UI shows correctly (the guidance message, not an empty screen).

---

## Fix 2 — Update "IRPF 2024" labels to "IRPF 2025"

Search all `.tsx` and `.ts` files in `packages/frontend/src/` for any hardcoded `2024` strings used as **display text** (not inside mock data or test fixtures).

Key places to check:
- `App.tsx` header subtitle (should read "Calculadora IRPF 2025")
- `ResultDashboard.tsx` — any year label
- `InputForm.tsx` — any placeholder or label referencing the year
- `src/api/taxai.ts` — if fiscalYear is hardcoded anywhere

---

## Fix 3 — Default fiscalYear to 2025 in the form

**File:** `packages/frontend/src/components/InputForm.tsx`

Find the `fiscalYear` field initial value and change it from `2024` to `2025`.

---

## When done

Run `pnpm --filter @taxai/frontend test` — all tests should still pass.

Commit: `feat(frontend): connect live API + 2025 labels [SIGNAL: frontend-live-ready]`

---

## What comes next (you don't need to act on this yet)

Once Agent A signals `[SIGNAL: engine-2025-ready]`, pull their fixes:
```bash
git fetch origin
git merge origin/feature/backend --no-edit
```

Then the orchestrator (main session) will run the full integration test. If any UI bugs are found, they will be sent back to you with exact reproduction steps.
