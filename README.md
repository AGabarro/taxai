# Taxai — AI-Assisted IRPF Calculator for Spain

A **"Glass Box"** Spanish income tax (IRPF) estimator. Enter your financial situation and get an instant, accurate, fully transparent tax breakdown — including a step-by-step waterfall of how your liability is calculated.

> **The AI never does any math.** Claude only reads documents and translates them into structured data. All tax arithmetic is handled by a deterministic engine that mirrors the AEAT official simulator to the cent.

---

## Features

- **Manual form** — fill in salary, family situation, region, and see your IRPF in real time
- **Nómina upload** — upload a payslip PDF; Claude extracts the figures and compares your employer's withholding against the exact legal amount
- **Renta anual** — upload up to 12 monthly payslips to aggregate a full annual tax declaration
- **Broker report** — upload a CSV or PDF from your broker; a FIFO engine (Art. 35 LIRPF) computes your capital gains and feeds them into the tax calculation
- **Multiple income types** — salary, capital gains, dividends, interest, rental income, and other income all handled
- **Full deduction support** — Social Security, *reducción por rendimientos del trabajo*, *mínimo personal y familiar*, rent deduction (varies by region), pension contributions, and Catalonia-specific deductions
- **PDF export** — download a formatted breakdown of your tax result, nómina comparison, or annual declaration
- **AI explanations** — ask a question about your result in plain Spanish and get a concise answer (the AI only references numbers already in the calculation)
- **Bring your own API key** — enter your Anthropic key in the browser; it is sent via `X-Api-Key` header and never stored on the server

**Fiscal years supported:** 2024, 2025, 2026  
**Regions supported:** 15 common-regime autonomías (Navarra and País Vasco use foral legislation — coming later)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Charts | Recharts 2 |
| PDF export | `@react-pdf/renderer` |
| Backend | Fastify 4 + Node.js 22 + TypeScript |
| AI SDK | `@anthropic-ai/sdk ^0.27` (Claude claude-sonnet-4-6) |
| Tax rules | JSON files under `packages/engine/rules/` |
| Testing | Vitest across all packages |
| Package manager | pnpm (workspaces) |

---

## Repository Structure

```
taxai/
├── apps/
│   ├── api/          ← Fastify HTTP server + all API routes
│   └── web/          ← React SPA (served as static by the API in production)
├── packages/
│   ├── engine/       ← Deterministic tax engine — no AI, no network calls
│   ├── ai-layer/     ← Thin Claude API wrappers (parse, extract, explain)
│   └── shared/       ← TypeScript types shared across every package
├── docs/             ← Tax rules reference, integration notes, task list
├── CLAUDE.md         ← Agent briefing (architecture rules, data contracts)
├── .env.example
└── pnpm-workspace.yaml
```

Each subdirectory contains its own `README.md` with a detailed description of that layer.

---

## Setup

### Prerequisites

- **Node.js 22** — install via [nvm](https://github.com/nvm-sh/nvm): `nvm use` (reads `.nvmrc`)
- **pnpm** — install via `npm install -g pnpm`
- An **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

### Install & configure

```bash
# 1. Clone and enter the repo
git clone <repo-url> taxai && cd taxai

# 2. Use the correct Node version
nvm use

# 3. Install all dependencies (all packages and apps in one shot)
pnpm install

# 4. Set up environment variables
cp .env.example .env
# Edit .env and add your Anthropic API key:
#   ANTHROPIC_API_KEY=sk-ant-...
#   PORT=3000
```

### Development

```bash
# Start the API server (serves the built frontend at localhost:3000)
pnpm dev:api

# Start the Vite dev server for hot-reload frontend (localhost:5173, proxies API)
pnpm dev:ui
```

For a full dev workflow, run both commands in separate terminals.

### Production build

```bash
# Build the frontend and start the API (which serves it as static)
pnpm start
```

The single process listens on `PORT` (default 3000) and serves both the API and the React SPA.

### Run tests

```bash
# Run all tests across every package
pnpm test

# Run tests for a specific package
pnpm --filter @taxai/engine test
pnpm --filter @taxai/frontend test
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/calculate` | Manual tax calculation from `TaxInput` → `TaxResult` |
| `POST` | `/api/parse-nomina` | Upload payslip PDF → extract figures + monthly comparison |
| `POST` | `/api/parse-renta` | Upload up to 12 payslip PDFs → annual declaration |
| `POST` | `/api/parse-broker` | Upload broker CSV/PDF → FIFO capital gains + tax |
| `POST` | `/api/explain` | Ask a question about a `TaxResult` → Spanish prose |
| `POST` | `/api/extract` | Chat message → partial `TaxInput` (PII-guarded) |

All AI-powered endpoints are rate-limited to **20 requests per minute per IP**.  
Foral regions (Navarra, País Vasco) return `501 Not Implemented`.

See [`apps/api/README.md`](apps/api/README.md) for full request/response schemas.

---

## Architecture: The Golden Rule

```
User Input / PDF
      │
      ▼
  Claude (The Voice) ──────────── Only: text → structured JSON
      │                           Never: arithmetic, tax figures
      ▼
  Tax Engine (The Brain) ──────── Only: deterministic arithmetic
      │                           Uses: official AEAT tables (JSON)
      ▼
  TaxResult → UI / PDF export
      │
      ▼
  Claude (The Voice, again) ───── Only: describes what Engine calculated
```

The AI and the engine never swap roles. If they do, the system is compromised.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (server-side default) | Used when no `X-Api-Key` header is present |
| `PORT` | No | HTTP port (default: `3000`) |

Users can also supply their own key from the browser via the **API Key** banner in the UI. The key is stored in `localStorage`, sent as `X-Api-Key`, and never logged by the server.

---

## Contributing

1. Follow the conventions in `CLAUDE.md` (the agent briefing is also useful for humans)
2. All new regions must pass parity tests against the AEAT official simulator before merging
3. Commits use `feat:`, `fix:`, `test:`, `chore:` prefixes with the area in parentheses, e.g. `feat(engine): add 2026 Galicia brackets`
4. No `any` in TypeScript — strict mode throughout

---

## License

Private project — not licensed for redistribution.
