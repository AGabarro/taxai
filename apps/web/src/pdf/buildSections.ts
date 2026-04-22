/**
 * buildSections — pure data transform: TaxResult → ordered PDF sections.
 *
 * This is the single place to add, remove, or reorder content that appears
 * in the downloaded PDF. Each entry drives both the section heading and its
 * rows; the PDF renderer just maps over them without any conditional logic.
 *
 * Adaptability contract:
 *   • Add a new TaxResult field  → add a PdfRow to the relevant section.
 *   • Add a new section          → push a PdfSection to the `sections` array.
 *   • Conditional content        → use `if (field > 0)` here, not in the renderer.
 */

import type { TaxResult, SpanishRegion } from '@taxai/shared'

// ─── Public types ─────────────────────────────────────────────────────────────

export type RowStyle = 'normal' | 'accent' | 'saving' | 'total' | 'result'

export interface PdfRow {
  label: string
  hint?: string
  amount: number
  /** Controls colour in the rendered PDF */
  style: RowStyle
}

export interface PdfSection {
  /** Unique key — used as React key and for test assertions */
  id: string
  title: string
  rows: PdfRow[]
}

export interface PdfMeta {
  fiscalYear: number
  regionName: string
  generatedAt: string   // formatted date string
  resultType: TaxResult['resultType']
  resultAmount: number
  effectiveRate: number // percentage, e.g. 6.0
  cuotaLiquidaTOTAL: number
  retenciones: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REGION_NAMES: Record<SpanishRegion, string> = {
  andalusia:           'Andalucía',
  aragon:              'Aragón',
  asturias:            'Asturias',
  balearics:           'Islas Baleares',
  canarias:            'Canarias',
  cantabria:           'Cantabria',
  'castilla-la-mancha':'Castilla-La Mancha',
  'castilla-leon':     'Castilla y León',
  catalonia:           'Cataluña',
  extremadura:         'Extremadura',
  galicia:             'Galicia',
  'la-rioja':          'La Rioja',
  madrid:              'Comunidad de Madrid',
  murcia:              'Región de Murcia',
  navarra:             'Navarra',
  'pais-vasco':        'País Vasco',
  valenciana:          'Comunidad Valenciana',
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export function buildMeta(result: TaxResult): PdfMeta {
  const effectiveRate = result.grossSalary > 0
    ? (result.cuotaLiquidaTOTAL / result.grossSalary) * 100
    : 0

  return {
    fiscalYear:        result.fiscalYear,
    regionName:        REGION_NAMES[result.region],
    generatedAt:       new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    resultType:        result.resultType,
    resultAmount:      result.resultAmount,
    effectiveRate,
    cuotaLiquidaTOTAL: result.cuotaLiquidaTOTAL,
    retenciones:       result.retenciones,
  }
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export function buildSections(result: TaxResult): PdfSection[] {
  const sections: PdfSection[] = []

  // ── 1. Base Imponible General ────────────────────────────────────────────
  {
    const rows: PdfRow[] = [
      {
        label: 'Salario bruto',
        hint:  'Rendimiento íntegro del trabajo',
        amount: result.grossSalary,
        style: 'normal',
      },
      {
        label: 'Rendimiento neto reducido',
        hint:  'Tras deducir SS y reducción por rendimientos del trabajo',
        amount: result.rendimientoNetoReducido,
        style: 'normal',
      },
    ]

    if (result.netRentalIncome > 0) {
      rows.push({
        label: 'Rendimientos capital inmobiliario',
        hint:  'Ingresos alquiler netos + renta imputada',
        amount: result.netRentalIncome,
        style: 'normal',
      })
    }

    if (result.reduccionPension > 0) {
      rows.push({
        label: 'Reducción plan de pensiones',
        hint:  'Art. 51 LIRPF · máx. 1.500 EUR',
        amount: -result.reduccionPension,
        style: 'saving',
      })
    }

    rows.push(
      {
        label: 'Base imponible general',
        hint:  'Base sobre la que se aplican los tramos progresivos',
        amount: result.baseImponibleGeneral,
        style: 'accent',
      },
      {
        label: 'Mínimo personal y familiar',
        hint:  'Exención base — Art. 57–61 LIRPF',
        amount: result.minimumPersonalFamiliar,
        style: 'saving',
      },
    )

    sections.push({ id: 'base-general', title: 'Base Imponible General', rows })
  }

  // ── 2. Base del Ahorro (conditional) ────────────────────────────────────
  if (result.baseImponibleAhorro > 0) {
    sections.push({
      id: 'base-ahorro',
      title: 'Base del Ahorro',
      rows: [
        {
          label: 'Base imponible del ahorro',
          hint:  'Tramos fijos: 19% · 21% · 23% · 26% · 28%',
          amount: result.baseImponibleAhorro,
          style: 'accent',
        },
      ],
    })
  }

  // ── 3. Cuota Íntegra ─────────────────────────────────────────────────────
  {
    const rows: PdfRow[] = [
      {
        label: 'Cuota íntegra estatal',
        hint:  'Tarifa del Estado aplicada a la base general',
        amount: result.cuotaIntegraEstatal,
        style: 'normal',
      },
      {
        label: 'Cuota íntegra autonómica',
        hint:  `Tarifa de ${REGION_NAMES[result.region]} aplicada a la base general`,
        amount: result.cuotaIntegraAutonomica,
        style: 'normal',
      },
    ]

    if (result.baseImponibleAhorro > 0) {
      rows.push(
        {
          label: 'Cuota íntegra ahorro (estatal)',
          amount: result.cuotaIntegraAhorroEstatal,
          style: 'normal',
        },
        {
          label: 'Cuota íntegra ahorro (autonómica)',
          amount: result.cuotaIntegraAhorroAutonomica,
          style: 'normal',
        },
      )
    }

    rows.push({
      label: 'Cuota íntegra total',
      amount: result.cuotaIntegraTOTAL,
      style: 'total',
    })

    sections.push({ id: 'cuota-integra', title: 'Cuota Íntegra', rows })
  }

  // ── 4. Cuota Líquida ─────────────────────────────────────────────────────
  {
    const rows: PdfRow[] = [
      {
        label: 'Cuota líquida estatal',
        hint:  'Tras aplicar mínimo personal sobre tarifa estatal',
        amount: result.cuotaLiquidaEstatal,
        style: 'normal',
      },
      {
        label: 'Cuota líquida autonómica',
        hint:  'Tras aplicar mínimo personal sobre tarifa autonómica',
        amount: result.cuotaLiquidaAutonomica,
        style: 'normal',
      },
    ]

    if (result.baseImponibleAhorro > 0) {
      rows.push(
        {
          label: 'Cuota líquida ahorro (estatal)',
          amount: result.cuotaLiquidaAhorroEstatal,
          style: 'normal',
        },
        {
          label: 'Cuota líquida ahorro (autonómica)',
          amount: result.cuotaLiquidaAhorroAutonomica,
          style: 'normal',
        },
      )
    }

    if (result.deduccionesAutonomicas > 0) {
      rows.push({
        label: 'Deducciones autonómicas',
        amount: -result.deduccionesAutonomicas,
        style: 'saving',
      })
    }

    rows.push({
      label: 'Cuota líquida total',
      hint:  'El IRPF que realmente te corresponde pagar este año',
      amount: result.cuotaLiquidaTOTAL,
      style: 'accent',
    })

    sections.push({ id: 'cuota-liquida', title: 'Cuota Líquida', rows })
  }

  // ── 5. Resultado Final ───────────────────────────────────────────────────
  {
    const resultLabel =
      result.resultType === 'a_devolver' ? 'A devolver'
      : result.resultType === 'cero'     ? 'Resultado cero'
      :                                    'A ingresar'

    sections.push({
      id: 'resultado',
      title: 'Resultado Final',
      rows: [
        {
          label: 'Cuota líquida total',
          hint:  'Lo que legalmente debes al fisco',
          amount: result.cuotaLiquidaTOTAL,
          style: 'normal',
        },
        {
          label: 'Retenciones a cuenta',
          hint:  'Ya ingresado por tu empresa a Hacienda',
          amount: result.retenciones,
          style: 'normal',
        },
        {
          label: resultLabel,
          amount: result.resultAmount,
          style: 'result',
        },
      ],
    })
  }

  // ── 6. Pasos del cálculo (waterfall) ─────────────────────────────────────
  if (result.waterfallSteps.length > 0) {
    sections.push({
      id: 'waterfall',
      title: 'Pasos del Cálculo',
      rows: result.waterfallSteps.map(step => ({
        label:  step.label,
        amount: step.amount,
        style:  (step.amount < 0 ? 'saving' : 'normal') as RowStyle,
        ...(step.bracketRate !== undefined
          ? { hint: `Tipo aplicado: ${(step.bracketRate * 100).toFixed(1)}%` }
          : {}),
      })),
    })
  }

  return sections
}
