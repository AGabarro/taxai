import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import pdfParse from 'pdf-parse';
import { parseNomina } from '@taxai/ai-layer';
import { calculate } from '@taxai/engine';
import { clientFromRequest } from '../anthropic.js';
import type {
  TaxInput,
  SpanishRegion,
  CivilStatus,
  NominaData,
  NominaParseResult,
  NominaComparison,
} from '@taxai/shared';

const FORAL_REGIONS = ['navarra', 'pais-vasco'] as const;

export const VALID_REGIONS: SpanishRegion[] = [
  'andalusia', 'aragon', 'asturias', 'balearics', 'canarias', 'cantabria',
  'castilla-la-mancha', 'castilla-leon', 'catalonia', 'extremadura', 'galicia',
  'la-rioja', 'madrid', 'murcia', 'navarra', 'pais-vasco', 'valenciana',
];

export const VALID_CIVIL_STATUS: CivilStatus[] = ['single', 'married', 'widowed', 'separated'];

const CORRECT_THRESHOLD_PCT = 2; // within 2% → considered correct

/**
 * Patterns that indicate the payslip already contains prorated extra payments
 * as monthly line items (pagas prorrateadas). When any of these appear in the
 * devengos/earnings section the monthly Total Devengado ALREADY includes the
 * proportional share of the extra pay — the correct annual multiplier is 12,
 * not 14.
 *
 * Covers common label variants found across Spanish payroll software:
 *   - "P.P. Extras" / "P.P.Extras" / "PP Extras"
 *   - "Prorrateo" / "Prorrat."
 *   - "P.P. Paga Verano" / "P.P. Paga Navidad"
 *   - "Paga Verano prorr" / "Paga Navidad prorr"
 */
const PRORATION_PATTERNS = [
  /\bP\.?\s*P\.?\s*Extras?\b/i,
  /prorrate[oa]/i,
  /\bP\.?\s*P\.?\s*Paga\s+(Verano|Navidad|Extra)/i,
  /Paga\s+(Verano|Navidad)\s+prorr/i,
  /Extra\s+prorr/i,
];

/**
 * Returns true when the PDF text contains prorated-payment line items,
 * meaning the monthly Total Devengado already includes extra pay proportionally.
 * In that case the correct annual multiplier is 12.
 *
 * Exported so it can be unit-tested independently.
 */
export function detectProration(pdfText: string): boolean {
  return PRORATION_PATTERNS.some((re) => re.test(pdfText));
}

/** Annualise a monthly figure using the number of salary payments per year. */
export function annualise(monthly: number, numberOfPayments = 12): number {
  return Math.round(monthly * numberOfPayments * 100) / 100;
}

/** Derive the best estimate for annual gross (Total Devengado) — used for display. */
export function deriveAnnualGross(nomina: NominaData): number {
  if (nomina.annualGross && nomina.annualGross > 0) return nomina.annualGross;
  if (nomina.monthlyGross && nomina.monthlyGross > 0)
    return annualise(nomina.monthlyGross, nomina.numberOfPayments ?? 12);
  return 0;
}

/**
 * Derive the annual Base I.R.P.F. used as grossSalary for the engine.
 *
 * Prefers monthlyBaseIRPF when present — this excludes tax-exempt benefits
 * (meal vouchers, health insurance) that are in Total Devengado but must not
 * be subject to IRPF withholding.  Falls back to Total Devengado when no
 * explicit IRPF base was found on the payslip.
 *
 * Exported so it can be unit-tested independently.
 */
export function deriveAnnualBaseIRPF(nomina: NominaData): number {
  if (nomina.monthlyBaseIRPF && nomina.monthlyBaseIRPF > 0)
    return annualise(nomina.monthlyBaseIRPF, nomina.numberOfPayments ?? 12);
  // No dedicated IRPF base — fall back to Total Devengado
  return deriveAnnualGross(nomina);
}

