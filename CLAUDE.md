# CLAUDE.md — Taxai: AI-Assisted IRPF Calculator (Spain)
> This file is the single source of truth for all agents working on this project.
> Read it fully before writing any code. Every architectural decision here has a reason.

---

## 1. Project Identity

**What we build:** A "Glass Box" IRPF tax estimator for Spanish residents. Users enter their financial situation and receive an instant, accurate, and fully understandable tax breakdown.

**Why it matters:** Agencia Tributaria tools are cumbersome. Private gestorías are expensive for simple salary earners. We make tax transparency accessible.

**Fiscal year support:** 2024 and 2025 (Ley 5/2025). The engine loads rules from JSON files — adding a new year requires only a new `engine/rules/{year}/` directory, no code changes.

---

## 2. The Golden Rule (Non-Negotiable)

> **THE AI IS FORBIDDEN FROM DOING MATH.**

The system has exactly two components and they must never swap roles:

| Component | Nickname | Responsibility |
|---|---|---|
| Deterministic Tax Engine | **The Brain** | All arithmetic, all tax logic, all money. Uses official tables. |
| Claude claude-sonnet-4-6 | **The Voice** | Translates human input → structured JSON. Translates Engine output → plain Spanish explanation. |

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
| Tax rules storage | JSON files under `engine/rules/` | Swappable per fiscal year without code changes |
| Testing | Vitest (backend + frontend) | Unified test runner across all packages |
| PDF parsing | `pdf-parse` v1 | Text extraction from nómina PDFs |

---

## 4. Repository Structure

