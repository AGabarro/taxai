import type { TaxInput, TaxResult, NominaParseResult, SpanishRegion, CivilStatus } from '@taxai/shared'

// Empty string = relative URLs (same origin). Works for both production (Fastify serves everything)
// and dev (Vite proxies /api/* to localhost:3000 via vite.config.ts).
const BASE = import.meta.env.VITE_API_BASE ?? ''

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

async function parseNomina(opts: NominaUploadOptions): Promise<NominaParseResult> {
  const form = new FormData()
  form.append('pdf', opts.pdf)
  if (opts.region) form.append('region', opts.region)
  if (opts.age !== undefined) form.append('age', String(opts.age))
  if (opts.civilStatus) form.append('civilStatus', opts.civilStatus)
  if (opts.fiscalYear !== undefined) form.append('fiscalYear', String(opts.fiscalYear))

  const res = await fetch(`${BASE}/api/parse-nomina`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new Error(err.error ?? err.message ?? 'Error al procesar la nómina.')
  }
  return res.json() as Promise<NominaParseResult>
}

export const taxai = {
  calculate: (input: TaxInput) => post<TaxResult>('/api/calculate', input),
  extract: (message: string) => post<Partial<TaxInput>>('/api/extract', { message }),
  explain: (result: TaxResult, question: string) =>
    post<{ explanation: string }>('/api/explain', { result, question }),
  parseNomina,
}
