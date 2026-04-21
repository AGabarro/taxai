# CLAUDE.md — Taxai: AI-Assisted IRPF Calculator (Spain)
> This file is the single source of truth for all agents working on this project.
> Read it fully before writing any code. Every architectural decision here has a reason.

---

## 1. Project Identity

**What we build:** A "Glass Box" IRPF tax estimator for Spanish residents. Users enter their financial situation and receive an instant, accurate, and fully understandable tax breakdown.

**Why it matters:** Agencia Tributaria tools are cumbersome. Private gestorías are expensive for simple salary earners. We make tax transparency accessible.

**Fiscal year target:** 2024 (Renta 2024, declared in 2025). The engine must be swappable for future years without code changes.

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

| Layer | Technology | Reason |
|---|---|---|
| Backend runtime | Node.js 20 LTS + TypeScript | Type safety for financial arithmetic |
| Backend framework | Fastify | Low overhead, schema validation built-in |
| AI SDK | `@anthropic-ai/sdk` latest | Claude claude-sonnet-4-6 access |
| Frontend | React 18 + TypeScript + Vite | Component model fits the waterfall chart |
| Styling | Tailwind CSS | Rapid, consistent UI |
| Charts | Recharts | Composable waterfall / bar charts |
| Tax rules storage | JSON files under `engine/rules/` | Swappable per fiscal year without code changes |
| Testing | Vitest (backend + frontend) | Unified test runner |
| Monorepo layout | `packages/` with shared types | Single source of truth for data contracts |

**Node version:** `>=20.0.0`. Enforce with `.nvmrc`.

---

## 4. Repository Structure

```
taxai/
├── CLAUDE.md                        ← you are here
├── packages/
│   ├── shared/                      ← shared TypeScript types and schemas
│   │   └── src/
│   │       ├── types.ts             ← TaxInput, TaxResult, TaxBreakdown
│   │       └── index.ts
│   ├── engine/                      ← AGENT A OWNS THIS
│   │   ├── src/
│   │   │   ├── calculator.ts        ← main entry point
│   │   │   ├── brackets.ts          ← progressive bracket logic
│   │   │   ├── minimums.ts          ← mínimo personal y familiar
│   │   │   ├── reductions.ts        ← rendimientos del trabajo reductions
│   │   │   └── types.ts
│   │   ├── rules/
│   │   │   ├── 2024/
│   │   │   │   ├── state.json       ← tramos estatales
│   │   │   │   ├── madrid.json
│   │   │   │   ├── catalonia.json
│   │   │   │   ├── andalusia.json
│   │   │   │   └── ...              ← one file per autonomía
│   │   │   └── 2025/                ← drop new year files here to update
│   │   └── tests/
│   ├── ai-layer/                    ← AGENT A OWNS THIS
│   │   ├── src/
│   │   │   ├── extractor.ts         ← chat → TaxInput JSON
│   │   │   ├── explainer.ts         ← TaxResult → plain Spanish prose
│   │   │   └── prompts.ts           ← all Claude prompt templates
│   │   └── tests/
│   └── frontend/                   ← AGENT B OWNS THIS
│       ├── src/
│       │   ├── components/
│       │   │   ├── InputForm.tsx    ← traditional form path
│       │   │   ├── ChatInput.tsx    ← chat path
│       │   │   ├── ResultDashboard.tsx
│       │   │   ├── WaterfallChart.tsx
│       │   │   └── ExplanationPanel.tsx
│       │   ├── api/
│       │   │   └── taxai.ts         ← typed fetch calls to backend
│       │   └── App.tsx
│       └── tests/
├── apps/
│   └── api/                         ← AGENT A OWNS THIS
│       ├── src/
│       │   ├── server.ts
│       │   └── routes/
│       │       ├── calculate.ts     ← POST /api/calculate
│       │       ├── explain.ts       ← POST /api/explain
│       │       └── extract.ts       ← POST /api/extract
│       └── tests/
└── package.json                     ← workspace root
```

---

## 5. Shared Data Contracts (Critical — Both Agents Must Respect These)

These types live in `packages/shared/src/types.ts`. Neither agent may change them unilaterally — coordinate first.

### TaxInput (the contract between UI/AI and the Engine)