```
taxai/
├── CLAUDE.md                        ← you are here
├── .nvmrc                           ← pins Node 22
├── .env.example                     ← ANTHROPIC_API_KEY, PORT
├── pnpm-workspace.yaml              ← workspace definition
├── tsconfig.base.json               ← shared TS config (NodeNext, ESM, strict)
├── package.json                     ← workspace root (scripts: dev:api, dev:ui, test, build)
├── packages/
│   ├── shared/                      ← shared TypeScript types — neither agent changes unilaterally
│   │   └── src/
│   │       ├── types.ts             ← TaxInput, TaxResult, WaterfallStep, NominaData, NominaComparison, NominaParseResult
│   │       └── index.ts
│   ├── engine/                      ← deterministic tax engine, no AI
│   │   ├── src/
│   │   │   ├── index.ts             ← exports: calculate()
│   │   │   ├── calculator.ts        ← main entry point, orchestrates all steps
│   │   │   ├── brackets.ts          ← progressive bracket application (returns cents)
│   │   │   ├── minimums.ts          ← mínimo personal y familiar (Art. 57–61 LIRPF)
│   │   │   ├── reductions.ts        ← rendimientos del trabajo reductions (2024 + 2025)
│   │   │   └── types.ts             ← Bracket, TrabajoReductions, RegionRules, StateRules
│   │   ├── rules/
│   │   │   ├── 2024/
│   │   │   │   ├── state.json       ← tramos estatales 2024
│   │   │   │   ├── madrid.json
│   │   │   │   ├── catalonia.json
│   │   │   │   └── ...              ← one file per autonomía (17 total)
│   │   │   └── 2025/                ← all 17 regions + state, Ley 5/2025 rules
│   │   │       ├── state.json
│   │   │       ├── madrid.json
│   │   │       └── ...
│   │   └── tests/
│   │       ├── integration.test.ts  ← comprehensive 2025 parity tests (40+ cases)
│   │       ├── madrid.test.ts
│   │       ├── catalonia.test.ts
│   │       ├── regions.test.ts
│   │       └── edge-cases.test.ts
│   ├── ai-layer/                    ← AI wrappers — three thin Claude calls
│   │   ├── src/
│   │   │   ├── index.ts             ← exports: extractTaxInput, explainResult, parseNomina
│   │   │   ├── extractor.ts         ← chat message → Partial<TaxInput> (tool-use, PII guard)
│   │   │   ├── explainer.ts         ← TaxResult + question → Spanish prose (no new numbers)
│   │   │   ├── nomina-parser.ts     ← PDF text → NominaData (tool-use)
│   │   │   └── prompts.ts           ← EXTRACTOR_SYSTEM_PROMPT, EXPLAINER_SYSTEM_PROMPT, NOMINA_PARSER_SYSTEM_PROMPT
│   │   └── tests/
│   │       ├── extractor.test.ts
│   │       └── nomina-parser.test.ts
├── apps/
│   ├── api/                         ← Fastify HTTP server
│   │   ├── src/
│   │   │   ├── server.ts            ← registers plugins (CORS, multipart, static), SPA fallback
│   │   │   ├── ratelimit.ts         ← in-memory RateLimiter (20 req/min per IP for AI routes)
│   │   │   └── routes/
│   │   │       ├── calculate.ts     ← POST /api/calculate
│   │   │       ├── extract.ts       ← POST /api/extract  (rate-limited)
│   │   │       ├── explain.ts       ← POST /api/explain  (rate-limited)
│   │   │       ├── parse-nomina.ts  ← POST /api/parse-nomina (single PDF, monthly analysis, rate-limited)
│   │   │       └── parse-renta.ts   ← POST /api/parse-renta  (up to 12 PDFs, full annual Renta, rate-limited)
│   │   └── tests/
│   │       └── parse-nomina.test.ts
│   └── web/                         ← React 19 SPA, served as static by the API in production
│       ├── src/
│       │   ├── App.tsx              ← three-tab layout: form / nómina mensual / renta anual
│       │   ├── main.tsx
│       │   ├── components/
│       │   │   ├── InputForm.tsx         ← field-by-field form, all TaxInput fields
│       │   │   ├── NominaUpload.tsx      ← single PDF upload, monthly IRPF comparison card
│       │   │   ├── RentaAnual.tsx        ← up to 12 PDFs, aggregated annual Renta calculation
│       │   │   ├── ResultDashboard.tsx   ← hero card (a ingresar/devolver) + breakdown grid
│       │   │   ├── WaterfallChart.tsx    ← Recharts bar chart per WaterfallStep
│       │   │   ├── TaxBreakdownCharts.tsx ← KPI cards, donut (net vs tax), bar (state vs regional)
│       │   │   └── ExplanationPanel.tsx  ← Q&A text area → calls /api/explain
│       │   ├── api/
│       │   │   └── taxai.ts         ← typed fetch wrappers (calculate, explain, parseNomina, parseRenta)
│       │   └── mocks/
│       │       └── taxResult.ts     ← hardcoded MOCK_RESULT for local dev
│       └── tests/
│           ├── ResultDashboard.test.tsx
│           ├── WaterfallChart.test.tsx
│           └── setup.ts
├── docs/
│   ├── TAX_RULES_2025.md            ← authoritative IRPF 2025 reference (brackets, formulas, sources)
│   ├── TASKS.md                     ← Agent B frontend roadmap
│   ├── INTEGRATION.md               ← integration sprint notes
│   └── START_PROMPT.md              ← initial agent briefing
└── ...
```

---

## 5. Shared Data Contracts (Critical — Both Agents Must Respect These)

These types live in `packages/shared/src/types.ts`. **Neither agent may change them unilaterally — coordinate first.**

### TaxInput (the contract between UI/AI and the Engine)

