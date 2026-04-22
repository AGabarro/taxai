# CLAUDE.md — Taxai: AI-Assisted IRPF Calculator (Spain)
> This file is the single source of truth for all agents working on this project.
> Read it fully before writing any code. Every architectural decision here has a reason.

---

## 1. Project Identity

**What we build:** A "Glass Box" IRPF tax estimator for Spanish residents. Users enter their financial situation and receive an instant, accurate, and fully understandable tax breakdown.

**Why it matters:** Agencia Tributaria tools are cumbersome. Private gestorías are expensive for simple salary earners. We make tax transparency accessible.

**Fiscal year support:** 2024, 2025 (Ley 5/2025), and 2026. The engine loads rules from JSON files — adding a new year requires only a new `engine/rules/{year}/` directory, no code changes.

---

## 2. The Golden Rule (Non-Negotiable)

> **THE AI IS FORBIDDEN FROM DOING MATH.**

The system has exactly two components and they must never swap roles:

| Component | Nickname | Responsibility |
|---|---|---|
| Deterministic Tax Engine | **The Brain** | All arithmetic, all tax logic, all money. Uses official tables. |
| Claude claude-sonnet-4-6 | **The Voice** | Translates human input / PDFs → structured JSON. Translates Engine output → plain Spanish explanation. |

If the AI ever suggests a tax figure, the system is compromised. The AI only describes what the Engine already calculated.

**Privacy corollary:** No PII (name, DNI/NIE, address, bank details) is ever sent to the Claude API. Only anonymized financial figures and region codes.

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend runtime | Node.js 22 + TypeScript | `.nvmrc` pins to `22`. Strict mode throughout. |
| Package manager | pnpm (workspace) | `pnpm-workspace.yaml` defines `packages/*` and `apps/*` |
| Backend framework | Fastify 4 | Low overhead, schema validation built-in |
| AI SDK | `@anthropic-ai/sdk ^0.27` | Claude claude-sonnet-4-6 access |
| Frontend | React 19 + TypeScript + Vite | Component model fits the waterfall chart |
| Styling | Tailwind CSS v4 | Rapid, consistent UI |
| Charts | Recharts 2 | Composable waterfall / bar / pie charts |
| PDF export | `@react-pdf/renderer` | Client-side PDF generation for tax result, nómina, renta anual |
| Tax rules storage | JSON files under `engine/rules/` | Swappable per fiscal year without code changes |
| Testing | Vitest (backend + frontend) | Unified test runner across all packages |
| PDF parsing | `pdf-parse` v1 | Text extraction from nómina / broker PDFs |

---

## 4. Repository Structure