/** Derive the best estimate for annual retenciones from extracted nomina data. */
export function deriveAnnualRetenciones(nomina: NominaData): number {
  if (nomina.annualRetenciones && nomina.annualRetenciones > 0) return nomina.annualRetenciones;
  if (nomina.monthlyRetenciones && nomina.monthlyRetenciones > 0)
    return annualise(nomina.monthlyRetenciones, nomina.numberOfPayments ?? 12);
  // Fallback: derive from percentage × annualised gross
  if (nomina.retentionPercentage && nomina.monthlyGross) {
    const annual = deriveAnnualGross(nomina);
    return Math.round(annual * (nomina.retentionPercentage / 100) * 100) / 100;
  }
  return 0;
}

/**
 * Derive total annual employee SS contributions.
 * Prefers the sum of detailed breakdown fields; falls back to monthlySSEmployee × payments.
 */
export function deriveAnnualSS(nomina: NominaData): number {
  const n = nomina.numberOfPayments ?? 12;

  // Sum detailed breakdown if any breakdown field is present
  const hasBreakdown =
    nomina.monthlySS_CC !== undefined ||
    nomina.monthlySS_MEI !== undefined ||
    nomina.monthlySS_unemployment !== undefined ||
    nomina.monthlySS_vocational !== undefined;

  if (hasBreakdown) {
    const monthly =
      (nomina.monthlySS_CC ?? 0) +
      (nomina.monthlySS_MEI ?? 0) +
      (nomina.monthlySS_unemployment ?? 0) +
      (nomina.monthlySS_vocational ?? 0);
    return annualise(monthly, n);
  }

  if (nomina.monthlySSEmployee && nomina.monthlySSEmployee > 0)
    return annualise(nomina.monthlySSEmployee, n);

  return 0;
}

/** Build the comparison between employer withheld amount and engine calculated tax. */
export function buildComparison(calculatedTax: number, retencionesFromNomina: number): NominaComparison {
  const difference = Math.round((retencionesFromNomina - calculatedTax) * 100) / 100;
  const percentageDiff =
    calculatedTax !== 0
      ? Math.round((Math.abs(difference) / calculatedTax) * 10000) / 100
      : 0;

  let diffType: NominaComparison['diffType'];
  if (percentageDiff <= CORRECT_THRESHOLD_PCT) {
    diffType = 'correct';
  } else if (difference > 0) {
    diffType = 'overpaid';
  } else {
    diffType = 'underpaid';
  }

  return { calculatedTax, retencionesFromNomina, difference, diffType, percentageDiff };
}

