# Agent A — Integration Sprint: 2025 Fiscal Fix

You are Agent A. Your branch is `feature/backend`. The project is now in integration phase.

**Before anything else, read `TAX_RULES_2025.md` in the project root.** It is the authoritative source for all 2025 tax rules and overrides CLAUDE.md and your original TASKS.md wherever they differ.

---

## You have exactly 4 bugs to fix, then a rules migration. Work in this order.

---

### Bug 1 — CRITICAL: Engine applies brackets to half the base (wrong architecture)
**File:** `packages/engine/src/calculator.ts`

The current code splits `baseImponibleGeneral` in half and applies state brackets to one half and regional brackets to the other. **This is wrong.** It produces approximately half the correct tax.

**Fix:** Apply state brackets to the **full** `baseImponibleGeneral`. Apply regional brackets to the **full** `baseImponibleGeneral`. The rates in the JSON files are already sized for the full base (state rates 9.5–24.5%, regional rates 8.5–29.5%). Do NOT halve anything.

---

### Bug 2 — Trabajo reduction uses 2024 formula (Ley 5/2025 changed it)
**File:** `packages/engine/src/reductions.ts`

Replace the current formula with the 2025 two-segment formula from TAX_RULES_2025.md §4:

```
rnt ≤ 14852                     → reduction = 7302
14852 < rnt ≤ 17673.52          → reduction = 7302 − [1.75 × (rnt − 14852)]
17673.52 < rnt < 19747.50       → reduction = 2364.34 − [1.14 × (rnt − 17673.52)]
rnt ≥ 19747.50                  → reduction = 0
```

All values in **cents** internally. The thresholds above are euros — convert to cents for comparisons.

---

### Bug 3 — Child under-3 supplement is wrong (€1,000 → €2,800)
**File:** `packages/engine/src/minimums.ts`

Find the under-3 supplement and change it from `100000` cents to `280000` cents.

---

### Bug 4 — Missing €340 cuota deduction for low earners (new in 2025)
**File:** `packages/engine/src/calculator.ts`

After computing `cuotaLiquidaTOTAL`, apply the deduction from TAX_RULES_2025.md §5:

```
rendimientos ≤ 16576            → deduct 340 (in euros, i.e. 34000 cents)
16576 < rendimientos ≤ 18276    → deduct 340 − [0.2 × (rendimientos − 16576)]
rendimientos > 18276            → deduct 0
```

Split the deduction 50/50 between `cuotaLiquidaEstatal` and `cuotaLiquidaAutonomica`. Neither can go below zero. Add a `waterfallStep` labelled `'Deducción por rendimientos del trabajo'` showing the deduction amount (negative).

---

### 2025 Rules Migration

1. Create `packages/engine/rules/2025/state.json` — same state brackets as 2024 (unchanged for 2025)
2. Create `packages/engine/rules/2025/{region}.json` for **all 17 autonomías** using the exact brackets from TAX_RULES_2025.md §3. Pay special attention to:
   - **Madrid**: 5 brackets, thresholds changed (now starts at 13,362 not 12,450)
   - **Comunidad Valenciana**: 11 brackets, top rate 29.5%
   - **Navarra**: 11 brackets, unified foral tarifa (no state/regional split) — for now just create the JSON but have the API return `501` for navarra and pais-vasco
3. Update the `trabajoReductions` in each regional JSON to the 2025 schema from TAX_RULES_2025.md §10 (new fields: `phaseOutSegment1End`, `phaseOutRate1`, `phaseOutSegment2End`, `phaseOutRate2`, `segment2BaseReduction`)
4. Make the API default `fiscalYear` to `2025` when the field is not provided in the request body

### Update parity tests

The old expected values in `tests/madrid.test.ts` and `tests/catalonia.test.ts` are based on the wrong 50/50 architecture AND 2024 rules. After fixing the engine:

- Run the **Agencia Tributaria official simulator** at `https://sede.agenciatributaria.gob.es/Sede/declaracion-anual/renta-2025.html` for each of the 5 test inputs
- Use the exact AT values as the expected values in the tests
- Tolerance: ≤ €1 (rounding differences allowed)

---

### When done

Run `pnpm test` from the monorepo root. All tests must pass.

Commit: `feat(engine): 2025 rules + architecture fix + all parity tests pass [SIGNAL: engine-2025-ready]`

Then merge master into your branch to pick up TAX_RULES_2025.md:
```bash
git merge master --no-edit
```
