# TASKS.md — Agent B (Frontend)

> Start here. Read CLAUDE.md first for full project context, architecture rules, and the Golden Rule.
> This file is your step-by-step build plan. Work top to bottom. Commit at each checkpoint.

---

## Your Ownership

| Package | Your responsibility |
|---|---|
| `packages/frontend` | Everything the user sees — React app, components, API calls |

**Do NOT touch `packages/engine`, `packages/ai-layer`, or `apps/api`.** Those are Agent A's territory.

---

## Integration Protocol

Agent A communicates readiness via **git signal commits** on `feature/backend`.
Check for signals before starting any API-dependent work:

```bash
git fetch origin
git log origin/feature/backend --oneline | grep SIGNAL
```

When you see a signal you need, pull Agent A's work:
```bash
git merge origin/feature/backend --no-edit
```

| Signal to watch for | What it means | Your action |
|---|---|---|
| `[SIGNAL: shared-types-ready]` | `packages/shared` is published | Replace your local `types.ts` copy with `import from '@taxai/shared'` |
| `[SIGNAL: calculate-ready]` | `POST /api/calculate` is live on :3000 | Wire up `src/api/taxai.ts`, replace mock with live call |
| `[SIGNAL: extract-ready]` | `POST /api/extract` is live | Build `ChatInput.tsx` |
| `[SIGNAL: explain-ready]` | `POST /api/explain` is live | Build `ExplanationPanel.tsx` |

To notify Agent A when your dashboard is ready:
- Commit: `feat(frontend): ResultDashboard + WaterfallChart [SIGNAL: dashboard-ready]`

---

## Phase 0 — Bootstrap

### Step 1 — Scaffold
- [ ] From the monorepo root (one level up from this worktree), ensure `package.json` has workspaces configured. If Agent A hasn't created it yet, create it yourself:
  ```json
  { "private": true, "workspaces": ["packages/*", "apps/*"] }
  ```
- [ ] Create `packages/frontend/` using Vite:
  ```bash
  pnpm create vite packages/frontend --template react-ts
  cd packages/frontend
  ```
- [ ] Update `packages/frontend/package.json` — set `"name": "@taxai/frontend"`
- [ ] Install UI deps:
  ```bash
  pnpm add recharts
  pnpm add -D tailwindcss @tailwindcss/vite
  ```
- [ ] Configure Tailwind: add `@tailwindcss/vite` plugin to `vite.config.ts`, add `@import "tailwindcss"` to `src/index.css`
- [ ] Commit: `chore(frontend): Vite + React 18 + Tailwind + Recharts scaffold [Phase 0]`

### Step 2 — Local types (temporary, until `[SIGNAL: shared-types-ready]`)
Create `packages/frontend/src/types.ts` with a **verbatim copy** of the interfaces from CLAUDE.md section 5:
- `TaxInput`, `SpanishRegion`, `CivilStatus`, `DisabilityGrade`, `TaxResult`, `WaterfallStep`

**The moment Agent A commits `[SIGNAL: shared-types-ready]`:**
1. Run `git merge origin/feature/backend --no-edit`
2. Add `"@taxai/shared": "workspace:*"` to `packages/frontend/package.json` dependencies
3. Delete `src/types.ts`
4. Replace all `import ... from '../types'` with `import ... from '@taxai/shared'`
5. Run `pnpm install`

### Step 3 — Mock data
Create `packages/frontend/src/mocks/taxResult.ts`. Use this until the API is live:

```typescript
import type { TaxResult } from '../types'  // or '@taxai/shared' after signal

export const MOCK_RESULT: TaxResult = {
  fiscalYear: 2024,
  region: 'madrid',
  grossSalary: 35000,
  rendimientoNetoReducido: 33000,
  baseImponibleGeneral: 33000,
  minimumPersonalFamiliar: 5550,
  cuotaIntegraEstatal: 1669,
  cuotaIntegraAutonomica: 1485,
  cuotaIntegraTOTAL: 3154,
  cuotaLiquidaEstatal: 1143,
  cuotaLiquidaAutonomica: 960,
  cuotaLiquidaTOTAL: 2103,
  retenciones: 4200,
  resultAmount: -2097,
  resultType: 'a_devolver',
  waterfallSteps: [
    { label: 'Salario bruto', amount: 35000, runningTotal: 35000 },
    { label: 'Reducción por trabajo', amount: -2000, runningTotal: 33000 },
    { label: 'Cuota íntegra estatal', amount: 1669, runningTotal: 1669, bracketRate: 0.095 },
    { label: 'Cuota íntegra autonómica (Madrid)', amount: 1485, runningTotal: 3154, bracketRate: 0.09 },
    { label: 'Reducción mínimo personal', amount: -1051, runningTotal: 2103 },
    { label: 'Retenciones a cuenta', amount: -4200, runningTotal: -2097 },
  ],
}
```

