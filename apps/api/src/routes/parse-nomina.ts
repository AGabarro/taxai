import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import pdfParse from 'pdf-parse';
import { parseNomina } from '@taxai/ai-layer';
import { calculate } from '@taxai/engine';
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

const VALID_CIVIL_STATUS: CivilStatus[] = ['single', 'married', 'widowed', 'separated'];

const CORRECT_THRESHOLD_PCT = 2; // within 2% → considered correct

/** Annualise a monthly figure using the number of salary payments per year. */
export function annualise(monthly: number, numberOfPayments = 12): number {
  return Math.round(monthly * numberOfPayments * 100) / 100;
}

/** Derive the best estimate for annual gross from extracted nomina data. */
export function deriveAnnualGross(nomina: NominaData): number {
  if (nomina.annualGross && nomina.annualGross > 0) return nomina.annualGross;
  if (nomina.monthlyGross && nomina.monthlyGross > 0)
    return annualise(nomina.monthlyGross, nomina.numberOfPayments ?? 12);
  return 0;
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

      // Use Claude to extract nomina data
      let nomina: NominaData;
      try {
        nomina = await parseNomina(pdfText);
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send({ error: 'Error al analizar la nómina con IA. Inténtalo de nuevo.' });
      }

      const annualGross = deriveAnnualGross(nomina);
      const annualRetencionesNomina = deriveAnnualRetenciones(nomina);
      const annualSS = deriveAnnualSS(nomina);

      // Override fiscalYear from nomina if detected
      if (nomina.fiscalYear) fiscalYear = nomina.fiscalYear;

      // Build partial TaxInput
      const taxInput: Partial<TaxInput> = {
        fiscalYear,
        region,
        age,
        civilStatus,
        grossSalary: annualGross > 0 ? annualGross : undefined,
        ssContributions: annualSS > 0 ? annualSS : undefined,
        retenciones: annualRetencionesNomina > 0 ? annualRetencionesNomina : undefined,
        dependentsUnder25: 0,
        dependentsOver65: 0,
      };

      const result: NominaParseResult = {
        nomina,
        taxInput,
        annualGross,
        annualRetencionesNomina,
      };

      // Run engine if we have enough data
      const canCalculate =
        annualGross > 0 &&
        !FORAL_REGIONS.includes(region as typeof FORAL_REGIONS[number]);

      if (canCalculate) {
        try {
          const fullInput: TaxInput = {
            fiscalYear,
            region,
            age,
            civilStatus,
            grossSalary: annualGross,
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