```
taxai/
├── CLAUDE.md                        ← you are here
├── README.md                        ← GitHub-facing project overview and setup guide
├── .nvmrc                           ← pins Node 22
├── .env.example                     ← ANTHROPIC_API_KEY, PORT
├── pnpm-workspace.yaml              ← workspace definition
├── tsconfig.base.json               ← shared TS config (NodeNext, ESM, strict)
├── package.json                     ← workspace root (scripts: dev:api, dev:ui, test, build)
├── packages/
│   ├── shared/                      ← shared TypeScript types — neither agent changes unilaterally
│   │   └── src/
│   │       ├── types.ts             ← all shared interfaces (see Section 5)
│   │       └── index.ts
│   ├── engine/                      ← deterministic tax engine, no AI, no network calls
│   │   ├── src/
│   │   │   ├── index.ts             ← exports: calculate(), computeBrokerFIFO()
│   │   │   ├── calculator.ts        ← main entry point, orchestrates all steps
│   │   │   ├── brackets.ts          ← progressive bracket application (returns cents)
│   │   │   ├── minimums.ts          ← mínimo personal y familiar (Art. 57–61 LIRPF)
│   │   │   ├── reductions.ts        ← rendimientos del trabajo reductions (2024 + 2025 formulas)
│   │   │   ├── fifo.ts              ← FIFO capital gains engine (Art. 35 LIRPF) + anti-washing-sale rule
│   │   │   ├── deductions/
│   │   │   │   └── rent.ts          ← tenant rent deduction (applied to cuota líquida autonómica)
│   │   │   └── types.ts             ← Bracket, TrabajoReductions, RegionRules, StateRules, RentDeductionRule
│   │   ├── rules/
│   │   │   ├── 2024/                ← state.json + 17 autonomía files
│   │   │   ├── 2025/                ← state.json + 17 autonomía files (Ley 5/2025 two-segment phase-out)
│   │   │   └── 2026/                ← state.json + 17 autonomía files
│   │   └── tests/
│   │       ├── integration.test.ts  ← 40+ parity cases across all 15 common-regime regions
│   │       ├── madrid.test.ts
│   │       ├── catalonia.test.ts
│   │       ├── regions.test.ts
│   │       ├── edge-cases.test.ts
│   │       ├── fifo.test.ts         ← FIFO, anti-washing-sale, FX conversion
│   │       └── rent-deduction.test.ts
│   ├── ai-layer/                    ← AI wrappers — four thin Claude calls
│   │   ├── src/
│   │   │   ├── index.ts             ← exports: extractTaxInput, explainResult, parseNomina, parseBrokerReport
│   │   │   ├── extractor.ts         ← chat message → Partial<TaxInput> (tool-use, PII guard)
│   │   │   ├── explainer.ts         ← TaxResult + question → Spanish prose (no new numbers)
│   │   │   ├── nomina-parser.ts     ← PDF text → NominaData (tool-use)
│   │   │   ├── broker-parser.ts     ← broker report text → BrokerReportData (tool-use)
│   │   │   └── prompts.ts           ← system prompts for all four functions
│   │   └── tests/
│   │       ├── extractor.test.ts
│   │       └── nomina-parser.test.ts
├── apps/
│   ├── api/                         ← Fastify HTTP server
│   │   ├── src/
│   │   │   ├── server.ts            ← registers plugins (CORS, multipart, static), SPA fallback
│   │   │   ├── anthropic.ts         ← clientFromRequest() — X-Api-Key header or ANTHROPIC_API_KEY env var
│   │   │   ├── ratelimit.ts         ← in-memory RateLimiter (20 req/min per IP for AI routes)
│   │   │   └── routes/
│   │   │       ├── calculate.ts     ← POST /api/calculate
│   │   │       ├── extract.ts       ← POST /api/extract  (rate-limited, not in UI)
│   │   │       ├── explain.ts       ← POST /api/explain  (rate-limited)
│   │   │       ├── parse-nomina.ts  ← POST /api/parse-nomina (single PDF, monthly analysis)
│   │   │       ├── parse-renta.ts   ← POST /api/parse-renta  (up to 12 PDFs, full annual Renta)
│   │   │       └── parse-broker.ts  ← POST /api/parse-broker (broker CSV/PDF, FIFO capital gains)
│   │   └── tests/
│   │       └── parse-nomina.test.ts
│   └── web/                         ← React 19 SPA, served as static by the API in production
│       ├── src/
│       │   ├── App.tsx              ← three-tab layout: form / nómina mensual / renta anual
│       │   ├── main.tsx
│       │   ├── components/
│       │   │   ├── ApiKeyBanner.tsx      ← enter/clear personal Anthropic API key (stored in localStorage)
│       │   │   ├── InputForm.tsx         ← field-by-field form, all TaxInput fields
│       │   │   ├── NominaUpload.tsx      ← single PDF upload, monthly IRPF comparison card
│       │   │   ├── RentaAnual.tsx        ← up to 12 PDFs, aggregated annual Renta calculation
│       │   │   ├── BrokerUpload.tsx      ← broker CSV/PDF upload, FIFO capital gains display
│       │   │   ├── ResultDashboard.tsx   ← hero card (a ingresar/devolver) + breakdown grid
│       │   │   ├── WaterfallChart.tsx    ← Recharts bar chart per WaterfallStep
│       │   │   ├── TaxBreakdownCharts.tsx ← KPI cards, donut (net vs tax), bar (state vs regional)
│       │   │   ├── ExplanationPanel.tsx  ← Q&A text area → calls /api/explain
│       │   │   └── DownloadPDFButton.tsx ← exports tax result / nómina / renta anual as PDF
│       │   ├── pdf/
│       │   │   ├── TaxResultPDF.tsx      ← full tax result PDF layout
│       │   │   ├── NominaMensualPDF.tsx  ← monthly nómina comparison PDF layout
│       │   │   ├── RentaAnualPDF.tsx     ← annual declaration PDF layout
│       │   │   └── buildSections.ts      ← shared helper: TaxResult → display sections
│       │   ├── api/
│       │   │   └── taxai.ts         ← typed fetch wrappers (calculate, explain, parseNomina, parseRenta, parseBroker)
│       │   ├── utils/
│       │   │   └── apiKey.ts        ← getApiKey / setApiKey / clearApiKey (localStorage)
│       │   └── mocks/
│       │       └── taxResult.ts     ← hardcoded MOCK_RESULT for local dev
│       └── tests/
│           ├── ResultDashboard.test.tsx
│           ├── WaterfallChart.test.tsx
│           ├── TaxResultPDF.test.tsx
│           ├── buildSections.test.ts
│           └── setup.ts
├── docs/
│   ├── TAX_RULES_2025.md            ← authoritative IRPF 2025 reference (brackets, formulas, sources)
│   ├── TASKS.md                     ← frontend roadmap
│   ├── INTEGRATION.md               ← integration sprint notes
│   └── START_PROMPT.md              ← initial agent briefing
└── ...
```