```typescript
export interface TaxInput {
  fiscalYear: number;             // e.g. 2025
  region: SpanishRegion;          // see type below
  age: number;                    // affects mínimo personal
  grossSalary: number;            // euros, rendimiento íntegro del trabajo
  /** Annual employee SS contributions (Art. 19.2.a LIRPF gastos deducibles).
   *  Subtracted before the Art. 20 trabajo reduction is applied. */
  ssContributions?: number;
  otherIncome?: number;           // rendimientos del capital, etc.
  retenciones: number;            // withholdings already paid
  dependentsUnder25: number;      // children under 25 in household
  dependentsUnder3?: number;      // subset of above who are under 3 (supplement)
  dependentsOver65: number;       // elderly dependents (ascendants)
  civilStatus: CivilStatus;
  disability?: DisabilityGrade;   // 33% or 65%+
}

export type SpanishRegion =
  | 'andalusia' | 'aragon' | 'asturias' | 'balearics' | 'canarias'
  | 'cantabria' | 'castilla-la-mancha' | 'castilla-leon' | 'catalonia'
  | 'extremadura' | 'galicia' | 'la-rioja' | 'madrid' | 'murcia'
  | 'navarra' | 'pais-vasco' | 'valenciana';

export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated';
export type DisabilityGrade = 33 | 65;
```

> **Foral caveat:** `navarra` and `pais-vasco` are valid `SpanishRegion` values but use completely different tax legislation. The API currently returns `501 Not Implemented` for these two regions.

### TaxResult (what the Engine returns)

```typescript
export interface TaxResult {
  fiscalYear: number;
  region: SpanishRegion;
  grossSalary: number;

  // Deductions & reductions applied
  rendimientoNetoReducido: number;   // after SS gastos + trabajo reduction
  baseImponibleGeneral: number;      // rendimientoNetoReducido + otherIncome
  minimumPersonalFamiliar: number;   // mínimo personal y familiar (Art. 57–61)

  // Cuota íntegra — each tarifa applied to the FULL base independently
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  cuotaIntegraTOTAL: number;

  // Cuota líquida — after subtracting minimum quotas and 2025 deduction
  cuotaLiquidaEstatal: number;
  cuotaLiquidaAutonomica: number;
  cuotaLiquidaTOTAL: number;

  // Final result
  retenciones: number;
  resultAmount: number;    // positive = to pay (a ingresar), negative = refund (a devolver)
  resultType: 'a_ingresar' | 'a_devolver' | 'cero';

  // Waterfall data for the chart (ordered steps)
  waterfallSteps: WaterfallStep[];
}

export interface WaterfallStep {
  label: string;         // human-readable, in Spanish
  amount: number;        // positive = adds to tax, negative = reduces
  runningTotal: number;
  bracketRate?: number;  // if this step is a bracket application
}
```

### Nómina parsing types

```typescript
export interface NominaData {
  period?: string;                // e.g. "enero 2025" or "12/2024"
  fiscalYear?: number;
  numberOfPayments?: number;      // typically 12 or 14
  monthlyGross?: number;
  annualGross?: number;
  monthlyBaseIRPF?: number;       // IRPF taxable base (may differ from monthlyGross)
  monthlyRetenciones?: number;
  annualRetenciones?: number;
  retentionPercentage?: number;
  monthlySS_CC?: number;          // Contingencias Comunes
  monthlySS_MEI?: number;         // MEI
  monthlySS_unemployment?: number;
  monthlySS_vocational?: number;
  monthlySSEmployee?: number;     // total employee SS (sum of above)
}

export interface NominaComparison {
  calculatedTax: number;           // engine cuotaLiquidaTOTAL
  retencionesFromNomina: number;   // from the nómina (monthly or annual depending on context)
  difference: number;              // retencionesFromNomina - calculatedTax
  diffType: 'overpaid' | 'underpaid' | 'correct';  // correct = within 2%
  percentageDiff: number;
}

export interface NominaParseResult {
  nomina: NominaData;
  taxInput: Partial<TaxInput>;
  annualGross: number;
  annualBaseIRPF: number;
  annualRetencionesNomina: number;
  taxResult?: TaxResult;          // present if enough data available
  comparison?: NominaComparison;  // present when taxResult is present
}

export interface RentaAnualResult {
  months: NominaData[];           // one entry per uploaded PDF
  annualGross: number;            // sum of all monthly devengados
  annualBaseIRPF: number;         // sum of all monthly IRPF bases
  annualRetencionesNomina: number; // sum of all monthly retenciones
  annualSS: number;               // sum of all monthly SS contributions
  taxInput: Partial<TaxInput>;
  taxResult?: TaxResult;          // present if enough data available
  comparison?: NominaComparison;  // present when taxResult is present
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
  Returns: NominaParseResult      (comparison uses monthly figures in UI)
  Errors:  400 (no file / bad PDF), 501 (foral), 429 (rate limit), 500
  Limit:   20 req/min per IP (shared aiRateLimiter)

POST /api/parse-renta
  Body:    multipart/form-data
           - pdf_0, pdf_1, … pdf_N: up to 12 PDF files (annual payslips)
           - region?: string      default "madrid"
           - age?: number         default 35
           - civilStatus?: string default "single"
           - fiscalYear?: number  default 2025
  Returns: RentaAnualResult       (sums actual monthly figures, no projection)
  Errors:  400 (no files / bad PDF), 501 (foral), 429 (rate limit), 500
  Limit:   20 req/min per IP (shared aiRateLimiter)
```

