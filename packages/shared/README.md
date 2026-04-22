# `@taxai/shared` — Shared TypeScript Types

This package is the **single source of truth for every data contract** in the monorepo. It contains no logic — only TypeScript interfaces and type aliases.

All packages (`engine`, `ai-layer`) and both apps (`api`, `web`) import from here. **No package may change these types unilaterally** — changes must be coordinated across all consumers.

---

## What's inside

### `src/types.ts`

#### Inputs

| Type | Description |
|---|---|
| `TaxInput` | Everything the tax engine needs: fiscal year, region, age, salary, SS contributions, retenciones, dependants, civil status, disability grade, rent payments, savings income, rental income, other income, pension contributions, Catalonia deductions |
| `SpanishRegion` | Union of all 17 autonomía slugs (`'madrid'`, `'catalonia'`, …) |
| `CivilStatus` | `'single' \| 'married' \| 'widowed' \| 'separated'` |
| `DisabilityGrade` | `33 \| 65` |
| `RentPayments` | Annual rent paid + qualifying conditions (under-36, disability, large family, unemployed 6m) |
| `SavingsIncome` | Capital gains, dividends, and interest (base imponible del ahorro, Art. 46 LIRPF) |
| `RentalIncome` | Gross rental income and deductible expenses |
| `CataloniaDeductions` | Birth/adoption deduction, habitatge rent, research and ecological donations |

#### Outputs

| Type | Description |
|---|---|
| `TaxResult` | Complete engine output: every intermediate value, both cuota íntegra and cuota líquida (state + regional), retenciones, final result, and waterfall steps |
| `WaterfallStep` | One step in the visual waterfall: label, amount, running total, optional bracket rate |

#### Nómina parsing

| Type | Description |
|---|---|
| `NominaData` | Financial figures extracted from a payslip PDF: monthly/annual gross, IRPF base, retenciones, SS breakdown |
| `NominaParseResult` | Full result of `/api/parse-nomina`: extracted data, derived `TaxInput`, engine result, comparison |
| `NominaComparison` | Employer's withholding vs. calculated tax: difference, percentage, `overpaid/underpaid/correct` |
| `RentaAnualResult` | Aggregated result of `/api/parse-renta`: month-by-month array plus annual totals |

#### Broker / investment

| Type | Description |
|---|---|
| `StockTransaction` | One row from a broker report: asset, type (`buy/sell/dividend/interest/fee`), date, quantity, amount, fees, FX rate, foreign tax withheld |
| `BrokerReportData` | Full broker report: list of transactions plus optionally the broker's own reported totals |
| `BrokerParseResult` | Result of `/api/parse-broker`: raw report, FIFO-computed gains, dividends, interest, foreign tax withheld, partial `TaxInput`, engine result, warnings |

---

## Usage

```typescript
import type { TaxInput, TaxResult, NominaParseResult } from '@taxai/shared';
```

The package is ESM (`"type": "module"`) with `NodeNext` module resolution. Import paths must include the `.js` extension when used from Node.js packages.
