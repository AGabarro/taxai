// @vitest-environment node
/**
 * Integration tests: render TaxResultPDF to a real PDF buffer, then extract
 * text with pdf-parse and assert that all key values from TaxResult appear.
 *
 * Why pdf-parse: @react-pdf/renderer compresses content streams (zlib), so
 * raw byte searches are unreliable. pdf-parse uses pdf.js to decompress and
 * correctly decode character maps, giving us the actual visible text.
 *
 * Note: @vitest-environment node is required — renderToBuffer() is Node-only.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
// pdf-parse is a CommonJS module; use createRequire for clean ESM interop
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js')

import { TaxResultPDF } from '../src/pdf/TaxResultPDF'
import { MOCK_RESULT } from '../src/mocks/taxResult'
import type { TaxResult } from '@taxai/shared'

/**
 * renderToBuffer expects ReactElement<DocumentProps>, but TaxResultPDF wraps
 * a Document internally — the runtime shape is correct. Cast once here.
 */
function renderDoc(result: TaxResult): Promise<Buffer> {
  return renderToBuffer(
    React.createElement(TaxResultPDF, { result }) as unknown as React.ReactElement<DocumentProps>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a number with the same es-ES conventions used in the PDF. */
function fmtNum(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n))
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

describe('TaxResultPDF — integration (renders to real PDF bytes)', () => {
  let buf: Buffer
  let text: string

  beforeAll(async () => {
    buf  = await renderDoc(MOCK_RESULT)
    const parsed = await pdfParse(buf)
    text = parsed.text
  }, 30_000)

  // ── PDF validity ──────────────────────────────────────────────────────────

  it('produces a non-empty buffer', () => {
    expect(buf.byteLength).toBeGreaterThan(1000)
  })

  it('starts with %PDF magic bytes', () => {
    expect(buf.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('ends with %%EOF', () => {
    const tail = buf.toString('ascii', buf.byteLength - 10).trim()
    expect(tail.endsWith('%%EOF')).toBe(true)
  })

  // ── Branding and metadata ─────────────────────────────────────────────────

  it('contains Taxai branding', () => {
    expect(text).toContain('Taxai')
  })

  it('contains fiscal year', () => {
    expect(text).toContain(String(MOCK_RESULT.fiscalYear))
  })

  it('contains region name', () => {
    // "Comunidad de Madrid" — region is resolved to a human name in buildMeta
    expect(text).toContain('Madrid')
  })

  // ── Numeric amounts from TaxResult ───────────────────────────────────────
  // These confirm every figure shown on screen is embedded in the PDF.

  it('contains gross salary', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.grossSalary))
  })

  it('contains rendimientoNetoReducido', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.rendimientoNetoReducido))
  })

  it('contains baseImponibleGeneral', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.baseImponibleGeneral))
  })

  it('contains minimumPersonalFamiliar', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.minimumPersonalFamiliar))
  })

  it('contains cuotaIntegraEstatal', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.cuotaIntegraEstatal))
  })

  it('contains cuotaIntegraAutonomica', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.cuotaIntegraAutonomica))
  })

  it('contains cuotaIntegraTOTAL', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.cuotaIntegraTOTAL))
  })

  it('contains cuotaLiquidaEstatal', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.cuotaLiquidaEstatal))
  })

  it('contains cuotaLiquidaAutonomica', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.cuotaLiquidaAutonomica))
  })

  it('contains cuotaLiquidaTOTAL', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.cuotaLiquidaTOTAL))
  })

  it('contains retenciones', () => {
    expect(text).toContain(fmtNum(MOCK_RESULT.retenciones))
  })

  it('contains result amount (absolute value)', () => {
    expect(text).toContain(fmtNum(Math.abs(MOCK_RESULT.resultAmount)))
  })

  // ── Section headings ──────────────────────────────────────────────────────

  it('contains BASE IMPONIBLE GENERAL heading', () => {
    expect(text.toUpperCase()).toContain('BASE IMPONIBLE GENERAL')
  })

  it('contains CUOTA INTEGRA heading', () => {
    // Accent on Í may vary with font encoding; match core word
    expect(text.toUpperCase()).toContain('CUOTA')
  })

  it('contains RESULTADO FINAL heading', () => {
    expect(text.toUpperCase()).toContain('RESULTADO FINAL')
  })

  it('contains PASOS DEL CALCULO heading', () => {
    expect(text.toUpperCase()).toContain('PASOS')
  })

  // ── Variant result types ──────────────────────────────────────────────────

  it('renders a_ingresar result and produces valid PDF', async () => {
    const ingresarResult: TaxResult = {
      ...MOCK_RESULT,
      resultType: 'a_ingresar',
      resultAmount: 800,
      retenciones: 1303,
    }
    const b = await renderDoc(ingresarResult)
    expect(b.toString('ascii', 0, 4)).toBe('%PDF')
    const { text: t } = await pdfParse(b)
    expect(t).toContain('Taxai')
  })

  it('renders cero result and produces valid PDF', async () => {
    const ceroResult: TaxResult = {
      ...MOCK_RESULT,
      resultType: 'cero',
      resultAmount: 0,
      retenciones: MOCK_RESULT.cuotaLiquidaTOTAL,
    }
    const b = await renderDoc(ceroResult)
    expect(b.toString('ascii', 0, 4)).toBe('%PDF')
  })

  // ── Full result (all conditional sections) ────────────────────────────────

  it('renders complete result with ahorro, pension, rental, regional deductions', async () => {
    const fullResult: TaxResult = {
      ...MOCK_RESULT,
      baseImponibleAhorro:           5000,
      cuotaIntegraAhorroEstatal:      950,
      cuotaIntegraAhorroAutonomica:   900,
      cuotaLiquidaAhorroEstatal:      950,
      cuotaLiquidaAhorroAutonomica:   900,
      reduccionPension:              1500,
      netRentalIncome:               3600,
      deduccionesAutonomicas:         300,
    }
    const b = await renderDoc(fullResult)
    expect(b.toString('ascii', 0, 4)).toBe('%PDF')
    // A full result has more sections so the file should be larger
    expect(b.byteLength).toBeGreaterThan(buf.byteLength)

    const { text: fullText } = await pdfParse(b)
    // Additional section headings for the conditional sections
    expect(fullText.toUpperCase()).toContain('BASE DEL AHORRO')
  })
})