```typescript
export interface TaxInput {
  fiscalYear: number;           // e.g. 2024
  region: SpanishRegion;        // see enum below
  age: number;                  // affects mínimo personal
  grossSalary: number;          // euros, rendimientos del trabajo
  otherIncome?: number;         // rendimientos del capital, etc.
  retenciones: number;          // withholdings already paid
  dependentsUnder25: number;    // children under 25 in household
  dependentsOver65: number;     // elderly dependents
  civilStatus: CivilStatus;
  disability?: DisabilityGrade; // 33% or 65%+
}

export type SpanishRegion =
  | 'andalusia' | 'aragon' | 'asturias' | 'balearics' | 'canarias'
  | 'cantabria' | 'castilla-la-mancha' | 'castilla-leon' | 'catalonia'
  | 'extremadura' | 'galicia' | 'la-rioja' | 'madrid' | 'murcia'
  | 'navarra' | 'pais-vasco' | 'valenciana';

export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated';
export type DisabilityGrade = 33 | 65;
```

### TaxResult (what the Engine returns)

```typescript
export interface TaxResult {
  fiscalYear: number;
  region: SpanishRegion;
  grossSalary: number;

  // Reductions applied
  rendimientoNetoReducido: number;   // after trabajo reductions
  baseImponibleGeneral: number;
  minimumPersonalFamiliar: number;

  // Split between state and regional
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  cuotaIntegraTOTAL: number;

  // Applied to minimum
  cuotaLiquidaEstatal: number;
  cuotaLiquidaAutonomica: number;
  cuotaLiquidaTOTAL: number;

  // Final result
  retenciones: number;
  resultAmount: number;       // positive = to pay (a ingresar), negative = refund (a devolver)
  resultType: 'a_ingresar' | 'a_devolver' | 'cero';

  // Waterfall data for the chart (ordered)
  waterfallSteps: WaterfallStep[];
}

export interface WaterfallStep {
  label: string;         // human-readable, in Spanish
  amount: number;        // positive = adds to tax, negative = reduces
  runningTotal: number;
  bracketRate?: number;  // if this step is a bracket application
}
```

### API Endpoints Contract

```
POST /api/calculate
  Body:  TaxInput
  Returns: TaxResult

POST /api/extract
  Body:  { message: string }  ← raw chat text, NO PII
  Returns: Partial<TaxInput>  ← AI-extracted fields, user confirms

POST /api/explain
  Body:  { result: TaxResult, question: string }
  Returns: { explanation: string }  ← plain Spanish prose, no new numbers
```

---

## 6. Agent Responsibilities

### Agent A — Backend & AI Layer

**Owns:** `packages/engine/`, `packages/ai-layer/`, `apps/api/`

**First milestone:** Implement the full tax calculation for **Madrid** and **Catalonia** as the two baseline regions. All 17 regions follow after these two pass parity tests.

**Engine implementation order:**
1. Load rules from `engine/rules/{year}/{region}.json`
2. Calculate `rendimientoNetoReducido` (apply trabajo reductions: min €2,000, up to €5,565 for low earners)
3. Calculate `minimumPersonalFamiliar` (base €5,550, +€1,150 if age ≥65, +€1,400 if age ≥75)
4. Apply dependents minimum (+€2,400 first child, +€2,700 second, +€4,000 third+; +€1,000 each if under 3)
5. Split `baseImponibleGeneral` between state (50%) and regional (50%) tramos
6. Apply progressive brackets to each half
7. Subtract minimum quotas from each half
8. Sum and subtract retenciones → final result

**Parity test requirement:** Each region must match Agencia Tributaria's official simulator to the cent for at least 5 test cases before that region is considered done.

**AI Layer — extractor.ts:**
- Model: `claude-sonnet-4-6`
- Input: raw user message string
- Output: `Partial<TaxInput>` (only fields the user mentioned)
- Must use a structured output / tool-use call so the response is always valid JSON
- Never ask for or forward name, DNI, address, or bank info

**AI Layer — explainer.ts:**
- Input: `TaxResult` + user's question string
- Output: plain Spanish explanation referencing actual `waterfallSteps` from the result
- Must not introduce any number not already present in `TaxResult`
- Keep responses under 250 words unless the question is complex

### Agent B — Frontend

**Owns:** `packages/frontend/`

**First milestone:** Build the **Results Dashboard** as a static component using hardcoded mock `TaxResult` data. This is the core value proposition and must be pixel-perfect before connecting the API.

**Dashboard requirements:**
- Hero card: large "A Ingresar / A Devolver" amount, color-coded (red = pay, green = refund)
- Waterfall chart: each `WaterfallStep` as a labeled bar
- User must understand their status within 5 seconds (scannability rule)
- Mobile-first responsive layout

**Input paths (build in parallel or sequentially):**
1. `InputForm.tsx` — traditional labeled form, field-by-field
2. `ChatInput.tsx` — free-text chat box that calls `POST /api/extract`, shows extracted fields for user confirmation before calculating

