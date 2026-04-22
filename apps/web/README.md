# `@taxai/frontend` — React SPA

The user-facing single-page application. Built with React 19, Vite, Tailwind CSS v4, and Recharts. In production it is compiled to a static bundle and served directly by the API server.

---

## Start

```bash
# Hot-reload dev server on http://localhost:5173 (proxies /api/* to localhost:3000)
pnpm --filter @taxai/frontend dev

# Production build (output goes to dist/, served by @taxai/api)
pnpm --filter @taxai/frontend build
```

---

## Application layout (`src/App.tsx`)

Three input tabs, each maintaining its own independent result state (switching tabs does not lose your calculation):

| Tab | Component | What it does |
|---|---|---|
| Formulario | `InputForm` | Manual form for all `TaxInput` fields |
| Nómina mensual | `NominaUpload` | Single payslip PDF upload + monthly comparison card |
| Renta anual | `RentaAnual` | Up to 12 payslip PDFs + annual declaration result |

Below the active tab, when a result is available:

- `ResultDashboard` — hero card (a ingresar / a devolver) + full breakdown grid
- `TaxBreakdownCharts` — donut chart (net income vs. tax) + grouped bar (state vs. regional)
- `WaterfallChart` — step-by-step waterfall of the tax calculation
- `ExplanationPanel` — text input → calls `/api/explain` → plain Spanish answer
- `DownloadPDFButton` — export the result to a formatted PDF

---

## Components (`src/components/`)

| Component | Purpose |
|---|---|
| `ApiKeyBanner.tsx` | Collapsible banner to enter/clear a personal Anthropic API key; stored in `localStorage`, sent as `X-Api-Key` header |
| `InputForm.tsx` | All `TaxInput` fields: region, year, age, salary, SS, retenciones, dependants, civil status, disability, savings income, rental income, pension, Catalonia deductions, rent payments |
| `NominaUpload.tsx` | File input for a single payslip PDF; shows a monthly IRPF comparison card (employer withheld vs. exact legal amount) |
| `RentaAnual.tsx` | Multi-file upload (up to 12 PDFs); displays a month-by-month breakdown table and annual result card |
| `BrokerUpload.tsx` | File input for a broker CSV or PDF; shows FIFO-computed capital gains, dividends, interest, and full tax result |
| `ResultDashboard.tsx` | Hero card showing final amount (a ingresar/a devolver), plus a grid of every intermediate value in the `TaxResult` |
| `TaxBreakdownCharts.tsx` | KPI cards (effective rate, net income, total tax) + Recharts donut + grouped bar chart |
| `WaterfallChart.tsx` | Recharts bar chart showing each `WaterfallStep` (salary → deductions → base → brackets → result) |
| `ExplanationPanel.tsx` | Text area for a user question; calls `/api/explain` with the current `TaxResult`; renders the AI response |
| `DownloadPDFButton.tsx` | Triggers PDF generation and download using `@react-pdf/renderer` |

---

## PDF export (`src/pdf/`)

| File | Purpose |
|---|---|
| `TaxResultPDF.tsx` | Full tax result export (form tab) |
| `NominaMensualPDF.tsx` | Monthly nómina comparison export |
| `RentaAnualPDF.tsx` | Annual declaration export |
| `buildSections.ts` | Shared helper — converts `TaxResult` into display sections used by all three PDFs |

---

## API client (`src/api/taxai.ts`)

Typed fetch wrappers for all backend endpoints:

- `calculate(input)` → `TaxResult`
- `parseNomina(formData)` → `NominaParseResult`
- `parseRenta(formData)` → `RentaAnualResult`
- `parseBroker(formData)` → `BrokerParseResult`
- `explain(result, question)` → `{ explanation: string }`

All functions forward the `X-Api-Key` header when the user has set a personal API key.

---

## Utilities

| File | Purpose |
|---|---|
| `src/utils/apiKey.ts` | `getApiKey()` / `setApiKey()` / `clearApiKey()` — read/write the key from `localStorage` |
| `src/mocks/taxResult.ts` | Hardcoded `MOCK_RESULT` used during local development when the API is not running |

---

## Tests

```bash
pnpm --filter @taxai/frontend test
```

| Test file | Coverage |
|---|---|
| `ResultDashboard.test.tsx` | Renders correctly for `a_ingresar`, `a_devolver`, and `cero` results |
| `WaterfallChart.test.tsx` | Renders waterfall bars from `waterfallSteps` |
| `TaxResultPDF.test.tsx` | PDF generation does not throw |
| `buildSections.test.ts` | Section builder produces correct labels and amounts |

---

## Configuration

| File | Purpose |
|---|---|
| `vite.config.ts` | Dev proxy (`/api` → `localhost:3000`), build output to `dist/` |
| `vitest.config.ts` | Vitest setup with jsdom environment and `tests/setup.ts` |
