# `@taxai/api` — Fastify HTTP Server

The API server is the single process that runs in production. It:

1. Exposes all HTTP endpoints
2. Serves the built React SPA as static files (from `apps/web/dist`)
3. Rate-limits all AI-powered endpoints (20 req/min per IP, in-memory)
4. Proxies the user's Anthropic API key via `X-Api-Key` header when provided

---

## Start

```bash
# Development (hot-reload via tsx)
pnpm --filter @taxai/api dev

# Production
pnpm --filter @taxai/api build && pnpm --filter @taxai/api start
```

Listens on `PORT` (default `3000`). In production, visiting `/` serves the React SPA; all `/api/*` routes are the JSON API.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Server-side fallback when no `X-Api-Key` header is present |
| `PORT` | `3000` | HTTP port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for the Vite dev server |

---

## API Endpoints

### `POST /api/calculate`

Pure deterministic IRPF calculation. No AI involved.

**Request body (`TaxInput`):**

```json
{
  "fiscalYear": 2025,
  "region": "madrid",
  "age": 35,
  "grossSalary": 45000,
  "ssContributions": 2700,
  "retenciones": 8500,
  "dependentsUnder25": 1,
  "dependentsOver65": 0,
  "civilStatus": "single",
  "otherIncome": 0
}
```

Optional fields: `disability`, `dependentsUnder3`, `savingsIncome` (capital gains/dividends/interest), `rentalIncome`, `rentPayments`, `pensionContributions`, `cataloniaDeductions`.

**Response (`TaxResult`):** complete breakdown including `rendimientoNetoReducido`, `baseImponibleGeneral`, `baseImponibleAhorro`, `cuotaIntegraEstatal`, `cuotaIntegraAutonomica`, `cuotaLiquidaTOTAL`, `resultAmount`, `resultType`, and `waterfallSteps`.

**Errors:** `400` validation error, `501` foral region, `422` missing rules file.

---

### `POST /api/parse-nomina`

Upload one payslip PDF. Claude extracts the figures; the engine calculates and compares.

**Request:** `multipart/form-data`

| Field | Type | Required | Default |
|---|---|---|---|
| `pdf` | file (PDF, max 10 MB) | Yes | — |
| `region` | string | No | `"madrid"` |
| `age` | number | No | `35` |
| `civilStatus` | string | No | `"single"` |
| `fiscalYear` | number | No | `2025` |

**Response (`NominaParseResult`):** extracted `NominaData`, derived `taxInput`, optional `taxResult`, optional `comparison` (`overpaid/underpaid/correct` within 2%).

**Errors:** `400` no file / bad PDF, `422` unreadable PDF, `429` rate limit, `500`.

---

### `POST /api/parse-renta`

Upload up to 12 monthly payslip PDFs for a full annual declaration. Each PDF is parsed independently; actual monthly figures are summed (no projection).

**Request:** `multipart/form-data`

| Field | Type | Required | Default |
|---|---|---|---|
| `pdf_0` … `pdf_11` | files (PDF, max 10 MB each) | At least one | — |
| `region` | string | No | `"madrid"` |
| `age` | number | No | `35` |
| `civilStatus` | string | No | `"single"` |
| `fiscalYear` | number | No | `2025` |

**Response (`RentaAnualResult`):** `months` array, `annualGross`, `annualBaseIRPF`, `annualRetencionesNomina`, `annualSS`, `taxInput`, optional `taxResult`, optional `comparison`.

---

### `POST /api/parse-broker`

Upload a broker annual report (PDF or CSV). Claude extracts transactions; the FIFO engine computes capital gains.

**Request:** `multipart/form-data`

| Field | Type | Required | Default |
|---|---|---|---|
| `file` | CSV or PDF, max 10 MB | Yes | — |
| `region` | string | No | `"madrid"` |
| `age` | number | No | `35` |
| `civilStatus` | string | No | `"single"` |
| `fiscalYear` | number | No | `2025` |

The fiscal year is auto-detected from the report when possible (overrides the form field).

**Response (`BrokerParseResult`):** `brokerReport` (raw transactions), `computedCapitalGains`, `computedDividends`, `computedInterest`, `totalForeignTaxWithheld`, partial `taxInput`, optional `taxResult`, `warnings`.

---

### `POST /api/explain`

Ask a question about a tax result. Returns a plain-Spanish explanation (no new numbers).

**Request body:**
```json
{
  "result": { /* TaxResult */ },
  "question": "¿Por qué pago tanto?"
}
```

**Response:** `{ "explanation": "..." }`

**Rate limit:** 20 req/min per IP.

---

### `POST /api/extract` _(legacy, not exposed in UI)_

Converts a free-text message into a partial `TaxInput`. Rate-limited, PII-guarded.

---

## Source files

| File | Purpose |
|---|---|
| `src/server.ts` | Fastify setup: plugins (CORS, multipart, static), route registration, SPA fallback |
| `src/anthropic.ts` | Creates an Anthropic client from `X-Api-Key` header or `ANTHROPIC_API_KEY` env var |
| `src/ratelimit.ts` | In-memory `RateLimiter` — 20 req/min per IP (single-process only) |
| `src/routes/calculate.ts` | `POST /api/calculate` |
| `src/routes/parse-nomina.ts` | `POST /api/parse-nomina` |
| `src/routes/parse-renta.ts` | `POST /api/parse-renta` |
| `src/routes/parse-broker.ts` | `POST /api/parse-broker` |
| `src/routes/explain.ts` | `POST /api/explain` |
| `src/routes/extract.ts` | `POST /api/extract` |

---

## Notes

- **Foral regions:** Navarra and País Vasco are valid `SpanishRegion` values but all endpoints return `501 Not Implemented` for them — their tax legislation is completely different.
- **Rate limiting:** The current implementation is in-memory and single-process. A load-balanced deployment would need Redis or a shared store.
- **API key forwarding:** `clientFromRequest()` checks the `X-Api-Key` header first; falls back to `ANTHROPIC_API_KEY`. The key is never logged.
