/**
 * TaxResultPDF — @react-pdf/renderer document for the IRPF result.
 *
 * The document is purely data-driven: it maps over the sections returned by
 * buildSections(). Adding or removing fields in buildSections.ts automatically
 * changes the PDF — no renderer logic needs to be touched.
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { TaxResult } from '@taxai/shared'
import { buildSections, buildMeta } from './buildSections'
import type { PdfRow, PdfSection } from './buildSections'

// ─── Formatters ───────────────────────────────────────────────────────────────
// Use plain ASCII/Latin-1 to ensure compatibility with built-in PDF fonts.

function fmtEUR(n: number): string {
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)
  return (n < 0 ? '-' : '') + formatted + ' EUR'
}

function fmtPct(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n) + '%'
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  blue:       '#2563EB',
  blueLight:  '#EFF6FF',
  blueMid:    '#BFDBFE',
  green:      '#059669',
  greenLight: '#ECFDF5',
  amber:      '#D97706',
  amberLight: '#FFFBEB',
  red:        '#DC2626',
  redLight:   '#FEF2F2',
  gray900:    '#111827',
  gray700:    '#374151',
  gray500:    '#6B7280',
  gray300:    '#D1D5DB',
  gray100:    '#F3F4F6',
  white:      '#FFFFFF',
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
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'column', gap: 2 },
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
  brandName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.gray900 },
  headerSub: { fontSize: 8, color: C.gray500 },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  headerTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray900 },
  headerDate: { fontSize: 7.5, color: C.gray500 },

  // Hero card
  hero: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 4,
    opacity: 0.8,
  },
  heroAmount: { fontSize: 28, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  heroSub: { fontSize: 8, opacity: 0.75, marginBottom: 14 },
  heroKpis: { flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'center' },
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
  rowLast: { borderBottomWidth: 0 },
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
  rowLeft: { flex: 1, paddingRight: 8 },
  rowLabel: { fontSize: 8.5, color: C.gray700 },
  rowHint: { fontSize: 7, color: C.gray500, marginTop: 1 },
  rowAmount: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'right', minWidth: 90 },

  // Amount colour variants
  amountNormal:  { color: C.gray900 },
  amountAccent:  { color: C.blue },
  amountSaving:  { color: C.green },
  amountTotal:   { color: C.gray900 },
  amountResult:  { color: C.blue },   // overridden inline for a_ingresar

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ row, isLast }: { row: PdfRow; isLast: boolean }) {
  const isTotal  = row.style === 'total'
  const isResult = row.style === 'result'

  const rowStyle = [
    S.row,
    ...(isTotal  ? [S.rowTotal]  : []),
    ...(isResult ? [S.rowResult] : []),
    ...(isLast && !isTotal && !isResult ? [S.rowLast] : []),
  ]

  const amountStyle =
    row.style === 'accent'  ? S.amountAccent :
    row.style === 'saving'  ? S.amountSaving :
    row.style === 'total'   ? S.amountTotal  :
    row.style === 'result'  ? S.amountResult :
    S.amountNormal

  const labelStyle = [
    S.rowLabel,
    ...(isTotal  ? [{ fontFamily: 'Helvetica-Bold' as const }] : []),
    ...(isResult ? [{ fontFamily: 'Helvetica-Bold' as const, fontSize: 9 }] : []),
  ]

  return (
    <View style={rowStyle}>
      <View style={S.rowLeft}>
        <Text style={labelStyle}>{row.label}</Text>
        {row.hint && <Text style={S.rowHint}>{row.hint}</Text>}
      </View>
      <Text style={[S.rowAmount, amountStyle]}>{fmtEUR(row.amount)}</Text>
    </View>
  )
}

function Section({ section }: { section: PdfSection }) {
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>{section.title.toUpperCase()}</Text>
      </View>
      {section.rows.map((row, i) => (
        <Row key={`${section.id}-row-${i}`} row={row} isLast={i === section.rows.length - 1} />
      ))}
    </View>
  )
}

// ─── Main document ────────────────────────────────────────────────────────────

interface TaxResultPDFProps {
  result: TaxResult
}

export function TaxResultPDF({ result }: TaxResultPDFProps) {
  const meta = buildMeta(result)
  const sections = buildSections(result)

  const isDevolver = meta.resultType === 'a_devolver'
  const isIngresar = meta.resultType === 'a_ingresar'

  const heroBg    = isDevolver ? C.blue  : isIngresar ? C.red  : C.gray700
  const heroColor = C.white

  return (
    <Document
      title={`Taxai IRPF ${meta.fiscalYear} - ${meta.regionName}`}
      author="Taxai"
      subject={`Declaracion de la Renta ${meta.fiscalYear}`}
      creator="Taxai"
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <View style={S.brandRow}>
              <View style={S.brandBox}>
                <Text style={S.brandLetter}>T</Text>
              </View>
              <Text style={S.brandName}>Taxai</Text>
            </View>
            <Text style={S.headerSub}>Calculadora IRPF - Resultado orientativo</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerTitle}>
              Declaracion de la Renta {meta.fiscalYear}
            </Text>
            <Text style={S.headerDate}>{meta.regionName}</Text>
            <Text style={S.headerDate}>Generado el {meta.generatedAt}</Text>
          </View>
        </View>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <View style={[S.hero, { backgroundColor: heroBg }]}>
          <Text style={[S.heroLabel, { color: heroColor }]}>
            {isDevolver ? 'A DEVOLVER' : isIngresar ? 'A INGRESAR' : 'RESULTADO CERO'}
          </Text>
          <Text style={[S.heroAmount, { color: heroColor }]}>
            {fmtEUR(Math.abs(meta.resultAmount))}
          </Text>
          <Text style={[S.heroSub, { color: heroColor }]}>
            Renta {meta.fiscalYear} · {meta.regionName}
          </Text>
          <View style={S.heroKpis}>
            {[
              { label: 'Tipo efectivo', value: fmtPct(meta.effectiveRate) },
              { label: 'Cuota liquida', value: fmtEUR(meta.cuotaLiquidaTOTAL) },
              { label: 'Retenciones',   value: fmtEUR(meta.retenciones) },
            ].map(({ label, value }) => (
              <View key={label} style={S.heroKpi}>
                <Text style={[S.heroKpiLabel, { color: heroColor }]}>{label}</Text>
                <Text style={[S.heroKpiValue, { color: heroColor }]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Sections (data-driven) ───────────────────────────────────────── */}
        {sections.map(section => (
          <Section key={section.id} section={section} />
        ))}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            Taxai · Resultado orientativo · Consulta a un asesor fiscal para tu declaracion oficial
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