---

## 5. Shared Data Contracts (Critical — All Packages Must Respect These)

These types live in `packages/shared/src/types.ts`. **No package may change them unilaterally — coordinate first.**

### TaxInput (the contract between UI/AI and the Engine)

```typescript
export interface TaxInput {
  fiscalYear: number;             // e.g. 2025
  region: SpanishRegion;
  age: number;                    // affects mínimo personal
  grossSalary: number;            // euros, rendimiento íntegro del trabajo
  ssContributions?: number;       // Art. 19.2.a — subtracted before Art. 20 reduction
  otherIncome?: number;           // miscellaneous income
  retenciones: number;            // withholdings already paid
  dependentsUnder25: number;
  dependentsUnder3?: number;      // subset of above (under-3 supplement)
  dependentsOver65: number;       // ascendants
  civilStatus: CivilStatus;
  disability?: DisabilityGrade;   // 33 or 65
  savingsIncome?: SavingsIncome;  // capital gains, dividends, interest (Art. 46)
  rentalIncome?: RentalIncome;    // gross rent + deductible expenses
  rentPayments?: RentPayments;    // tenant rent deduction criteria
  pensionContributions?: number;  // Art. 51 — reduces base imponible general
  cataloniaDeductions?: CataloniaDeductions;  // only meaningful for region='catalonia'
}

export interface SavingsIncome {
  capitalGains?: number;   // net gains from selling assets (FIFO-computed by engine)
  dividends?: number;
  interest?: number;
}

export interface RentalIncome {
  grossRent: number;
  deductibleExpenses?: number;
}

export interface RentPayments {
  annualRentPaid: number;
  isUnder36?: boolean;
  hasDisability?: boolean;
  isLargeFamily?: boolean;
  isUnemployed6Months?: boolean;
}

export interface CataloniaDeductions {
  birthAdoption?: number;
  habitatgeRent?: number;
  researchDonation?: number;
  ecologicalDonation?: number;
}

export type SpanishRegion =
  | 'andalusia' | 'aragon' | 'asturias' | 'balearics' | 'canarias'
  | 'cantabria' | 'castilla-la-mancha' | 'castilla-leon' | 'catalonia'
  | 'extremadura' | 'galicia' | 'la-rioja' | 'madrid' | 'murcia'
  | 'navarra' | 'pais-vasco' | 'valenciana';

export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated';
export type DisabilityGrade = 33 | 65;
```

> **Foral caveat:** `navarra` and `pais-vasco` are valid `SpanishRegion` values but use completely different tax legislation. All endpoints return `501 Not Implemented` for these two regions.

### TaxResult (what the Engine returns)

```typescript
export interface TaxResult {
  fiscalYear: number;
  region: SpanishRegion;
  grossSalary: number;

  // Deductions & reductions applied
  rendimientoNetoReducido: number;    // after SS gastos + trabajo reduction
  baseImponibleGeneral: number;       // rendimientoNetoReducido + rental + other − pension
  baseImponibleAhorro: number;        // capital gains + dividends + interest (Art. 46)
  minimumPersonalFamiliar: number;    // mínimo personal y familiar (Art. 57–61)

  // Cuota íntegra — each tarifa applied to the FULL base independently
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  cuotaIntegraTOTAL: number;

  // Cuota líquida — after subtracting minimum quotas, 2025 deduction, regional deductions
  cuotaLiquidaEstatal: number;
  cuotaLiquidaAutonomica: number;
  cuotaLiquidaTOTAL: number;

  // Final result
  retenciones: number;
  resultAmount: number;    // positive = to pay (a ingresar), negative = refund (a devolver)
  resultType: 'a_ingresar' | 'a_devolver' | 'cero';

  // Waterfall data for the chart
  waterfallSteps: WaterfallStep[];
}

export interface WaterfallStep {
  label: string;         // human-readable, in Spanish
  amount: number;        // positive = adds to tax, negative = reduces
  runningTotal: number;
  bracketRate?: number;
}
```