> **Note:** The `/api/extract` endpoint (chat → structured TaxInput) still exists in the codebase but is no longer exposed in the UI. It can be removed in a future cleanup pass.

---

## 6. Engine Implementation (How the Calculator Works)

All arithmetic in `packages/engine/src/calculator.ts`. All values are integers (cents) until the final `toEuros()` conversion.

**Step sequence:**

1. Load `rules/{fiscalYear}/state.json` and `rules/{fiscalYear}/{region}.json`
2. **Art. 19 gastos deducibles** — subtract employee SS contributions from gross salary
3. **Art. 20 reducción por rendimientos del trabajo** — applied to `(grossSalary - SS)`:
   - *2025 (Ley 5/2025)*: €2,000 flat + two-segment phase-out (see Section 8)
   - *2024 legacy*: single linear phase-out from threshold to €19,747
4. `rendimientoNetoReducido = max(0, gross - SS - trabajoReduction)`
5. `baseImponibleGeneral = rendimientoNetoReducido + otherIncome`
6. `minimumPersonalFamiliar` = base €5,550 + age supplements + descendants + ascendants (see Section 8)
7. **Cuota íntegra** — apply each tarifa to the **full** `baseImponibleGeneral` independently:
   - `cuotaIntegraEstatal` = state brackets applied to full base
   - `cuotaIntegraAutonomica` = regional brackets applied to full base
   > ⚠️ This is NOT a 50/50 split. Each tarifa has its own rates and each is applied to the complete base.
8. Apply each tarifa to the **full** `minimumPersonalFamiliar` to get minimum quotas
9. `cuotaLiquida = max(0, cuotaIntegra - minQuota)` for each half
10. **2025 only — Deducción por rendimientos del trabajo** (up to €340, phases out €16,576–€18,276): subtract from cuota líquida 50/50 state/regional
11. `resultAmount = cuotaLiquidaTOTAL - retenciones`

**Parity requirement:** Each region must match the AEAT official simulator to the cent for at least 5 test cases before that region ships.

---

## 7. AI Layer

**extractor.ts** (`extractTaxInput(message, client?)`):
- Model: `claude-sonnet-4-6`, tool-use (structured output)
- PII guard: rejects input matching DNI/NIE/IBAN patterns, throws `PiiDetectedError`
- Returns only fields the user mentioned; unmentioned fields are `undefined`

**explainer.ts** (`explainResult(result, question, client?)`):
- Model: `claude-sonnet-4-6`, text response
- Must not introduce any number not already in `TaxResult`
- Max ~250 words, plain Spanish prose

**nomina-parser.ts** (`parseNomina(pdfText, client?)`):
- Model: `claude-sonnet-4-6`, tool-use (structured output)
- Input: raw text extracted from PDF by `pdf-parse` (caller extracts text)
- Output: `NominaData` — financial fields only, no PII
- Caller (`parse-nomina.ts` route) then derives annual figures and runs `calculate()`

