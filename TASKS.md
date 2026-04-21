# TASKS.md — Agent A (Backend, Engine & AI Layer)

> Start here. Read CLAUDE.md first for full project context, architecture rules, and the Golden Rule.
> This file is your step-by-step build plan. Work top to bottom. Commit at each checkpoint.

---

## Your Ownership

| Package / App | Your responsibility |
|---|---|
| `packages/shared` | Define and publish all shared TypeScript types |
| `packages/engine` | Deterministic tax calculator — all math lives here |
| `packages/ai-layer` | Claude integration — extractor and explainer only |
| `apps/api` | Fastify HTTP server exposing 3 endpoints |

**Do NOT touch `packages/frontend`.** That is Agent B's territory.

---

## Integration Protocol

You communicate with Agent B via **git signal commits**. Include the tag in your commit message:

| Tag | When to use |
|---|---|
| `[SIGNAL: shared-types-ready]` | After publishing `packages/shared` |
| `[SIGNAL: calculate-ready]` | After `POST /api/calculate` is live and tested |
| `[SIGNAL: extract-ready]` | After `POST /api/extract` is live |
| `[SIGNAL: explain-ready]` | After `POST /api/explain` is live |

To see what Agent B has shipped:
```bash
git fetch origin
git log origin/feature/frontend --oneline | grep SIGNAL
```

To pull Agent B's latest (e.g., to run integration tests):
```bash
git merge origin/feature/frontend --no-edit
```

---

## Phase 0 — Bootstrap & Shared Types
> **Priority: unblock Agent B immediately. Do this before anything else.**

### Step 1 — Monorepo scaffold
- [ ] Create `/.nvmrc` containing `20`
- [ ] Create root `package.json`:
  ```json
  {
    "name": "taxai",
    "private": true,
    "workspaces": ["packages/*", "apps/*"],
    "scripts": {
      "test": "pnpm -r test",
      "dev:api": "pnpm --filter @taxai/api dev"
    }
  }
  ```
- [ ] Create `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - 'packages/*'
    - 'apps/*'
  ```
- [ ] Create `tsconfig.base.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "resolveJsonModule": true
    }
  }
  ```
- [ ] Run `pnpm install`
- [ ] Commit: `chore: monorepo scaffold [Phase 0]`

### Step 2 — packages/shared (Agent B is blocked until this is done)
- [ ] Create `packages/shared/package.json`:
  ```json
  {
    "name": "@taxai/shared",
    "version": "0.1.0",
    "main": "./src/index.ts",
    "types": "./src/index.ts"
  }
  ```
- [ ] Create `packages/shared/src/types.ts` with the **exact** interfaces from CLAUDE.md section 5:
  - `TaxInput`
  - `SpanishRegion` (all 17 autonomías)
  - `CivilStatus`
  - `DisabilityGrade`
  - `TaxResult`
  - `WaterfallStep`
- [ ] Create `packages/shared/src/index.ts` that re-exports everything from `types.ts`
- [ ] **Commit with signal:** `feat(shared): publish TaxInput, TaxResult, WaterfallStep types [SIGNAL: shared-types-ready]`

---

## Phase 1 — Tax Engine (Madrid + Catalonia first)

### Step 3 — Tax rules JSON files
Create these files exactly following the schema in CLAUDE.md section 7:

- [ ] `packages/engine/rules/2024/state.json` — 2024 state (estatal) brackets from CLAUDE.md section 9:
  ```json
  {
    "region": "state",
    "fiscalYear": 2024,
    "stateBrackets": [
      { "from": 0,      "to": 12450,  "rate": 0.095 },
      { "from": 12450,  "to": 20200,  "rate": 0.12  },
      { "from": 20200,  "to": 35200,  "rate": 0.15  },
      { "from": 35200,  "to": 60000,  "rate": 0.185 },
      { "from": 60000,  "to": 300000, "rate": 0.225 },
      { "from": 300000, "to": null,   "rate": 0.245 }
    ]
  }
  ```

