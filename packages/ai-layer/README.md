# `@taxai/ai-layer` — Claude API Wrappers

This package is **The Voice** of Taxai. It contains four thin, stateless functions that call Claude claude-sonnet-4-6 via tool-use (structured output). Its only job is translation:

- Human text / PDF text → structured JSON that the engine understands
- Engine output → plain Spanish explanation

**The AI never performs tax arithmetic.** All numbers in its output come from either the user's document or the engine's `TaxResult`.

---

## Exports

```typescript
import { extractTaxInput, PiiDetectedError } from '@taxai/ai-layer';
import { explainResult } from '@taxai/ai-layer';
import { parseNomina } from '@taxai/ai-layer';
import { parseBrokerReport } from '@taxai/ai-layer';
```

---

## Functions

### `extractTaxInput(message, client?): Promise<Partial<TaxInput>>`

Converts a free-text user message into a partial `TaxInput`.

- Uses Claude tool-use for structured output
- Only returns fields the user explicitly mentioned — missing fields are `undefined`
- **PII guard:** rejects any input matching DNI/NIE/IBAN patterns before calling the API; throws `PiiDetectedError`

### `explainResult(result, question, client?): Promise<string>`

Takes a completed `TaxResult` and a user question, returns a plain-Spanish explanation (max ~250 words).

- Must not introduce any number not already present in `TaxResult`
- Returns prose, no JSON

### `parseNomina(pdfText, client?): Promise<NominaData>`

Extracts financial figures from the raw text of a payslip PDF.

- Input is plain text extracted by `pdf-parse` upstream (the caller does the PDF parsing)
- Output is financial data only — no PII (names, DNI, account numbers are ignored)
- Returns: `monthlyGross`, `monthlyBaseIRPF`, `monthlyRetenciones`, SS breakdown, `numberOfPayments`, `retentionPercentage`, etc.

### `parseBrokerReport(reportText, client?): Promise<BrokerReportData>`

Extracts all transactions from a broker annual report (CSV or PDF text).

- Returns a list of `StockTransaction` objects: asset, type, date, quantity, amount, fees, FX rate, foreign tax withheld
- Also returns the broker's own reported totals (capital gains, dividends, interest, fees) when present
- If the model cannot find extractable data, returns an empty transaction list (no error thrown)
- The FIFO arithmetic is performed by `@taxai/engine`, not here

---

## Source files

| File | Purpose |
|---|---|
| `src/extractor.ts` | Chat message → `Partial<TaxInput>` (tool-use + PII guard) |
| `src/explainer.ts` | `TaxResult` + question → Spanish prose |
| `src/nomina-parser.ts` | PDF text → `NominaData` (tool-use) |
| `src/broker-parser.ts` | Broker report text → `BrokerReportData` (tool-use) |
| `src/prompts.ts` | System prompts for all four functions |
| `src/index.ts` | Public exports |

---

## Privacy rules (enforced in prompts and code)

1. No PII is ever sent to the Claude API — only anonymized financial figures and region codes
2. `extractTaxInput` rejects inputs matching DNI (`\d{8}[A-Z]`), NIE (`[XYZ]\d{7}[A-Z]`), or IBAN patterns before any API call
3. `parseNomina` and `parseBrokerReport` explicitly instruct the model to skip names, IDs, addresses, and account numbers

---

## Tests

```bash
pnpm --filter @taxai/ai-layer test
```

Tests use a mock Anthropic client so they run without a real API key.
