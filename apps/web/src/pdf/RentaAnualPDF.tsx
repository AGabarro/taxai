/**
 * RentaAnualPDF — annual renta declaration PDF.
 *
 * Mirrors the RentaAnual screen:
 *  1. Hero card (a devolver / a ingresar amount + KPIs)
 *  2. Monthly breakdown table (one row per uploaded payslip)
 *  3. Gastos deducibles section
 *  4. Cálculo del IRPF section
 *  5. Resultado final section
 *
 * All figures come from the actual aggregated annual data — no projections.
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { RentaAnualResult, SpanishRegion } from '@taxai/shared'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtEUR(n: number): string {
  const abs = Math.abs(n)
  const s = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)
  return (n < 0 ? '-' : '') + s + ' EUR'
}

function fmtPct(n: number, decimals = 1): string {
  return (
    new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n) + '%'
  )
}

// ─── Region names ─────────────────────────────────────────────────────────────

const REGION_NAMES: Record<SpanishRegion, string> = {
  andalusia:            'Andalucía',
  aragon:               'Aragón',
  asturias:             'Asturias',
  balearics:            'Islas Baleares',
  canarias:             'Canarias',
  cantabria:            'Cantabria',
  'castilla-la-mancha': 'Castilla-La Mancha',
  'castilla-leon':      'Castilla y León',
  catalonia:            'Cataluña',
  extremadura:          'Extremadura',
  galicia:              'Galicia',
  'la-rioja':           'La Rioja',
  madrid:               'Comunidad de Madrid',
  murcia:               'Región de Murcia',
  navarra:              'Navarra',
  'pais-vasco':         'País Vasco',
  valenciana:           'Comunidad Valenciana',
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  blue:    '#2563EB',
  green:   '#059669',
  amber:   '#D97706',
  gray900: '#111827',
  gray700: '#374151',
  gray600: '#4B5563',
  gray500: '#6B7280',
  gray300: '#D1D5DB',
  gray200: '#E5E7EB',
  gray100: '#F3F4F6',
  gray50:  '#F9FAFB',
  white:   '#FFFFFF',
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.gray700,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    backgroundColor: C.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: C.blue,
    marginBottom: 14,
  },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandBox: {
    width: 22,
    height: 22,
    backgroundColor: C.blue,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: { color: C.white, fontSize: 12, fontFamily: 'Helvetica-Bold' },
  brandName:   { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.gray900 },
  headerSub:   { fontSize: 8, color: C.gray500 },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  headerTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray900 },
  headerDate:  { fontSize: 7.5, color: C.gray500 },

  // Hero
  hero: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  heroLabel:  { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 4, opacity: 0.8 },
  heroAmount: { fontSize: 28, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  heroDesc:   { fontSize: 8, opacity: 0.75, marginBottom: 14 },
  heroChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  heroChipText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  // Section
  section: { marginBottom: 12 },
  sectionHeader: {
    backgroundColor: C.gray100,
    borderLeftWidth: 3,
    borderLeftColor: C.blue,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.gray900, letterSpacing: 0.5 },
  sectionSubtitle: { fontSize: 7, color: C.gray500, marginTop: 1 },

  // Monthly table
  tableCard: {
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: C.gray300,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.gray100,
    borderBottomWidth: 1,
    borderBottomColor: C.gray300,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.gray200,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tableRowLast:  { borderBottomWidth: 0 },
  tableTotalRow: {
    flexDirection: 'row',
    backgroundColor: C.gray100,
    borderTopWidth: 1.5,
    borderTopColor: C.gray300,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  // Column widths (total ≈ page content width)
  colPeriod:     { flex: 2.2, fontSize: 8 },
  colDevengado:  { flex: 1.8, fontSize: 8, textAlign: 'right' },
  colBase:       { flex: 1.8, fontSize: 8, textAlign: 'right' },
  colRetencion:  { flex: 1.8, fontSize: 8, textAlign: 'right' },
  colTipo:       { flex: 1.2, fontSize: 8, textAlign: 'right' },
  colHeaderText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.gray500, letterSpacing: 0.3 },

  // Rows in fiscal sections
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.gray300,
  },
  rowLast:   { borderBottomWidth: 0 },
  rowTotal: {
    borderTopWidth: 1,
    borderTopColor: C.gray300,
    borderBottomWidth: 0,
    marginTop: 2,
    paddingTop: 6,
  },
  rowResult: {
    borderTopWidth: 1.5,
    borderTopColor: C.gray700,
    borderBottomWidth: 0,
    marginTop: 3,
    paddingTop: 6,
  },
  rowLeft:  { flex: 1, paddingRight: 8 },
  rowLabel: { fontSize: 8.5, color: C.gray700 },
  rowHint:  { fontSize: 7, color: C.gray500, marginTop: 1 },
  rowAmount: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'right', minWidth: 100 },

  // Split tiles (state vs regional)
  tileRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.gray300,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: C.gray50,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  tileLabel:  { fontSize: 7, color: C.gray500 },
  tileValue:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.gray900 },
  tileCaption:{ fontSize: 7, color: C.gray500 },

  // Stats footer in resultado section
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.gray300,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: C.gray50,
    borderRadius: 6,
    padding: 8,
    gap: 2,
  },
  statLabel:   { fontSize: 7, color: C.gray500, fontFamily: 'Helvetica-Bold' },
  statValue:   { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.gray900 },
  statCaption: { fontSize: 7, color: C.gray500 },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: C.gray300,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: C.gray500 },
  pageNumber: { fontSize: 7, color: C.gray500 },
})

// ─── Row sub-component ────────────────────────────────────────────────────────

function FiscalRow({
  label,
  hint,
  amount,
  color = C.gray900,
  isTotal = false,
  isResult = false,
  isLast = false,
}: {
  label: string
  hint?: string
  amount: number
  color?: string
  isTotal?: boolean
  isResult?: boolean
  isLast?: boolean
}) {
  const rowStyle = [
    S.row,
    ...(isTotal  ? [S.rowTotal]  : []),
    ...(isResult ? [S.rowResult] : []),
    ...(!isTotal && !isResult && isLast ? [S.rowLast] : []),
  ]
  const labelStyle = [
    S.rowLabel,
    ...(isTotal || isResult ? [{ fontFamily: 'Helvetica-Bold' as const }] : []),
    ...(isResult            ? [{ fontSize: 9 }] : []),
  ]
  return (
    <View style={rowStyle}>
      <View style={S.rowLeft}>
        <Text style={labelStyle}>{label}</Text>
        {hint && <Text style={S.rowHint}>{hint}</Text>}
      </View>
      <Text style={[S.rowAmount, { color }]}>{fmtEUR(amount)}</Text>
    </View>
  )
}

// ─── Main document ────────────────────────────────────────────────────────────

interface RentaAnualPDFProps {
  rentaResult: RentaAnualResult
}

export function RentaAnualPDF({ rentaResult }: RentaAnualPDFProps) {
  const { taxResult, comparison, months, annualGross, annualBaseIRPF, annualRetencionesNomina, annualSS } = rentaResult

  if (!taxResult) return null

  // Derived fiscal values (same logic as RentaAnual.tsx)
  const ssDeductions     = annualSS
  const totalDeductions  = Math.max(0, taxResult.grossSalary - taxResult.rendimientoNetoReducido)
  const trabajoReduction = Math.max(0, totalDeductions - ssDeductions)
  const effectiveRate    = annualGross > 0 ? (taxResult.cuotaLiquidaTOTAL / annualGross) * 100 : 0
  const monthsCount      = months.length
  const regionName       = REGION_NAMES[taxResult.region] ?? taxResult.region

  const comp             = comparison
  const heroAmount       = comp ? Math.abs(comp.difference) : Math.abs(taxResult.resultAmount)
  const resultLabel      =
    comp?.diffType === 'overpaid'   ? 'A DEVOLVER' :
    comp?.diffType === 'underpaid'  ? 'A INGRESAR'  : 'RESULTADO'
  const heroBg           =
    comp?.diffType === 'overpaid'   ? C.blue  :
    comp?.diffType === 'underpaid'  ? C.amber : C.green
  const heroColor        = C.white

  const hasExemptBenefits = annualBaseIRPF > 0 && annualGross > annualBaseIRPF + 0.01

  const generatedAt = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document
      title={`Taxai Renta ${taxResult.fiscalYear} - ${regionName}`}
      author="Taxai"
      subject={`Declaracion de la Renta ${taxResult.fiscalYear}`}
      creator="Taxai"
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View>
            <View style={S.brandRow}>
              <View style={S.brandBox}><Text style={S.brandLetter}>T</Text></View>
              <Text style={S.brandName}>Taxai</Text>
            </View>
            <Text style={S.headerSub}>Calculadora IRPF - Resultado orientativo</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerTitle}>Renta Anual {taxResult.fiscalYear}</Text>
            <Text style={S.headerDate}>{regionName}</Text>
            <Text style={S.headerDate}>Generado el {generatedAt}</Text>
          </View>
        </View>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <View style={[S.hero, { backgroundColor: heroBg }]}>
          <Text style={[S.heroLabel, { color: heroColor }]}>{resultLabel} · Renta {taxResult.fiscalYear}</Text>
          <Text style={[S.heroAmount, { color: heroColor }]}>{fmtEUR(heroAmount)}</Text>
          <Text style={[S.heroDesc, { color: heroColor }]}>
            {comp?.diffType === 'overpaid'
              ? 'Hacienda te devolverá esta cantidad al presentar la declaración'
              : comp?.diffType === 'underpaid'
              ? 'Deberás pagar esta cantidad al presentar la declaración'
              : 'Tu declaración está equilibrada — retenciones y cuota coinciden'}
          </Text>
          <View style={S.heroChips}>
            {[
              { label: `Tipo efectivo ${fmtPct(effectiveRate)}` },
              { label: `${monthsCount} nómina${monthsCount !== 1 ? 's' : ''} procesada${monthsCount !== 1 ? 's' : ''}` },
              { label: `SS pagada ${fmtEUR(ssDeductions)}` },
              ...(comp ? [{ label: `Desviación ${fmtPct(Math.abs(comp.percentageDiff))}` }] : []),
            ].map(({ label }) => (
              <View key={label} style={S.heroChip}>
                <Text style={[S.heroChipText, { color: heroColor }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Monthly breakdown table ──────────────────────────────────────── */}
        {months.length > 0 && (
          <View style={S.tableCard}>
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>RESUMEN MENSUAL</Text>
                <Text style={S.sectionSubtitle}>
                  Importes reales de cada nómina, sin estimaciones
                </Text>
              </View>
            </View>
            {/* Table header */}
            <View style={S.tableHeaderRow}>
              <Text style={[S.colPeriod, S.colHeaderText]}>Período</Text>
              <Text style={[S.colDevengado, S.colHeaderText]}>Total devengado</Text>
              <Text style={[S.colBase, S.colHeaderText]}>Base IRPF</Text>
              <Text style={[S.colRetencion, S.colHeaderText]}>Retención</Text>
              <Text style={[S.colTipo, S.colHeaderText]}>Tipo %</Text>
            </View>
            {/* Data rows */}
            {months.map((m, i) => {
              const rawPct =
                m.retentionPercentage ??
                (m.monthlyRetenciones !== undefined && m.monthlyGross !== undefined && m.monthlyGross > 0
                  ? (m.monthlyRetenciones / m.monthlyGross) * 100
                  : undefined)
              const isLast = i === months.length - 1
              return (
                <View
                  key={i}
                  style={[S.tableRow, ...(isLast ? [S.tableRowLast] : [])]}
                >
                  <Text style={[S.colPeriod, { textTransform: 'capitalize' }]}>
                    {m.period ?? `Nómina ${i + 1}`}
                  </Text>
                  <Text style={[S.colDevengado, { color: C.gray600 }]}>
                    {m.monthlyGross !== undefined ? fmtEUR(m.monthlyGross) : '—'}
                  </Text>
                  <Text style={[S.colBase, { color: C.gray600 }]}>
                    {m.monthlyBaseIRPF !== undefined ? fmtEUR(m.monthlyBaseIRPF) : '—'}
                  </Text>
                  <Text style={[S.colRetencion, { fontFamily: 'Helvetica-Bold', color: C.gray900 }]}>
                    {m.monthlyRetenciones !== undefined ? fmtEUR(m.monthlyRetenciones) : '—'}
                  </Text>
                  <Text style={[S.colTipo, { color: C.gray600 }]}>
                    {rawPct !== undefined ? fmtPct(rawPct) : '—'}
                  </Text>
                </View>
              )
            })}
            {/* Total row */}
            <View style={S.tableTotalRow}>
              <Text style={[S.colPeriod, { fontFamily: 'Helvetica-Bold', color: C.gray900 }]}>Total anual</Text>
              <Text style={[S.colDevengado, { fontFamily: 'Helvetica-Bold', color: C.gray900 }]}>
                {fmtEUR(annualGross)}
              </Text>
              <Text style={[S.colBase, { fontFamily: 'Helvetica-Bold', color: C.gray900 }]}>
                {annualBaseIRPF > 0 ? fmtEUR(annualBaseIRPF) : '—'}
              </Text>
              <Text style={[S.colRetencion, { fontFamily: 'Helvetica-Bold', color: C.gray900 }]}>
                {fmtEUR(annualRetencionesNomina)}
              </Text>
              <Text style={[S.colTipo, { fontFamily: 'Helvetica-Bold', color: C.gray900 }]}>
                {annualGross > 0
                  ? fmtPct((annualRetencionesNomina / annualGross) * 100)
                  : '—'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Gastos deducibles ────────────────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>GASTOS DEDUCIBLES DEL TRABAJO</Text>
            <Text style={S.sectionSubtitle}>
              Importes que reducen tu base imponible antes de calcular el impuesto
            </Text>
          </View>

          {hasExemptBenefits && (
            <View style={[S.row, { backgroundColor: '#EFF6FF' }]}>
              <View style={S.rowLeft}>
                <Text style={[S.rowHint, { color: '#1D4ED8' }]}>
                  Tu nómina incluye conceptos exentos de IRPF (p.ej. tickets restaurante,
                  seguro médico) que reducen la base IRPF respecto al total devengado.
                </Text>
              </View>
            </View>
          )}

          <FiscalRow
            label="Salario bruto sujeto a IRPF"
            hint="El importe anual de tus nóminas sobre el que se calcula el IRPF"
            amount={taxResult.grossSalary}
          />
          {ssDeductions > 0 && (
            <FiscalRow
              label="Cotizaciones a la Seguridad Social"
              hint="Gasto deducible que reduce tu base imponible (Art. 19 LIRPF)"
              amount={ssDeductions}
              color={C.green}
            />
          )}
          {trabajoReduction > 0 && (
            <FiscalRow
              label="Reducción por rendimientos del trabajo"
              hint="Reducción Art. 20 LIRPF — hasta 7.302 EUR para rentas bajas en 2025"
              amount={trabajoReduction}
              color={C.green}
            />
          )}
          <FiscalRow
            label="Total gastos deducibles"
            amount={totalDeductions}
            color={C.green}
            isTotal
          />
          <FiscalRow
            label="Rendimiento neto reducido"
            hint="Base sobre la que Hacienda calculará el impuesto"
            amount={taxResult.rendimientoNetoReducido}
            isTotal
            isLast
          />
        </View>

        {/* ── Cálculo del IRPF ─────────────────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>CÁLCULO DEL IRPF</Text>
            <Text style={S.sectionSubtitle}>
              Aplicación de tramos progresivos a tu base imponible
            </Text>
          </View>

          <FiscalRow
            label="Base imponible general"
            hint="El rendimiento neto sobre el que se aplican los tramos del IRPF"
            amount={taxResult.baseImponibleGeneral}
          />
          <FiscalRow
            label="Mínimo personal y familiar"
            hint="La parte de tu renta que no tributa (Art. 57–61 LIRPF)"
            amount={taxResult.minimumPersonalFamiliar}
            color={C.green}
          />
          <FiscalRow
            label="Cuota íntegra total"
            hint="Tramos estatal + autonómico aplicados a la base"
            amount={taxResult.cuotaIntegraTOTAL}
          />
          <FiscalRow
            label="Cuota líquida — impuesto real"
            hint="Cuota íntegra menos el mínimo personal y deducciones aplicables"
            amount={taxResult.cuotaLiquidaTOTAL}
            isTotal
            isLast
          />

          {/* State vs regional split */}
          <View style={S.tileRow}>
            <View style={S.tile}>
              <Text style={S.tileLabel}>Cuota estatal</Text>
              <Text style={S.tileValue}>{fmtEUR(taxResult.cuotaLiquidaEstatal)}</Text>
              <Text style={S.tileCaption}>Tramos del Estado</Text>
            </View>
            <View style={S.tile}>
              <Text style={S.tileLabel}>Cuota autonómica</Text>
              <Text style={S.tileValue}>{fmtEUR(taxResult.cuotaLiquidaAutonomica)}</Text>
              <Text style={S.tileCaption}>Tramos de {regionName}</Text>
            </View>
          </View>
        </View>

        {/* ── Resultado final ──────────────────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>RESULTADO DE LA DECLARACIÓN</Text>
            <Text style={S.sectionSubtitle}>
              Comparación entre retenciones pagadas y cuota calculada
            </Text>
          </View>

          <FiscalRow
            label="Impuesto que te corresponde (cuota líquida)"
            hint="El IRPF que legalmente debes pagar por tu renta de este año"
            amount={taxResult.cuotaLiquidaTOTAL}
          />
          <FiscalRow
            label="Retenciones ya pagadas durante el año"
            hint="Lo que tu empresa ingresó a Hacienda con cada nómina"
            amount={annualRetencionesNomina}
            color={C.blue}
          />
          {comp && (
            <FiscalRow
              label={
                comp.diffType === 'overpaid'  ? 'A devolver — Hacienda te debe'   :
                comp.diffType === 'underpaid' ? 'A ingresar — debes a Hacienda'   :
                'Resultado equilibrado'
              }
              hint={
                comp.diffType === 'overpaid'
                  ? `Has pagado ${fmtEUR(Math.abs(comp.difference))} más de lo que te corresponde`
                  : comp.diffType === 'underpaid'
                  ? `Deberás abonar ${fmtEUR(Math.abs(comp.difference))} al presentar la declaración`
                  : 'Las retenciones cubren exactamente el impuesto calculado'
              }
              amount={Math.abs(comp.difference)}
              color={comp.diffType === 'overpaid' ? C.blue : comp.diffType === 'underpaid' ? C.amber : C.green}
              isResult
            />
          )}

          {/* Stats footer */}
          <View style={S.statsRow}>
            {[
              {
                label: 'Tipo efectivo IRPF',
                value: fmtPct(effectiveRate),
                caption: 'Sobre salario bruto',
              },
              {
                label: 'Cuota mensual media',
                value: fmtEUR(taxResult.cuotaLiquidaTOTAL / 12),
                caption: 'Retención mensual ideal',
              },
              {
                label: 'Retención media real',
                value: monthsCount > 0
                  ? fmtEUR(annualRetencionesNomina / monthsCount)
                  : '—',
                caption: `Media de ${monthsCount} nóminas`,
              },
            ].map(({ label, value, caption }) => (
              <View key={label} style={S.statBox}>
                <Text style={S.statLabel}>{label}</Text>
                <Text style={S.statValue}>{value}</Text>
                <Text style={S.statCaption}>{caption}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            Taxai · Resultado orientativo · Consulta a un asesor fiscal para tu declaración oficial
          </Text>
          <Text
            style={S.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  )
}