**prompts.ts** — three system prompts:
- `EXTRACTOR_SYSTEM_PROMPT` — strict PII rules, extract only what user mentioned
- `EXPLAINER_SYSTEM_PROMPT` — reference only provided JSON, no new figures, Spanish
- `NOMINA_PARSER_SYSTEM_PROMPT` — extract financial fields only, no PII, no estimation

---

## 8. Tax Rules Reference

### State Tax Brackets (2024 and 2025 — identical)

Applied to the **full** `baseImponibleGeneral` via the state tarifa:

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

**`engine/rules/{year}/{region}.json`** — two formats depending on fiscal year:

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

**2025 format** (two-segment phase-out per Ley 5/2025):
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
  }
}
```

`state.json` uses `stateBrackets` (not `autonomicBrackets`) and has no `trabajoReductions`.

**Engine auto-detects** which formula to use: presence of `phaseOutSegment1End` → 2025 path.

### 2025 Reducción por Rendimientos del Trabajo (Art. 20 LIRPF, Ley 5/2025)

```
rnt = grossSalary − SS − €2,000
rnt ≤ €14,852              → reducción = €7,302
€14,852 < rnt ≤ €17,673.52 → reducción = €7,302 − 1.75 × (rnt − €14,852)
€17,673.52 < rnt < €19,747.50 → reducción = €2,364.34 − 1.14 × (rnt − €17,673.52)
rnt ≥ €19,747.50           → reducción = €0
Total deduction = €2,000 (flat) + reducción
```

### 2025 Mínimo Personal y Familiar (Art. 57–61 LIRPF)

| Item | Amount |
|---|---|
| Personal base | €5,550 |
| Age 65–74 supplement | +€1,150 |
| Age ≥75 supplement | +€1,400 (additional, on top of 65+) |
| 1st child under 25 | €2,400 |
| 2nd child | €2,700 |
| 3rd child | €4,000 |
| 4th child+ | €4,500 each |
| Child under 3 supplement | +€2,800 per child |
| Ascendant over 65 | €1,150 each |

### 2025 Deducción por Rendimientos del Trabajo (new, from cuota)

Up to €340 subtracted from cuota líquida after minimum deduction, split 50/50 state/regional:
- Gross ≤ €16,576 → full €340 deduction
- €16,576 < gross ≤ €18,276 → linearly phases out
- Gross > €18,276 → €0 deduction

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
- [x] `explainer.ts` + `/explain` endpoint
- [x] ExplanationPanel in the frontend (Q&A on tax result)
- [x] `nomina-parser.ts` + `/parse-nomina` endpoint — single monthly payslip, monthly IRPF comparison
- [x] NominaUpload component — uploads one PDF, shows monthly retention vs. calculated
- [x] `parse-renta.ts` + `/parse-renta` endpoint — up to 12 PDFs, full annual Renta calculation
- [x] RentaAnual component — multi-PDF upload, monthly breakdown table, annual result card
- [x] TaxBreakdownCharts (donut + grouped bar charts)

### Phase 3 — Full Regional Coverage ✅ MOSTLY COMPLETE
- [x] All 17 autonomías have rules JSON for both 2024 and 2025
- [x] Parity tests for all 15 common-regime regions
- [ ] Navarra and País Vasco (foral régimen — different legislation, currently return 501)

### Phase 4 — Hardening 🔄 IN PROGRESS
- [x] Rate limiting on AI endpoints (20 req/min per IP, in-memory)
- [x] Spanish error messages throughout
- [x] Edge cases tested: salary=0, high earners, max dependents
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

---

## 12. Long-Term Vision (Out of MVP Scope — Do Not Build Yet)

- Autónomos (self-employed) income and quarterly payments
- Investment income (capital gains, dividends)
- Rental income (rendimientos del capital inmobiliario)
- Mortgage deduction (comunidades that still support it)
- Pension plan contributions
- PDF export of the tax breakdown (the nómina *input* parser exists; the tax *output* PDF export does not)
- Multi-year comparison
- Foral régimen full implementation (Navarra + País Vasco)

The architecture supports these naturally: the Engine is rule-based, the AI layer is stateless, and the shared type contract can be extended.