### Nómina parsing types

```typescript
export interface NominaData {
  period?: string;
  fiscalYear?: number;
  numberOfPayments?: number;      // 12 or 14 (prorated extras → 12)
  monthlyGross?: number;
  annualGross?: number;
  monthlyBaseIRPF?: number;
  monthlyRetenciones?: number;
  annualRetenciones?: number;
  retentionPercentage?: number;
  monthlySS_CC?: number;
  monthlySS_MEI?: number;
  monthlySS_unemployment?: number;
  monthlySS_vocational?: number;
  monthlySSEmployee?: number;     // sum of all SS components
}

export interface NominaComparison {
  calculatedTax: number;
  retencionesFromNomina: number;
  difference: number;
  diffType: 'overpaid' | 'underpaid' | 'correct';  // correct = within 2%
  percentageDiff: number;
}

export interface NominaParseResult {
  nomina: NominaData;
  taxInput: Partial<TaxInput>;
  annualGross: number;
  annualBaseIRPF: number;
  annualRetencionesNomina: number;
  taxResult?: TaxResult;
  comparison?: NominaComparison;
}

export interface RentaAnualResult {
  months: NominaData[];
  annualGross: number;
  annualBaseIRPF: number;
  annualRetencionesNomina: number;
  annualSS: number;
  taxInput: Partial<TaxInput>;
  taxResult?: TaxResult;
  comparison?: NominaComparison;
}
```

### Broker / investment types

```typescript
export interface StockTransaction {
  assetId: string;
  assetName?: string;
  transactionType: 'buy' | 'sell' | 'dividend' | 'interest' | 'fee';
  date: string;           // ISO date YYYY-MM-DD
  quantity?: number;
  pricePerUnit?: number;
  totalAmount: number;    // positive = income/proceeds, negative = cost
  fees: number;
  currency: string;
  fxRate?: number;        // to EUR on transaction date
  foreignTaxWithheld?: number;
}

export interface BrokerReportData {
  brokerName?: string;
  fiscalYear: number;
  currency: string;
  transactions: StockTransaction[];
  reportedCapitalGains?: number;
  reportedDividends?: number;
  reportedInterest?: number;
  reportedFees?: number;
}

export interface BrokerParseResult {
  brokerReport: BrokerReportData;
  computedCapitalGains: number;
  computedDividends: number;
  computedInterest: number;
  totalForeignTaxWithheld: number;
  taxInput: Partial<TaxInput>;
  taxResult?: TaxResult;
  warnings: string[];
}
```

### API Endpoints Contract

```
POST /api/calculate
  Body:    TaxInput
  Returns: TaxResult
  Errors:  400 (validation), 501 (foral region), 422 (missing rules), 500

POST /api/explain
  Body:    { result: TaxResult, question: string }
  Returns: { explanation: string }  ← Spanish prose, no new numbers
  Errors:  429 (rate limit), 500
  Limit:   20 req/min per IP

POST /api/parse-nomina
  Body:    multipart/form-data
           - pdf: <file>          max 10 MB, single monthly payslip
           - region?: string      default "madrid"
           - age?: number         default 35
           - civilStatus?: string default "single"
           - fiscalYear?: number  default 2025
  Returns: NominaParseResult
  Errors:  400 (no file / bad PDF), 422 (unreadable), 501 (foral), 429 (rate limit), 500
  Limit:   20 req/min per IP

POST /api/parse-renta
  Body:    multipart/form-data
           - pdf_0 … pdf_11: up to 12 PDF files (monthly payslips)
           - region?: string      default "madrid"
           - age?: number         default 35
           - civilStatus?: string default "single"
           - fiscalYear?: number  default 2025
  Returns: RentaAnualResult       (sums actual monthly figures, no projection)
  Errors:  400, 501, 429, 500
  Limit:   20 req/min per IP

POST /api/parse-broker
  Body:    multipart/form-data
           - file: <CSV or PDF>   max 10 MB, broker annual report
           - region?: string      default "madrid"
           - age?: number         default 35
           - civilStatus?: string default "single"
           - fiscalYear?: number  default 2025  (overridden by detected year when possible)
  Returns: BrokerParseResult
  Errors:  400, 422, 501, 429, 500
  Limit:   20 req/min per IP
```