- [ ] `packages/engine/rules/2024/madrid.json`:
  ```json
  {
    "region": "madrid",
    "fiscalYear": 2024,
    "autonomicBrackets": [
      { "from": 0,      "to": 12450,  "rate": 0.09  },
      { "from": 12450,  "to": 17707,  "rate": 0.09  },
      { "from": 17707,  "to": 33007,  "rate": 0.12  },
      { "from": 33007,  "to": 53407,  "rate": 0.14  },
      { "from": 53407,  "to": null,   "rate": 0.17  }
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

- [ ] `packages/engine/rules/2024/catalonia.json` — research official 2024 Catalan autonomic brackets (top rate ~21.5% autonomic)

### Step 4 — Engine implementation
Create `packages/engine/package.json` with name `@taxai/engine`, dependencies on `@taxai/shared`.

Implement the 8-step calculation order from CLAUDE.md section 6:

- [ ] `packages/engine/src/reductions.ts` — Step 2: trabajo reductions
  - If `grossSalary <= 14852`: full reduction = min(5565, grossSalary - otherIncome)
  - If `14852 < grossSalary <= 19747`: linear phase-out between maxReduction and baseReduction
  - If `grossSalary > 19747`: reduction = baseReduction (€2,000)
  - Returns `rendimientoNetoReducido` in **cents**

- [ ] `packages/engine/src/minimums.ts` — Step 3: mínimo personal y familiar
  - Base: 555000 cents (€5,550)
  - Age 65–74: +115000 cents; Age 75+: +140000 cents on top of age-65 increase
  - Per dependent under 25: +240000 (1st), +270000 (2nd), +400000 (3rd+)
  - Per dependent under 3: additional +100000 each
  - Per dependent over 65: +112500; over 75: +142500
  - Returns `minimumPersonalFamiliar` in **cents**

- [ ] `packages/engine/src/brackets.ts` — Step 5: progressive bracket applier
  ```typescript
  // applyBrackets(baseInCents: number, brackets: Bracket[]): number
  // Iterates brackets, applies rate to the slice within each bracket.
  // Uses Math.round() at each boundary.
  // Returns total tax in cents.
  ```

- [ ] `packages/engine/src/calculator.ts` — orchestrator: Steps 1–8
  - Loads rules from JSON (step 1)
  - Calls reductions.ts (step 2)
  - Calls minimums.ts (step 3)
  - Splits base 50% state / 50% regional (step 4)
  - Applies state brackets + autonomic brackets (step 5)
  - Applies minimum reduction to each half (step 6)
  - Subtracts retenciones (step 7)
  - Determines resultType (step 8)
  - Builds `waterfallSteps` array with each intermediate value
  - **Converts all cents to euros** before returning `TaxResult`

### Step 5 — Parity tests
- [ ] `packages/engine/tests/madrid.test.ts` — 5 test cases:
  Use these known AT-verifiable inputs:
  1. Salary €20,000, age 30, single, no deps, retenciones €2,400
  2. Salary €35,000, age 30, single, no deps, retenciones €5,250
  3. Salary €50,000, age 40, married, 1 dep <25, retenciones €9,000
  4. Salary €80,000, age 45, single, no deps, retenciones €22,000
  5. Salary €12,000, age 67, single, no deps, retenciones €0
- [ ] `packages/engine/tests/catalonia.test.ts` — same 5 inputs for Catalonia
- [ ] Run `pnpm test` — all pass before proceeding
- [ ] Commit: `feat(engine): Madrid + Catalonia with parity tests [Phase 1]`

### Step 6 — Fastify API server
- [ ] Create `apps/api/package.json` — name `@taxai/api`, deps: `fastify`, `@fastify/cors`, `dotenv`, `@taxai/engine`, `@taxai/shared`
- [ ] Create `.env.example`:
  ```
  ANTHROPIC_API_KEY=
  PORT=3000
  ```
  Add `.env` to `.gitignore`
- [ ] Create `apps/api/src/server.ts`:
  - Register `@fastify/cors` with `origin: 'http://localhost:5173'`
  - Register `dotenv`
  - Mount routes
  - Listen on `process.env.PORT ?? 3000`
- [ ] Create `apps/api/src/routes/calculate.ts`:
  - Validate request body matches `TaxInput` shape (use Fastify JSON schema)
  - Call `calculator.calculate(input)`
  - Return `TaxResult`
  - On validation error: return 400 with message in Spanish
- [ ] Smoke test:
  ```bash
  curl -s -X POST http://localhost:3000/api/calculate \
    -H "Content-Type: application/json" \
    -d '{"fiscalYear":2024,"region":"madrid","age":32,"grossSalary":35000,"retenciones":4200,"dependentsUnder25":0,"dependentsOver65":0,"civilStatus":"single"}'
  ```
- [ ] **Commit with signal:** `feat(api): POST /api/calculate live on :3000 [SIGNAL: calculate-ready]`

---

## Phase 2 — AI Layer

### Step 7 — Claude extractor
- [ ] Create `packages/ai-layer/package.json` — deps: `@anthropic-ai/sdk`, `@taxai/shared`
- [ ] Create `packages/ai-layer/src/prompts.ts` — system prompts as exported string constants
- [ ] Create `packages/ai-layer/src/extractor.ts`:
  - **PII guard:** reject/strip input matching `/\b\d{8}[A-Za-z]\b/` (DNI) or IBAN (`/\bES\d{22}\b/`) before calling API
  - Use `tools` parameter (tool-use) so Claude returns a structured `Partial<TaxInput>` — never free text
  - Tool definition must enumerate all `TaxInput` fields with descriptions in Spanish
  - Model: `claude-sonnet-4-6`
  - Only return fields the user explicitly mentioned — do not guess missing fields

- [ ] Create `packages/ai-layer/src/routes/extract.ts`:
  - `POST /api/extract` — body `{ message: string }`
  - Returns `Partial<TaxInput>`
  - If PII detected: return 400 `{ error: "No incluyas datos personales identificativos (DNI, IBAN, etc.)" }`

### Step 8 — Claude explainer
- [ ] Create `packages/ai-layer/src/explainer.ts`:
  - System prompt (in `prompts.ts`): "Eres un asistente fiscal español. Explica el resultado usando únicamente los números del JSON proporcionado. No realices cálculos propios. Responde en español. Máximo 250 palabras."
  - User message: include the full `waterfallSteps` array as formatted JSON + the user's question
  - Returns `{ explanation: string }`

- [ ] Create `apps/api/src/routes/explain.ts`:
  - `POST /api/explain` — body `{ result: TaxResult, question: string }`
  - Returns `{ explanation: string }`

- [ ] Write tests for extractor: mock the Anthropic client, verify PII rejection, verify JSON output shape
- [ ] **Commit with signal:** `feat(ai): extractor + explainer live [SIGNAL: extract-ready] [SIGNAL: explain-ready]`

---

## Phase 3 — Full Regional Coverage

- [ ] Add `packages/engine/rules/2024/{region}.json` for all 17 autonomías:
  andalusia, aragon, asturias, balearics, canarias, cantabria,
  castilla-la-mancha, castilla-leon, extremadura, galicia,
  la-rioja, murcia, navarra, pais-vasco, valenciana
- [ ] At least 2 parity test cases per new region
- [ ] Commit: `feat(engine): all 17 autonomías rules and tests [Phase 3]`

---

## Phase 4 — Hardening

- [ ] Edge cases: `grossSalary = 0`, salary > €300,000, disability grades, multiple dependents
- [ ] Rate limiting on AI routes (max 20 req/min per IP) to control API cost
- [ ] Error messages: all 4xx/5xx user-facing messages in Spanish
- [ ] Commit: `feat(api): hardening and edge case handling [Phase 4]`

---

## Dev Commands

```bash
# Install all deps from monorepo root
pnpm install

# Run all tests
pnpm test

# Start API server (from monorepo root)
pnpm dev:api

# Run engine tests only
pnpm --filter @taxai/engine test
```