export async function parseNominaRoute(app: FastifyInstance): Promise<void> {
  // Scope multipart plugin to this route's encapsulated context only
  await app.register(async (fastify) => {
    await fastify.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
        files: 1,
      },
    });

    fastify.post('/api/parse-nomina', async (request, reply) => {
      let pdfBuffer: Buffer | undefined;
      let region: SpanishRegion = 'madrid';
      let age = 35;
      let civilStatus: CivilStatus = 'single';
      let fiscalYear = 2025;

      try {
        const parts = request.parts();

        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'pdf') {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk as Buffer);
            }
            pdfBuffer = Buffer.concat(chunks);
          } else if (part.type === 'field') {
            const value = part.value as string;
            switch (part.fieldname) {
              case 'region':
                if (VALID_REGIONS.includes(value as SpanishRegion)) {
                  region = value as SpanishRegion;
                }
                break;
              case 'age': {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 120) age = parsed;
                break;
              }
              case 'civilStatus':
                if (VALID_CIVIL_STATUS.includes(value as CivilStatus)) {
                  civilStatus = value as CivilStatus;
                }
                break;
              case 'fiscalYear': {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2030) fiscalYear = parsed;
                break;
              }
            }
          }
        }
      } catch (err) {
        app.log.error(err);
        return reply.status(400).send({ error: 'Error al leer el formulario multipart' });
      }

      if (!pdfBuffer || pdfBuffer.length === 0) {
        return reply.status(400).send({ error: 'Se requiere un archivo PDF en el campo "pdf"' });
      }

      // Extract text from PDF
      let pdfText: string;
      try {
        const parsed = await pdfParse(pdfBuffer);
        pdfText = parsed.text;
      } catch (err) {
        app.log.error(err);
        return reply.status(422).send({ error: 'No se pudo leer el PDF. Asegúrate de que no está protegido con contraseña.' });
      }

      if (!pdfText || pdfText.trim().length < 20) {
        return reply.status(422).send({ error: 'El PDF no contiene texto legible. Puede ser un PDF escaneado.' });
      }

      // Deterministic proration check — runs on raw PDF text BEFORE calling Claude.
      // If the payslip contains prorated-extra-pay line items (P.P. Extras, Prorrateo, etc.)
      // the monthly Total Devengado already includes the proportional share of extra pay,
      // so the correct annual multiplier is 12, not 14.
      const isProrated = detectProration(pdfText);

      // Use Claude to extract nomina data
      let nomina: NominaData;
      try {
        const client = clientFromRequest(request);
        nomina = await parseNomina(pdfText, client);
      } catch (err) {
        if ((err as { status?: number }).status === 401) {
          return reply.status(401).send({ error: 'Clave API no válida. Verifica tu clave en console.anthropic.com' });
        }
        app.log.error(err);
        return reply.status(500).send({ error: 'Error al analizar la nómina con IA. Inténtalo de nuevo.' });
      }

      // Authoritative override: proration detected in raw text always wins over
      // whatever numberOfPayments Claude may have extracted.
      if (isProrated) {
        nomina = { ...nomina, numberOfPayments: 12 };
      }

      const annualGross = deriveAnnualGross(nomina);
      const annualBaseIRPF = deriveAnnualBaseIRPF(nomina);
      const annualRetencionesNomina = deriveAnnualRetenciones(nomina);
      const annualSS = deriveAnnualSS(nomina);

      // The engine always works on the IRPF base (excluding tax-exempt benefits).
      // When no explicit Base I.R.P.F. was found on the payslip, annualBaseIRPF
      // falls back to annualGross so existing behaviour is unchanged.
      const engineGross = annualBaseIRPF;

      // Override fiscalYear from nomina if detected
      if (nomina.fiscalYear) fiscalYear = nomina.fiscalYear;

      // Build partial TaxInput
      const taxInput: Partial<TaxInput> = {
        fiscalYear,
        region,
        age,
        civilStatus,
        grossSalary: engineGross > 0 ? engineGross : undefined,
        ssContributions: annualSS > 0 ? annualSS : undefined,
        retenciones: annualRetencionesNomina > 0 ? annualRetencionesNomina : undefined,
        dependentsUnder25: 0,
        dependentsOver65: 0,
      };

      const result: NominaParseResult = {
        nomina,
        taxInput,
        annualGross,
        annualBaseIRPF,
        annualRetencionesNomina,
      };

      // Run engine if we have enough data
      const canCalculate =
        engineGross > 0 &&
        !FORAL_REGIONS.includes(region as typeof FORAL_REGIONS[number]);

      if (canCalculate) {
        try {
          const fullInput: TaxInput = {
            fiscalYear,
            region,
            age,
            civilStatus,
            grossSalary: engineGross,
            ssContributions: annualSS > 0 ? annualSS : undefined,
            retenciones: annualRetencionesNomina,
            dependentsUnder25: 0,
            dependentsOver65: 0,
          };

          const taxResult = calculate(fullInput);
          result.taxResult = taxResult;

          if (annualRetencionesNomina > 0) {
            result.comparison = buildComparison(
              taxResult.cuotaLiquidaTOTAL,
              annualRetencionesNomina,
            );
          }
        } catch (err) {
          // Calculation failure is non-fatal — return what we have
          app.log.warn('Engine calculation failed for nomina parse:', err);
        }
      }

      return reply.send(result);
    });
  });
}