> **Note:** `/api/extract` (chat → structured TaxInput) exists in the codebase but is not exposed in the UI. It can be removed in a future cleanup.

---

## 6. Engine Implementation (How the Calculator Works)

All arithmetic in `packages/engine/src/calculator.ts`. All values are integers (cents) until the final `toEuros()` conversion.

**Step sequence:**

1. Load `rules/{fiscalYear}/state.json` and `rules/{fiscalYear}/{region}.json`
2. **Art. 19 gastos deducibles** — subtract employee SS contributions from gross salary
3. **Art. 20 reducción por rendimientos del trabajo** — applied to `(grossSalary - SS)`:
   - *2025/2026 (Ley 5/2025)*: €2,000 flat + two-segment phase-out (see Section 8)
   - *2024 legacy*: single linear phase-out from threshold to €19,747
4. `rendimientoNetoReducido = max(0, gross - SS - trabajoReduction)`
5. `baseImponibleGeneral = rendimientoNetoReducido + netRentalIncome + otherIncome − pensionContributions`
6. `baseImponibleAhorro` = capital gains + dividends + interest; losses offset up to 25% of passive income (Art. 46)
7. `minimumPersonalFamiliar` = base €5,550 + age supplements + descendants + ascendants (see Section 8)
8. **Cuota íntegra** — apply each tarifa to the **full base independently**:
   - `cuotaIntegraEstatal` = state brackets applied to full general base + savings brackets to savings base
   - `cuotaIntegraAutonomica` = regional brackets applied to full general base + savings brackets to savings base
   > ⚠️ This is NOT a 50/50 split. Each tarifa has its own rates applied to the complete base.
9. Apply each tarifa to the **full** `minimumPersonalFamiliar` to get minimum quotas
10. `cuotaLiquida = max(0, cuotaIntegra - minQuota)` for each half
11. **2025+ deduction** — up to €340 from cuota líquida (phases out €16,576–€18,276), split 50/50
12. **Regional deductions** — rent deduction (varies by autonomía + conditions), Catalonia-specific deductions
13. `resultAmount = cuotaLiquidaTOTAL - retenciones`

### FIFO Capital Gains (`packages/engine/src/fifo.ts`)

`computeBrokerFIFO(transactions)` implements Art. 35 LIRPF:
- Groups transactions by `assetId`; processes each asset chronologically with FIFO lots
- Non-EUR amounts converted using `fxRate` (caller populates — engine never calls external APIs)
- **Anti-washing-sale rule (Art. 33.5 LIRPF):** loss deferred if same asset repurchased within 2 months
- Dividends and interest aggregated separately; warnings emitted for missing lots or FX data

**Parity requirement:** Each region must match the AEAT official simulator to the cent for at least 5 test cases before that region ships.

---

## 7. AI Layer

**extractor.ts** (`extractTaxInput(message, client?)`):
- Model: `claude-sonnet-4-6`, tool-use
- PII guard: rejects input matching DNI/NIE/IBAN patterns, throws `PiiDetectedError`
- Returns only fields the user mentioned; unmentioned fields are `undefined`

**explainer.ts** (`explainResult(result, question, client?)`):
- Model: `claude-sonnet-4-6`, text response
- Must not introduce any number not already in `TaxResult`
- Max ~250 words, plain Spanish prose

**nomina-parser.ts** (`parseNomina(pdfText, client?)`):
- Model: `claude-sonnet-4-6`, tool-use
- Input: raw text from `pdf-parse` (caller extracts text)
- Output: `NominaData` — financial fields only, no PII

**broker-parser.ts** (`parseBrokerReport(reportText, client?)`):
- Model: `claude-sonnet-4-6`, tool-use
- Input: broker annual report text (CSV decoded to UTF-8 or PDF text)
- Output: `BrokerReportData` — transactions list + reported totals
- FIFO arithmetic is done by `@taxai/engine`, not here

