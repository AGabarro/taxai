/**
 * NominaMensualPDF — monthly payslip analysis PDF.
 *
 * Mirrors the NominaUpload screen:
 *  1. Comparison hero card (employer vs Taxai vs difference)
 *  2. Payslip detail breakdown (devengos, deducciones, base IRPF)
 *  3. Annual projection summary
 *
 * All figures use the actual monthly data from the parsed nómina — never
 * the annualised TaxResult figures (those appear only in the projection box).
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { NominaParseResult } from '@taxai/shared'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtEUR(n: number): string {
  const abs = Math.abs(n)
  const s = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)
  return (n < 0 ? '-' : '') + s + ' EUR'
}

function fmtPct(n: number): string {
  return (
    new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(n) + '%'
  )
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  blue:    '#2563EB',
  green:   '#059669',
  amber:   '#D97706',
  gray900: '#111827',
  gray700: '#374151',
  gray500: '#6B7280',
  gray300: '#D1D5DB',
  gray100: '#F3F4F6',
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  headerDate:  { fontSize: 7.5, color: C.gray500, textTransform: 'capitalize' },

  // Hero
  hero: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  heroStatus: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 4,
    opacity: 0.85,
  },
  heroTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  heroSub:   { fontSize: 8, opacity: 0.75, marginBottom: 12 },
  heroKpis:  { flexDirection: 'row', gap: 8, width: '100%' },
  heroKpi: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  heroKpiLabel: { fontSize: 7, opacity: 0.7 },
  heroKpiValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  heroNote:     { fontSize: 7, opacity: 0.6, textAlign: 'center', marginTop: 6 },

  // Section card
  sectionCard: {
    marginBottom: 12,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: C.gray300,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: C.gray100,
    borderLeftWidth: 3,
    borderLeftColor: C.blue,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  sectionTitle:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.gray900, letterSpacing: 0.5 },
  sectionSubtitle: { fontSize: 7, color: C.gray500, marginTop: 1, textTransform: 'capitalize' },

  // Sub-section header inside a card
  subHeader: {
    backgroundColor: '#FAFAFA',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.gray300,
  },
  subHeaderText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.gray500,
    letterSpacing: 0.5,
  },

  // Rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.gray300,
  },
  rowLast:     { borderBottomWidth: 0 },
  rowIndented: { paddingLeft: 20 },
  rowLeft:     { flex: 1, paddingRight: 8 },
  rowLabel:    { fontSize: 8.5, color: C.gray700 },
  rowLabelBold:{ fontSize: 8.5, color: C.gray900, fontFamily: 'Helvetica-Bold' },
  rowLabelSub: { fontSize: 8, color: C.gray500 },
  rowHint:     { fontSize: 7, color: C.gray500, marginTop: 1 },
  rowAmount:   { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'right', minWidth: 90 },
  rowAmountSub:{ fontSize: 8, textAlign: 'right', minWidth: 90, color: C.gray500 },

  // Projection info box
  projBox: {
    backgroundColor: C.gray100,
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: C.gray300,
  },
  projTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.gray500,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  projRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 2 },
  projItem: { fontSize: 8, color: C.gray700 },
  projBold: { fontSize: 8, color: C.gray900, fontFamily: 'Helvetica-Bold' },
  projNote: { fontSize: 7, color: C.gray500, marginTop: 4 },

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

// ─── Component ────────────────────────────────────────────────────────────────

interface NominaMensualPDFProps {
  parseResult: NominaParseResult
}

export function NominaMensualPDF({ parseResult }: NominaMensualPDFProps) {
  const { nomina, comparison, taxResult, annualGross, annualRetencionesNomina } = parseResult

  const nPayments        = nomina.numberOfPayments ?? 12
  const monthlyCalculated = taxResult ? taxResult.cuotaLiquidaTOTAL / nPayments : undefined
  const monthlyApplied   = nomina.monthlyRetenciones
  const monthlyDiff =
    monthlyApplied !== undefined && monthlyCalculated !== undefined
      ? Math.round((monthlyApplied - monthlyCalculated) * 100) / 100
      : undefined

  // Hero colours
  const heroBg =
    comparison?.diffType === 'correct'  ? C.green :
    comparison?.diffType === 'overpaid' ? C.blue  : C.amber
  const heroColor = C.white

  const heroStatus =
    comparison?.diffType === 'correct'  ? 'RETENCIÓN CORRECTA'    :
    comparison?.diffType === 'overpaid' ? 'RETENCIÓN EXCESIVA'     :
    comparison?.diffType === 'underpaid'? 'RETENCIÓN INSUFICIENTE' :
    'ANÁLISIS DE NÓMINA'

  const heroTitle =
    comparison?.diffType === 'correct'   ? 'Tu retención es correcta'        :
    comparison?.diffType === 'overpaid'  ? 'Te retienen de más este mes'      :
    comparison?.diffType === 'underpaid' ? 'Te retienen de menos este mes'    :
    'Análisis de nómina mensual'

  // SS breakdown
  const ssTotalFromBreakdown =
    (nomina.monthlySS_CC         ?? 0) +
    (nomina.monthlySS_MEI        ?? 0) +
    (nomina.monthlySS_unemployment ?? 0) +
    (nomina.monthlySS_vocational  ?? 0)
  const ssTotal =
    nomina.monthlySSEmployee !== undefined ? nomina.monthlySSEmployee :
    ssTotalFromBreakdown > 0              ? ssTotalFromBreakdown      : undefined
  const hasSsBreakdown =
    nomina.monthlySS_CC !== undefined ||
    nomina.monthlySS_MEI !== undefined ||
    nomina.monthlySS_unemployment !== undefined ||
    nomina.monthlySS_vocational !== undefined

  // Devengos detail
  const hasDevengosDetail =
    nomina.monthlySalarioBase !== undefined ||
    nomina.monthlyRetribucionEspecie !== undefined ||
    nomina.monthlyDietas !== undefined

  const complementos: number | undefined = (() => {
    if (!hasDevengosDetail || nomina.monthlyGross === undefined) return undefined
    const known =
      (nomina.monthlySalarioBase          ?? 0) +
      (nomina.monthlyRetribucionEspecie   ?? 0) +
      (nomina.monthlyDietas               ?? 0)
    const c = nomina.monthlyGross - known
    return c > 0.01 ? c : undefined
  })()

  const generatedAt = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Document
      title={`Taxai Nomina ${nomina.period ?? 'Mensual'}`}
      author="Taxai"
      subject="Análisis retención IRPF mensual"
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
            <Text style={S.headerTitle}>Análisis Nómina Mensual</Text>
            {nomina.period && (
              <Text style={S.headerDate}>{nomina.period}</Text>
            )}
            <Text style={[S.headerDate, { textTransform: 'none' as const }]}>
              Generado el {generatedAt}
            </Text>
          </View>
        </View>

        {/* ── Hero comparison card ─────────────────────────────────────── */}
        {comparison !== undefined && monthlyCalculated !== undefined && (
          <View style={[S.hero, { backgroundColor: heroBg }]}>
            <Text style={[S.heroStatus, { color: heroColor }]}>{heroStatus}</Text>
            <Text style={[S.heroTitle, { color: heroColor }]}>{heroTitle}</Text>
            {nomina.period && (
              <Text style={[S.heroSub, { color: heroColor }]}>
                Período: {nomina.period} · Nómina mensual
              </Text>
            )}
            <View style={S.heroKpis}>
              {[
                {
                  label: 'Empresa aplica',
                  value: monthlyApplied !== undefined ? fmtEUR(monthlyApplied) : '—',
                },
                {
                  label: 'Taxai calcula',
                  value: fmtEUR(monthlyCalculated),
                },
                {
                  label: 'Diferencia',
                  value: monthlyDiff !== undefined
                    ? (monthlyDiff >= 0 ? '+' : '') + fmtEUR(monthlyDiff)
                    : '—',
                },
              ].map(({ label, value }) => (
                <View key={label} style={S.heroKpi}>
                  <Text style={[S.heroKpiLabel, { color: heroColor }]}>{label}</Text>
                  <Text style={[S.heroKpiValue, { color: heroColor }]}>{value}</Text>
                </View>
              ))}
            </View>
            {comparison.percentageDiff > 0 && (
              <Text style={[S.heroNote, { color: heroColor }]}>
                Desviación {fmtPct(Math.abs(comparison.percentageDiff))}
              </Text>
            )}
          </View>
        )}

        {/* ── Payslip detail ───────────────────────────────────────────── */}
        {nomina.monthlyGross !== undefined && (
          <View style={S.sectionCard}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>DESGLOSE DE NÓMINA</Text>
              {nomina.period && (
                <Text style={S.sectionSubtitle}>{nomina.period}</Text>
              )}
            </View>

            {/* ── DEVENGOS ─────────────────────────────────────────────── */}
            <View style={S.subHeader}>
              <Text style={S.subHeaderText}>DEVENGOS (+)</Text>
            </View>

            {hasDevengosDetail && nomina.monthlySalarioBase !== undefined && (
              <View style={S.row}>
                <View style={S.rowLeft}>
                  <Text style={S.rowLabel}>Salario base</Text>
                  <Text style={S.rowHint}>Retribución salarial fija</Text>
                </View>
                <Text style={[S.rowAmount, { color: C.gray900 }]}>
                  {fmtEUR(nomina.monthlySalarioBase)}
                </Text>
              </View>
            )}

            {nomina.monthlyRetribucionEspecie !== undefined && (
              <View style={S.row}>
                <View style={S.rowLeft}>
                  <Text style={S.rowLabel}>Retribución en especie</Text>
                  <Text style={S.rowHint}>Seguro médico, coche empresa… Exenta IRPF (parcial)</Text>
                </View>
                <Text style={[S.rowAmount, { color: C.gray900 }]}>
                  {fmtEUR(nomina.monthlyRetribucionEspecie)}
                </Text>
              </View>
            )}

            {nomina.monthlyDietas !== undefined && (
              <View style={S.row}>
                <View style={S.rowLeft}>
                  <Text style={S.rowLabel}>Dietas y gastos de viaje</Text>
                  <Text style={S.rowHint}>Hasta los límites legales, no tributan</Text>
                </View>
                <Text style={[S.rowAmount, { color: C.gray900 }]}>
                  {fmtEUR(nomina.monthlyDietas)}
                </Text>
              </View>
            )}

            {complementos !== undefined && (
              <View style={S.row}>
                <View style={S.rowLeft}>
                  <Text style={S.rowLabel}>Complementos y otros conceptos</Text>
                  <Text style={S.rowHint}>Antigüedad, plus convenio, horas extra…</Text>
                </View>
                <Text style={[S.rowAmount, { color: C.gray900 }]}>
                  {fmtEUR(complementos)}
                </Text>
              </View>
            )}

            <View style={S.row}>
              <View style={S.rowLeft}>
                <Text style={S.rowLabelBold}>Total devengado</Text>
                <Text style={S.rowHint}>Bruto percibido este mes</Text>
              </View>
              <Text style={[S.rowAmount, { color: C.gray900 }]}>
                {fmtEUR(nomina.monthlyGross)}
              </Text>
            </View>

            {/* ── DEDUCCIONES ──────────────────────────────────────────── */}
            <View style={S.subHeader}>
              <Text style={S.subHeaderText}>DEDUCCIONES (−)</Text>
            </View>

            {ssTotal !== undefined && (
              <>
                <View style={S.row}>
                  <View style={S.rowLeft}>
                    <Text style={S.rowLabel}>Seguridad Social (empleado)</Text>
                    <Text style={S.rowHint}>Deducible: reduce la base imponible (Art. 19 LIRPF)</Text>
                  </View>
                  <Text style={[S.rowAmount, { color: C.green }]}>{fmtEUR(ssTotal)}</Text>
                </View>
                {hasSsBreakdown && (
                  <>
                    {nomina.monthlySS_CC !== undefined && (
                      <View style={[S.row, S.rowIndented]}>
                        <View style={S.rowLeft}>
                          <Text style={S.rowLabelSub}>└ Contingencias comunes</Text>
                        </View>
                        <Text style={S.rowAmountSub}>{fmtEUR(nomina.monthlySS_CC)}</Text>
                      </View>
                    )}
                    {nomina.monthlySS_MEI !== undefined && (
                      <View style={[S.row, S.rowIndented]}>
                        <View style={S.rowLeft}>
                          <Text style={S.rowLabelSub}>└ MEI</Text>
                        </View>
                        <Text style={S.rowAmountSub}>{fmtEUR(nomina.monthlySS_MEI)}</Text>
                      </View>
                    )}
                    {nomina.monthlySS_unemployment !== undefined && (
                      <View style={[S.row, S.rowIndented]}>
                        <View style={S.rowLeft}>
                          <Text style={S.rowLabelSub}>└ Desempleo</Text>
                        </View>
                        <Text style={S.rowAmountSub}>{fmtEUR(nomina.monthlySS_unemployment)}</Text>
                      </View>
                    )}
                    {nomina.monthlySS_vocational !== undefined && (
                      <View style={[S.row, S.rowIndented]}>
                        <View style={S.rowLeft}>
                          <Text style={S.rowLabelSub}>└ Formación profesional</Text>
                        </View>
                        <Text style={S.rowAmountSub}>{fmtEUR(nomina.monthlySS_vocational)}</Text>
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            {nomina.monthlyRetenciones !== undefined && (
              <View style={nomina.monthlyBaseIRPF === undefined ? [S.row, S.rowLast] : S.row}>
                <View style={S.rowLeft}>
                  <Text style={S.rowLabel}>Retención IRPF</Text>
                  <Text style={S.rowHint}>
                    {nomina.retentionPercentage !== undefined
                      ? `Tipo aplicado: ${fmtPct(nomina.retentionPercentage)}`
                      : 'Pago a cuenta del IRPF anual'}
                  </Text>
                </View>
                <Text style={[S.rowAmount, { color: C.amber }]}>
                  {fmtEUR(nomina.monthlyRetenciones)}
                </Text>
              </View>
            )}

            {/* ── BASE IRPF ────────────────────────────────────────────── */}
            {nomina.monthlyBaseIRPF !== undefined && (
              <>
                <View style={S.subHeader}>
                  <Text style={S.subHeaderText}>BASE IRPF (=)</Text>
                </View>
                <View style={[S.row, S.rowLast]}>
                  <View style={S.rowLeft}>
                    <Text style={S.rowLabel}>Base de retención IRPF</Text>
                    <Text style={S.rowHint}>
                      Sobre este importe calcula tu empresa la retención mensual
                    </Text>
                  </View>
                  <Text style={[S.rowAmount, { color: C.blue }]}>
                    {fmtEUR(nomina.monthlyBaseIRPF)}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Annual projection summary ────────────────────────────────── */}
        {annualGross > 0 && (
          <View style={S.projBox}>
            <Text style={S.projTitle}>PROYECCIÓN ANUAL · SOLO ORIENTATIVO</Text>
            <View style={S.projRow}>
              <Text style={S.projItem}>
                Bruto anual:{' '}
                <Text style={S.projBold}>{fmtEUR(annualGross)}</Text>
                {'  '}({nPayments} pagas)
              </Text>
              {annualRetencionesNomina > 0 && (
                <Text style={S.projItem}>
                  Retención anual estimada:{' '}
                  <Text style={S.projBold}>{fmtEUR(annualRetencionesNomina)}</Text>
                </Text>
              )}
              {taxResult && (
                <Text style={S.projItem}>
                  Cuota IRPF calculada:{' '}
                  <Text style={S.projBold}>{fmtEUR(taxResult.cuotaLiquidaTOTAL)}</Text>
                </Text>
              )}
            </View>
            <Text style={S.projNote}>
              Basado en repetir este mes {nPayments} veces. El resultado real
              dependerá de tu situación anual completa.
            </Text>
          </View>
        )}

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
