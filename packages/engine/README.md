# `@taxai/engine` — Deterministic Tax Engine

This package is **The Brain** of Taxai. It performs all tax arithmetic using official AEAT tables loaded from JSON files. It has no AI calls, no network requests, and no side effects — given the same input it always returns the same output.

---

## Exports

```typescript
import { calculate } from '@taxai/engine';          // IRPF calculation
import { computeBrokerFIFO } from '@taxai/engine';  // Capital gains FIFO
```

---

## `calculate(input: TaxInput): TaxResult`

Main entry point. Runs the complete IRPF calculation for the given fiscal year and region.

### Calculation steps (in order)

1. **Load rules** — reads `rules/{fiscalYear}/state.json` and `rules/{fiscalYear}/{region}.json`
2. **Art. 19 gastos deducibles** — subtract employee SS contributions from gross salary
3. **Art. 20 reducción por rendimientos del trabajo** — applied to `gross − SS`:
   - *2025/2026*: €2,000 flat + two-segment phase-out (Ley 5/2025)
   - *2024*: single linear phase-out from threshold to €19,747
4. **Rendimiento neto reducido** = `max(0, gross − SS − trabajoReduction)`
5. **Base imponible general** = rendimientoNetoReducido + rental income (net) + other income − pension reduction
6. **Base imponible del ahorro** = capital gains + dividends + interest (Art. 46 LIRPF), with loss-offset rule (losses offset up to 25% of passive income)
7. **Mínimo personal y familiar** (Art. 57–61 LIRPF) — personal base + age supplements + descendants + ascendants
8. **Cuota íntegra** — each tarifa applied to the **full base independently**:
   - State brackets → `cuotaIntegraEstatal`
   - Regional brackets → `cuotaIntegraAutonomica`
   - Savings brackets (state + regional) applied to savings base
   > This is NOT a 50/50 split — each tarifa has its own rates and is applied to the complete base.
9. **Cuota líquida** = `max(0, cuotaIntegra − minQuota)` per half, after applying minimum quotas to each tarifa
10. **2025+ deduction** — up to €340 from cuota líquida (phases out €16,576–€18,276), split 50/50
11. **Regional deductions** — rent deduction (varies by autonomía and qualifying conditions), Catalonia-specific deductions
12. **Result** = `cuotaLiquidaTOTAL − retenciones` → `a_ingresar`, `a_devolver`, or `cero`

All arithmetic uses **integer cents** internally. `Math.round()` at each bracket boundary prevents floating-point drift. Values are converted to euros only for the final `TaxResult`.

---

## `computeBrokerFIFO(transactions: StockTransaction[]): BrokerFIFOResult`

Implements the FIFO cost-basis method required by **Art. 35 LIRPF** for listed securities.

- Groups transactions by `assetId`
- Processes each asset's buy/sell history chronologically using FIFO lots
- Converts non-EUR amounts using the `fxRate` field (caller's responsibility — engine never calls external APIs)
- Applies the **anti-washing-sale rule (Art. 33.5 LIRPF)**: if the same asset is repurchased within 2 months of a loss sale, the loss is deferred
- Aggregates dividends and interest separately from capital gains
- Returns warnings for edge cases (missing lots, missing FX rates, deferred losses)

---

## Source files

| File | Purpose |
|---|---|
| `src/calculator.ts` | Main orchestrator — runs all steps in order |
| `src/brackets.ts` | Progressive bracket application (returns cents) |
| `src/minimums.ts` | Mínimo personal y familiar (Art. 57–61 LIRPF) |
| `src/reductions.ts` | Rendimientos del trabajo reductions (2024 + 2025 formulas) |
| `src/fifo.ts` | FIFO capital gains engine (Art. 35 LIRPF) |
| `src/deductions/rent.ts` | Tenant rent deduction (applied to cuota líquida autonómica) |
| `src/types.ts` | Internal types: `Bracket`, `TrabajoReductions`, `RegionRules`, `StateRules`, `RentDeductionRule` |
| `src/index.ts` | Public exports |

---

## Tax rules JSON

Rules live in `rules/{year}/{region}.json`. The engine auto-detects which formula to use:

- Presence of `phaseOutSegment1End` → 2025/2026 two-segment path
- Presence of `phaseOutStart`/`phaseOutEnd` → 2024 legacy path

**Supported years:** 2024, 2025, 2026  
**Supported regions:** state + all 15 common-regime autonomías (17 files per year)

Adding a new fiscal year only requires creating a new `rules/{year}/` directory — no code changes needed.

### JSON schema — 2025/2026 regional file

```json
{
  "region": "madrid",
  "fiscalYear": 2025,
  "autonomicBrackets": [
    { "from": 0, "to": 13362, "rate": 0.0850 },
    { "from": 13362, "to": null, "rate": 0.2050 }
  ],
  "trabajoReductions": {
    "gastoFlatDeduction": 2000,
    "fullReductionThreshold": 14852,
    "maxReduction": 7302,
    "phaseOutSegment1End": 17673.52,
    "phaseOutRate1": 1.75,
    "phaseOutSegment2End": 19747.50,
    "phaseOutRate2": 1.14,
    "segment2BaseReduction": 2364.34
  },
  "rentDeduction": {
    "rate": 0.30,
    "capGeneral": 1000,
    "capEnhanced": 1500,
    "incomeCeilingIndividual": 24000,
    "incomeCeilingJoint": 48000,
    "enhancedConditions": ["under36", "disability", "largefamily"],
    "notes": "..."
  }
}
```

---

## Tests

```bash
pnpm --filter @taxai/engine test
```

| Test file | Coverage |
|---|---|
| `integration.test.ts` | 40+ cases covering all 15 regions for 2025, parity against AEAT simulator |
| `madrid.test.ts` | Madrid-specific bracket and reduction cases |
| `catalonia.test.ts` | Catalonia brackets + regional deductions |
| `regions.test.ts` | Smoke tests for every supported region |
| `edge-cases.test.ts` | Zero salary, maximum dependants, high earners, foral rejection |
| `fifo.test.ts` | FIFO capital gains: basic, anti-washing-sale, FX conversion |
| `rent-deduction.test.ts` | Rent deduction with various qualifying conditions |

**Parity requirement:** every region must match the AEAT official simulator to the cent for at least 5 test cases before shipping.