**Explanation panel:**
- Rendered below the dashboard after first calculation
- Text area for follow-up questions → calls `POST /api/explain`
- Display AI response as formatted prose (no markdown tables)

**API calls (`src/api/taxai.ts`):**
- Typed wrappers around fetch using the `TaxInput`/`TaxResult` types from `packages/shared`
- Handle loading states and error messages in Spanish

---

## 7. Tax Rules JSON Schema

Each file in `engine/rules/{year}/{region}.json` must follow this schema:

```json
{
  "region": "madrid",
  "fiscalYear": 2024,
  "autonomicBrackets": [
    { "from": 0,      "to": 12450,  "rate": 0.0900 },
    { "from": 12450,  "to": 17707,  "rate": 0.0900 },
    { "from": 17707,  "to": 33007,  "rate": 0.1200 },
    { "from": 33007,  "to": 53407,  "rate": 0.1400 },
    { "from": 53407,  "to": null,   "rate": 0.1700 }
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

`state.json` follows the same bracket schema for the state (estatal) half.

**To update for a new fiscal year:** add a new `engine/rules/2025/` directory with updated JSON files. No code changes required.

---

## 8. 2024 State Tax Brackets (Reference)

These are the estatal tramos applied to 50% of the base imponible general:

| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 9.50% |
| 12,450 | 20,200 | 12.00% |
| 20,200 | 35,200 | 15.00% |
| 35,200 | 60,000 | 18.50% |
| 60,000 | 300,000 | 22.50% |
| 300,000 | ∞ | 24.50% |

Regional brackets vary per autonomía. Madrid applies the lowest combined rate (~43.5% top). Catalonia applies one of the highest (~50% top).

---

## 9. Development Phases

### Phase 0 — Foundation (both agents in parallel)
- [ ] Agent A: monorepo scaffold, shared types, `state.json` rules file
- [ ] Agent B: Vite + React + Tailwind scaffold, mock `TaxResult` for dashboard

### Phase 1 — MVP Core
- [ ] Agent A: Engine for Madrid + Catalonia, parity tests pass, API server with `/calculate`
- [ ] Agent B: ResultDashboard + WaterfallChart connected to live `/calculate`

### Phase 2 — AI Integration
- [ ] Agent A: `extractor.ts` prompt + `/extract` endpoint
- [ ] Agent A: `explainer.ts` prompt + `/explain` endpoint
- [ ] Agent B: ChatInput component + ExplanationPanel

### Phase 3 — Full Regional Coverage
- [ ] Agent A: all 17 autonomías rules JSON + parity tests
- [ ] Agent B: region selector UX improvements

### Phase 4 — Hardening
- [ ] Error handling, edge cases (salary = 0, very high earners, multiple dependents)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Rate limiting on AI endpoints to control API cost

---

## 10. Coding Conventions

- **Language:** TypeScript strict mode (`"strict": true`). No `any`.
- **Currency arithmetic:** Always use integers (cents) internally. Convert to euros only for display. `Math.round()` at each bracket boundary to avoid floating-point drift.
- **Comments:** Only where the tax logic is non-obvious (e.g., why a specific reduction phases out). Don't comment self-evident code.
- **Error messages:** User-facing errors must be in Spanish. Internal/log errors in English.
- **Environment variables:** `ANTHROPIC_API_KEY` via `.env` (never committed). Use `dotenv` in the API server.
- **Commits:** `feat:`, `fix:`, `test:`, `chore:` prefixes. Reference the phase (e.g., `feat(engine): add Catalonia brackets [Phase 1]`).
- **No premature abstraction:** Don't build a generic "European tax engine." Build the Spanish IRPF engine.

---

## 11. Key Constraints & Risks

| Risk | Mitigation |
|---|---|
| AI inventing tax figures | Explainer prompt explicitly instructs: "only reference numbers from the provided TaxResult JSON. Do not calculate." |
| Regional rule errors | Parity tests against official AT simulator are mandatory before shipping |
| PII leaking to Claude API | `extractor.ts` must strip/reject input containing patterns matching DNI, NIE, or IBAN before calling the API |
| Floating-point errors in tax math | Use integer cents internally; test all bracket boundaries explicitly |
| Outdated rules | Rules are JSON, not code — update the JSON file for the new year |

---

## 12. Long-Term Vision (Out of MVP Scope — Do Not Build Yet)

- Autónomos (self-employed) income and quarterly payments
- Investment income (capital gains, dividends)
- Rental income (rendimientos del capital inmobiliario)
- Mortgage deduction (comunidades that still support it)
- Pension plan contributions
- PDF export of the breakdown
- Multi-year comparison

Do not design for these now. The architecture supports them naturally because the Engine is rule-based and the AI layer is stateless.