**prompts.ts** — four system prompts:
- `EXTRACTOR_SYSTEM_PROMPT` — PII rules, extract only what user mentioned
- `EXPLAINER_SYSTEM_PROMPT` — reference only provided JSON, no new figures, Spanish
- `NOMINA_PARSER_SYSTEM_PROMPT` — financial fields only, no PII, no estimation
- `BROKER_PARSER_SYSTEM_PROMPT` — extract transactions, skip non-financial data

### API key management

`apps/api/src/anthropic.ts` exports `clientFromRequest(req)` which:
1. Checks the `X-Api-Key` request header
2. Falls back to the `ANTHROPIC_API_KEY` environment variable

Users can supply their own key from the `ApiKeyBanner` in the UI — it is stored in `localStorage` and forwarded as the `X-Api-Key` header. The server never logs it.

---

## 8. Tax Rules Reference

### State Tax Brackets (2024, 2025, 2026 — identical general tarifa)

| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 9.50% |
| 12,450 | 20,200 | 12.00% |
| 20,200 | 35,200 | 15.00% |
| 35,200 | 60,000 | 18.50% |
| 60,000 | 300,000 | 22.50% |
| 300,000 | ∞ | 24.50% |

Regional brackets vary per autonomía. Madrid lowest combined top rate (~42.5%). Catalonia one of the highest (~50%).

### Tax Rules JSON Schema

**`engine/rules/{year}/{region}.json`** — two formats:

**2024 format** (`phaseOutStart`/`phaseOutEnd` keys):
```json
{
  "region": "madrid",
  "fiscalYear": 2024,
  "autonomicBrackets": [
    { "from": 0,     "to": 12450, "rate": 0.0900 },
    { "from": 12450, "to": null,  "rate": 0.1700 }
  ],
  "trabajoReductions": {
    "fullReductionThreshold": 14852,
    "maxReduction": 5565,
    "baseReduction": 2000,
    "phaseOutStart": 14852,
    "phaseOutEnd": 19747
  }
}
```

**2025/2026 format** (two-segment phase-out per Ley 5/2025):
```json
{
  "region": "madrid",
  "fiscalYear": 2025,
  "autonomicBrackets": [
    { "from": 0,     "to": 13362, "rate": 0.0850 },
    { "from": 13362, "to": null,  "rate": 0.2050 }
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
    "enhancedConditions": ["under36", "disability", "largefamily"]
  }
}
```

**Engine auto-detects** the formula: presence of `phaseOutSegment1End` → 2025/2026 path.

`state.json` uses `stateBrackets` (not `autonomicBrackets`) and has no `trabajoReductions`.

### 2025/2026 Reducción por Rendimientos del Trabajo (Art. 20 LIRPF)

```
rnt = grossSalary − SS − €2,000
rnt ≤ €14,852               → reducción = €7,302
€14,852 < rnt ≤ €17,673.52  → reducción = €7,302 − 1.75 × (rnt − €14,852)
€17,673.52 < rnt < €19,747.50 → reducción = €2,364.34 − 1.14 × (rnt − €17,673.52)
rnt ≥ €19,747.50            → reducción = €0
Total deduction = €2,000 (flat) + reducción
```

### Mínimo Personal y Familiar (Art. 57–61 LIRPF)

| Item | Amount |
|---|---|
| Personal base | €5,550 |
| Age 65–74 supplement | +€1,150 |
| Age ≥75 supplement | +€1,400 (additional) |
| 1st child under 25 | €2,400 |
| 2nd child | €2,700 |
| 3rd child | €4,000 |
| 4th child+ | €4,500 each |
| Child under 3 supplement | +€2,800 per child |
| Ascendant over 65 | €1,150 each |

### 2025/2026 Deducción por Rendimientos del Trabajo

Up to €340 subtracted from cuota líquida, split 50/50 state/regional:
- Gross ≤ €16,576 → full €340
- €16,576 < gross ≤ €18,276 → linearly phases out
- Gross > €18,276 → €0

---

## 9. Development Phases (Current Status)

### Phase 0 — Foundation ✅ COMPLETE
- [x] Monorepo scaffold (pnpm workspaces), shared types, `state.json` rules files
- [x] Vite + React + Tailwind scaffold, mock `TaxResult` for dashboard

### Phase 1 — MVP Core ✅ COMPLETE
- [x] Engine for all 15 common-regime regions, parity tests pass, API `/calculate`
- [x] ResultDashboard + WaterfallChart connected to live `/calculate`
- [x] InputForm with all TaxInput fields

