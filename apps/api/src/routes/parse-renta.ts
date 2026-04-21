import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import pdfParse from 'pdf-parse';
import { parseNomina } from '@taxai/ai-layer';
import { calculate } from '@taxai/engine';
import { clientFromRequest } from '../anthropic.js';
import { aiRateLimiter } from '../ratelimit.js';
import type {
  TaxInput,
  SpanishRegion,
  CivilStatus,
  NominaData,
  RentaAnualResult,
} from '@taxai/shared';
import {
  VALID_REGIONS,
  VALID_CIVIL_STATUS,
  detectProration,
  buildComparison,
} from './parse-nomina.js';

const FORAL_REGIONS = ['navarra', 'pais-vasco'] as const;

export async function parseRentaRoute(app: FastifyInstance): Promise<void> {
  await app.register(async (fastify) => {
    await fastify.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB per file
        files: 12,
      },
    });

    fastify.post('/api/parse-renta', async (request, reply) => {
      if (!aiRateLimiter.isAllowed(request.ip)) {
        return reply.status(429).send({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' });
      }

      const pdfBuffers: Buffer[] = [];
      let region: SpanishRegion = 'madrid';
      let age = 35;
      let civilStatus: CivilStatus = 'single';
      let fiscalYear = 2025;

      try {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname.startsWith('pdf')) {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk as Buffer);
            }
            const buf = Buffer.concat(chunks);
            if (buf.length > 0) pdfBuffers.push(buf);
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

      if (pdfBuffers.length === 0) {
        return reply.status(400).send({ error: 'Se requiere al menos un archivo PDF' });
      }

      if (FORAL_REGIONS.includes(region as typeof FORAL_REGIONS[number])) {
        return reply.status(501).send({
          error: 'Los regímenes forales de Navarra y País Vasco no están implementados aún.',
        });
      }

      const client = clientFromRequest(request);

      // Parse each PDF and extract nomina data
      const months: NominaData[] = [];
      for (const buffer of pdfBuffers) {
        let pdfText: string;
        try {
          const parsed = await pdfParse(buffer);
          pdfText = parsed.text;
        } catch (err) {
          app.log.error(err);
          return reply.status(422).send({
            error: 'No se pudo leer uno de los PDF. Asegúrate de que no están protegidos con contraseña.',
          });
        }

        if (!pdfText || pdfText.trim().length < 20) {
          return reply.status(422).send({
            error: 'Uno de los PDF no contiene texto legible. Puede ser un PDF escaneado.',
          });
        }

        const isProrated = detectProration(pdfText);

        let nomina: NominaData;
        try {
          nomina = await parseNomina(pdfText, client);
        } catch (err) {
          if ((err as { status?: number }).status === 401) {
            return reply.status(401).send({ error: 'Clave API no válida. Verifica tu clave en console.anthropic.com' });
          }
          app.log.error(err);
          return reply.status(500).send({ error: 'Error al analizar una nómina con IA. Inténtalo de nuevo.' });
        }

        // Override numberOfPayments if proration detected in raw text
        if (isProrated) nomina = { ...nomina, numberOfPayments: 12 };
        // Use fiscal year from nómina if detected
        if (nomina.fiscalYear) fiscalYear = nomina.fiscalYear;

        months.push(nomina);
      }

      // Aggregate actual totals across all months (no projection — sum the real figures)
      const annualGross = months.reduce((s, m) => s + (m.monthlyGross ?? 0), 0);
      const annualBaseIRPF = months.reduce(
        (s, m) => s + (m.monthlyBaseIRPF ?? m.monthlyGross ?? 0),
        0,
      );
      const annualRetencionesNomina = months.reduce((s, m) => s + (m.monthlyRetenciones ?? 0), 0);
      const annualSS = months.reduce((s, m) => {
        const hasBreakdown =
          m.monthlySS_CC !== undefined ||
          m.monthlySS_MEI !== undefined ||
          m.monthlySS_unemployment !== undefined ||
          m.monthlySS_vocational !== undefined;
        if (hasBreakdown) {
          return (
            s +
            (m.monthlySS_CC ?? 0) +
            (m.monthlySS_MEI ?? 0) +
            (m.monthlySS_unemployment ?? 0) +
            (m.monthlySS_vocational ?? 0)
          );
        }
        return s + (m.monthlySSEmployee ?? 0);
      }, 0);

      const engineGross = annualBaseIRPF > 0 ? annualBaseIRPF : annualGross;

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

      const result: RentaAnualResult = {
        months,
        annualGross,
        annualBaseIRPF,
        annualRetencionesNomina,
        annualSS,
        taxInput,
      };

      if (engineGross > 0) {
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
            result.comparison = buildComparison(taxResult.cuotaLiquidaTOTAL, annualRetencionesNomina);
          }
        } catch (err) {
          // Non-fatal — return extracted data even if engine fails
          app.log.warn({ err }, 'Engine calculation failed for renta parse');
        }
      }

      return reply.send(result);
    });
  });
}
