import type { TaxInput, TaxResult, NominaParseResult, RentaAnualResult, SpanishRegion, CivilStatus } from '@taxai/shared'
import { getApiKey } from '../utils/apiKey'

// Empty string = relative URLs (same origin). Works for both production (Fastify serves everything)
// and dev (Vite proxies /api/* to localhost:3000 via vite.config.ts).
const BASE = import.meta.env.VITE_API_BASE ?? ''

function apiKeyHeader(): Record<string, string> {
  const key = getApiKey()
  return key ? { 'X-Api-Key': key } : {}
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...apiKeyHeader() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new Error(err.error ?? err.message ?? 'Error en el servidor. Inténtalo de nuevo.')
  }
  return res.json() as Promise<T>
}

export interface NominaUploadOptions {
  pdf: File
  region?: SpanishRegion
  age?: number
  civilStatus?: CivilStatus
  fiscalYear?: number
}

export interface RentaUploadOptions {
  pdfs: File[]
  region?: SpanishRegion
  age?: number
  civilStatus?: CivilStatus
  fiscalYear?: number
}

async function parseNomina(opts: NominaUploadOptions): Promise<NominaParseResult> {
  const form = new FormData()
  form.append('pdf', opts.pdf)
  if (opts.region) form.append('region', opts.region)
  if (opts.age !== undefined) form.append('age', String(opts.age))
  if (opts.civilStatus) form.append('civilStatus', opts.civilStatus)
  if (opts.fiscalYear !== undefined) form.append('fiscalYear', String(opts.fiscalYear))

  const res = await fetch(`${BASE}/api/parse-nomina`, { method: 'POST', headers: apiKeyHeader(), body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new Error(err.error ?? err.message ?? 'Error al procesar la nómina.')
  }
  return res.json() as Promise<NominaParseResult>
}

async function parseRenta(opts: RentaUploadOptions): Promise<RentaAnualResult> {
  const form = new FormData()
  opts.pdfs.forEach((pdf, i) => form.append(`pdf_${i}`, pdf))
  if (opts.region) form.append('region', opts.region)
  if (opts.age !== undefined) form.append('age', String(opts.age))
  if (opts.civilStatus) form.append('civilStatus', opts.civilStatus)
  if (opts.fiscalYear !== undefined) form.append('fiscalYear', String(opts.fiscalYear))

  const res = await fetch(`${BASE}/api/parse-renta`, { method: 'POST', headers: apiKeyHeader(), body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new Error(err.error ?? err.message ?? 'Error al procesar las nóminas.')
  }
  return res.json() as Promise<RentaAnualResult>
}

export const taxai = {
  calculate: (input: TaxInput) => post<TaxResult>('/api/calculate', input),
  explain: (result: TaxResult, question: string) =>
    post<{ explanation: string }>('/api/explain', { result, question }),
  parseNomina,
  parseRenta,
}