### Phase 2 — AI Integration ✅ COMPLETE
- [x] `extractor.ts` + `/extract` endpoint with PII guard (endpoint exists; chat UI removed)
- [x] `explainer.ts` + `/explain` endpoint + ExplanationPanel in UI
- [x] `nomina-parser.ts` + `/parse-nomina` + NominaUpload component
- [x] `parse-renta.ts` + RentaAnual component (up to 12 PDFs, annual aggregation)
- [x] TaxBreakdownCharts (donut + grouped bar charts)

### Phase 3 — Full Regional Coverage ✅ MOSTLY COMPLETE
- [x] All 17 autonomías have rules JSON for 2024, 2025, and 2026
- [x] Parity tests for all 15 common-regime regions
- [x] Rent deduction (regional variation — `rentDeduction` field in JSON + `deductions/rent.ts`)
- [ ] Navarra and País Vasco (foral régimen — currently return 501)

### Phase 4 — Extended Income Types ✅ COMPLETE
- [x] Savings income: capital gains, dividends, interest (`baseImponibleAhorro`)
- [x] Rental income (`rentalIncome` in TaxInput)
- [x] Pension contributions (Art. 51 base reduction)
- [x] Catalonia-specific deductions
- [x] Broker report parsing (FIFO, `/api/parse-broker`, `BrokerUpload` component)
- [x] Anti-washing-sale rule (Art. 33.5 LIRPF)

### Phase 5 — Hardening & UX ✅ MOSTLY COMPLETE
- [x] PDF export (`@react-pdf/renderer` — TaxResultPDF, NominaMensualPDF, RentaAnualPDF)
- [x] User-supplied Anthropic API key (`ApiKeyBanner`, `X-Api-Key` header)
- [x] Rate limiting on AI endpoints (20 req/min per IP, in-memory)
- [x] Spanish error messages throughout
- [x] Edge cases tested: salary=0, high earners, max dependents, FIFO edge cases
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Multi-process rate limiting (current impl is single-process only)

---

## 10. Coding Conventions

- **Language:** TypeScript strict mode (`"strict": true`). No `any`. ESM throughout (`"module": "NodeNext"`).
- **Currency arithmetic:** Always use integers (cents) internally. Convert to euros only for display. `Math.round()` at each bracket boundary to avoid floating-point drift.
- **Comments:** Only where tax logic is non-obvious (e.g., why a specific reduction phases out). Don't comment self-evident code.
- **Error messages:** User-facing errors must be in Spanish. Internal/log errors in English.
- **Environment variables:** `ANTHROPIC_API_KEY` and `PORT` via `.env` (never committed). `dotenv` in API server.
- **Commits:** `feat:`, `fix:`, `test:`, `chore:` prefixes. Reference the feature area (e.g., `feat(engine): add Catalonia 2025 brackets`).
- **No premature abstraction:** Build the Spanish IRPF engine, not a generic European tax framework.

---

## 11. Key Constraints & Risks

| Risk | Mitigation |
|---|---|
| AI inventing tax figures | Explainer prompt: "only reference numbers from the provided TaxResult JSON. Do not calculate." |
| Regional rule errors | Parity tests against official AEAT simulator mandatory before shipping each region |
| PII leaking to Claude API | `extractor.ts` rejects input matching DNI/NIE/IBAN regex before calling the API |
| Floating-point errors in tax math | Integer cents internally; bracket boundaries tested explicitly |
| Outdated rules | Rules are JSON not code — add a new `rules/{year}/` directory to update |
| Rate limit bypass in multi-process | `RateLimiter` is in-memory; a load balancer would require Redis or similar |
| Foral region requests | Navarra/País Vasco return 501 — do not attempt to compute with common-regime brackets |
| Missing FIFO buy lots | `computeBrokerFIFO` emits warnings; result may understate gains — user must verify |
| Foreign currency FX rates | Engine never calls external APIs; caller must supply `fxRate` per transaction |

---

## 12. Long-Term Vision (Out of Scope — Do Not Build Yet)

- Autónomos (self-employed) income and quarterly payments (Modelo 130)
- Mortgage deduction (comunidades that still support it)
- PDF export of official Modelo 100 format
- Multi-year tax comparison
- Foral régimen full implementation (Navarra + País Vasco)
- Multi-process rate limiting (Redis or shared store)
- Accessibility audit (WCAG 2.1 AA)

The architecture supports these naturally: the Engine is rule-based, the AI layer is stateless, and the shared type contract can be extended.
