import type { TaxInput, TaxResult } from '../types'

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Error en el servidor. Inténtalo de nuevo.')
  }
  return res.json() as Promise<T>
}

export const taxai = {
  calculate: (input: TaxInput) => post<TaxResult>('/api/calculate', input),
  extract: (message: string) => post<Partial<TaxInput>>('/api/extract', { message }),
  explain: (result: TaxResult, question: string) =>
    post<{ explanation: string }>('/api/explain', { result, question }),
}