---

## Phase 1 — Results Dashboard
> **Do this before connecting any API. This is the core value proposition of the app.**
> A user must understand their tax status within 5 seconds of seeing this screen.

### Step 4 — ResultDashboard.tsx
Create `packages/frontend/src/components/ResultDashboard.tsx`:

- [ ] **Hero card** (top, full width on mobile):
  - Large (text-5xl) euro amount: format `resultAmount` as `€2.097,00` (Spanish locale)
  - Bold label: "A devolver" (green) or "A ingresar" (red)
  - Use `resultType` to set `bg-green-50 border-green-400` or `bg-red-50 border-red-400`
  - Subtext: `Declaración de la Renta {fiscalYear} · {region}` (capitalize region)

- [ ] **Tax breakdown grid** (below hero, 2 cols on desktop, 1 on mobile):
  - Salario bruto → `grossSalary`
  - Rendimiento neto → `rendimientoNetoReducido`
  - Mínimo personal y familiar → `minimumPersonalFamiliar`
  - Cuota íntegra total → `cuotaIntegraTOTAL`
  - Cuota líquida total → `cuotaLiquidaTOTAL`
  - Retenciones → `retenciones`
  - Each row: label on left, euro amount on right, monospace font for amounts

- [ ] All euro amounts formatted with `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })`

### Step 5 — WaterfallChart.tsx
Create `packages/frontend/src/components/WaterfallChart.tsx` using Recharts:

- [ ] Use `BarChart` from Recharts
- [ ] One bar per `WaterfallStep`
- [ ] Bar color:
  - `amount < 0` → `#16a34a` (green, reduces tax burden)
  - `amount > 0` → `#dc2626` (red, adds to tax burden)
- [ ] X-axis: `label` (rotate 30° if needed for readability)
- [ ] Y-axis: euro amounts (pass `amount` directly — already in euros from API)
- [ ] `Tooltip`: show `label`, `amount` formatted as euros, `bracketRate` as percentage if present
- [ ] Responsive: wrap in `<ResponsiveContainer width="100%" height={320}>`

### Step 6 — Compose and validate
- [ ] Update `App.tsx` to import `MOCK_RESULT` and render `<ResultDashboard result={MOCK_RESULT} />` and `<WaterfallChart steps={MOCK_RESULT.waterfallSteps} />`
- [ ] Run `pnpm dev` and open browser — verify it looks production-ready
- [ ] Test at 375px width (mobile): hero card and chart must be readable
- [ ] **Commit with signal:** `feat(frontend): ResultDashboard + WaterfallChart with mock data [SIGNAL: dashboard-ready]`

---

## Phase 1 — API Integration
> **Wait for `[SIGNAL: calculate-ready]` from Agent A before this step.**
> Check: `git fetch origin && git log origin/feature/backend --oneline | grep calculate-ready`

### Step 7 — API client
Create `packages/frontend/src/api/taxai.ts`:

```typescript
import type { TaxInput, TaxResult } from '@taxai/shared'  // or local types.ts

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Error en el servidor. Inténtalo de nuevo.')
  }
  return res.json()
}

export const taxai = {
  calculate: (input: TaxInput) => post<TaxResult>('/api/calculate', input),
  extract:   (message: string) => post<Partial<TaxInput>>('/api/extract', { message }),
  explain:   (result: TaxResult, question: string) =>
               post<{ explanation: string }>('/api/explain', { result, question }),
}
```

Create `packages/frontend/.env.example`:
```
VITE_API_BASE=http://localhost:3000
```

### Step 8 — InputForm.tsx
Create `packages/frontend/src/components/InputForm.tsx`:

- [ ] One labeled field per required `TaxInput` property:
  - **Comunidad Autónoma** → `<select>` with all 17 SpanishRegion values, labels in Spanish
  - **Ejercicio fiscal** → number input, default 2024
  - **Edad** → number input
  - **Salario bruto anual (€)** → number input
  - **Otros ingresos (€)** → number input, optional
  - **Retenciones a cuenta (€)** → number input
  - **Hijos/dependientes menores de 25** → number input, default 0
  - **Dependientes mayores de 65** → number input, default 0
  - **Estado civil** → `<select>`: Soltero/a, Casado/a, Viudo/a, Separado/a
  - **Discapacidad** → `<select>`: Ninguna, 33%, 65%+

- [ ] Submit button: "Calcular mi declaración"
- [ ] Loading state: disable button, show spinner
- [ ] Error state: red banner with error message in Spanish below the form
- [ ] On success: call `onResult(result: TaxResult)` prop

### Step 9 — Wire App.tsx
- [ ] `App.tsx` manages state: `result: TaxResult | null`, `loading: boolean`, `error: string | null`
- [ ] Shows `<InputForm>` always
- [ ] Shows `<ResultDashboard>` and `<WaterfallChart>` only when `result !== null`
- [ ] Remove mock data
- [ ] Commit: `feat(frontend): InputForm wired to live /api/calculate [Phase 1]`

---

## Phase 2 — AI Features
> **Wait for `[SIGNAL: extract-ready]` and `[SIGNAL: explain-ready]` before this phase.**

### Step 10 — ChatInput.tsx
Create `packages/frontend/src/components/ChatInput.tsx`:

- [ ] Free-text `<textarea>` with placeholder: "Ej: Tengo 35 años, vivo en Madrid y gané 40.000€ el año pasado"
- [ ] Button: "Analizar"
- [ ] Calls `taxai.extract(message)`, shows extracted fields in a summary card
- [ ] Summary card: editable fields pre-filled with extracted values, user can correct them
- [ ] "Confirmar y calcular" button → calls `taxai.calculate()` with confirmed values
- [ ] Toggle between ChatInput and InputForm with tabs: "Formulario" / "Chat"

### Step 11 — ExplanationPanel.tsx
Create `packages/frontend/src/components/ExplanationPanel.tsx`:

- [ ] Rendered below `<WaterfallChart>` after first calculation
- [ ] Text input: placeholder "¿Tienes alguna pregunta sobre tu resultado?"
- [ ] Button: "Preguntar"
- [ ] Calls `taxai.explain(result, question)`, renders response as `<p>` prose
- [ ] Loading state while awaiting AI response
- [ ] The response must never show a number that wasn't already in the dashboard — this is enforced by the API, but visually verify it
- [ ] Commit: `feat(frontend): ChatInput + ExplanationPanel [Phase 2]`

---

## Phase 3 — Region Selector UX

- [ ] Replace bare region code in results with full Spanish name:
  ```typescript
  const REGION_NAMES: Record<SpanishRegion, string> = {
    'madrid': 'Comunidad de Madrid',
    'catalonia': 'Cataluña',
    // ...all 17
  }
  ```
- [ ] Add visual indicator (colored dot or badge) by result type in hero card
- [ ] Commit: `feat(frontend): region names and UX polish [Phase 3]`

---

## Phase 4 — Hardening

- [ ] Accessibility: all form fields have `<label htmlFor>`, color contrast WCAG 2.1 AA
- [ ] Keyboard navigation: form submits on Enter, tab order is logical
- [ ] Empty state: helpful message when no result yet
- [ ] Handle API down: show "El servicio no está disponible. Inténtalo más tarde." banner
- [ ] Commit: `feat(frontend): accessibility and error handling [Phase 4]`

---

## Dev Commands

```bash
# From packages/frontend
pnpm dev          # starts Vite on http://localhost:5173
pnpm build        # production build
pnpm test         # Vitest

# From monorepo root
pnpm --filter @taxai/frontend dev
```

## Spanish Region Names Reference

| Code | Name |
|---|---|
| andalusia | Andalucía |
| aragon | Aragón |
| asturias | Asturias |
| balearics | Islas Baleares |
| canarias | Canarias |
| cantabria | Cantabria |
| castilla-la-mancha | Castilla-La Mancha |
| castilla-leon | Castilla y León |
| catalonia | Cataluña |
| extremadura | Extremadura |
| galicia | Galicia |
| la-rioja | La Rioja |
| madrid | Comunidad de Madrid |
| murcia | Región de Murcia |
| navarra | Navarra |
| pais-vasco | País Vasco |
| valenciana | Comunidad Valenciana |
