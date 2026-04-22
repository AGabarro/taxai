import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import pdfParse from 'pdf-parse';
import { parseBrokerReport } from '@taxai/ai-layer';
import { computeBrokerFIFO, calculate } from '@taxai/engine';
import { clientFromRequest } from '../anthropic.js';
import { aiRateLimiter } from '../ratelimit.js';
import type {
  TaxInput,
  SpanishRegion,
  CivilStatus,
  BrokerParseResult,
} from '@taxai/shared';
import { VALID_REGIONS, VALID_CIVIL_STATUS } from './parse-nomina.js';

const FORAL_REGIONS = ['navarra', 'pais-vasco'] as const;

export async function parseBrokerRoute(app: FastifyInstance): Promise<void> {
  await app.register(async (fastify) => {
    await fastify.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
        files: 1,
      },
    });

    fastify.post('/api/parse-broker', async (request, reply) => {
      if (!aiRateLimiter.isAllowed(request.ip)) {
        return reply.status(429).send({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' });
      }

      let fileBuffer: Buffer | undefined;
      let fileMimetype = '';
      let fileFilename = '';
      let region: SpanishRegion = 'madrid';
      let age = 35;
      let civilStatus: CivilStatus = 'single';
      let fiscalYear = 2025;

      try {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'file') {
            fileMimetype = part.mimetype;
            fileFilename = part.filename ?? '';
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk as Buffer);
            }
            fileBuffer = Buffer.concat(chunks);
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

      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.status(400).send({ error: 'Se requiere un archivo en el campo "file"' });
      }

      if (FORAL_REGIONS.includes(region as typeof FORAL_REGIONS[number])) {
        return reply.status(501).send({
          error: 'Las comunidades forales (Navarra y País Vasco) estarán disponibles próximamente.',
        });
      }

      // Extract text from file
      let reportText: string;
      // Browsers send .csv files with varying MIME types (text/csv, application/octet-stream,
      // application/vnd.ms-excel, text/plain). Check the file extension as the reliable fallback.
      const isCsv =
        fileMimetype === 'text/csv' ||
        fileMimetype === 'application/csv' ||
        fileMimetype === 'text/plain' ||
        fileFilename.toLowerCase().endsWith('.csv');

      try {
        if (isCsv) {
          reportText = fileBuffer.toString('utf-8');
        } else {
          const parsed = await pdfParse(fileBuffer);
          reportText = parsed.text;
        }
      } catch (err) {
        app.log.error(err);
        return reply.status(422).send({
          error: 'No se pudo leer el archivo. Asegúrate de que no está protegido con contraseña.',
        });
      }

      if (!reportText || reportText.trim().length < 20) {
        return reply.status(422).send({
          error: 'El archivo no contiene texto legible.',
        });
      }

      // Extract transactions via AI
      let brokerReport: Awaited<ReturnType<typeof parseBrokerReport>>;
      try {
        const client = clientFromRequest(request);
        brokerReport = await parseBrokerReport(reportText, client);
      } catch (err) {
        if ((err as { status?: number }).status === 401) {
          return reply.status(401).send({ error: 'Clave API no válida. Verifica tu clave en console.anthropic.com' });
        }
        app.log.error(err);
        return reply.status(500).send({ error: 'Error al analizar el informe con IA. Inténtalo de nuevo.' });
      }

      // Override fiscal year from detected report year
      if (brokerReport.fiscalYear) fiscalYear = brokerReport.fiscalYear;

      // Run FIFO engine — THE ENGINE DOES ALL ARITHMETIC
      const fifoResult = computeBrokerFIFO(brokerReport.transactions);

      // Build partial TaxInput from computed figures
      const hasSavings =
        fifoResult.capitalGains !== 0 ||
        fifoResult.dividends !== 0 ||
        fifoResult.interest !== 0;

      const taxInput: Partial<TaxInput> = {
        fiscalYear,
        region,
        age,
        civilStatus,
        grossSalary: 0,
        retenciones: 0,
        dependentsUnder25: 0,
        dependentsOver65: 0,
        ...(hasSavings ? {
          savingsIncome: {
            capitalGains: fifoResult.capitalGains !== 0 ? fifoResult.capitalGains : undefined,
            dividends:    fifoResult.dividends !== 0    ? fifoResult.dividends    : undefined,
            interest:     fifoResult.interest !== 0     ? fifoResult.interest     : undefined,
          },
        } : {}),
      };

      const result: BrokerParseResult = {
        brokerReport,
        computedCapitalGains:    fifoResult.capitalGains,
        computedDividends:       fifoResult.dividends,
        computedInterest:        fifoResult.interest,
        totalForeignTaxWithheld: fifoResult.totalForeignTaxWithheld,
        taxInput,
        warnings: fifoResult.warnings,
      };

      // Run engine only if there is savings income (no salary path for pure investors)
      if (hasSavings) {
        try {
          const fullInput: TaxInput = {
            fiscalYear,
            region,
            age,
            civilStatus,
            grossSalary: 0,
            retenciones: 0,
            dependentsUnder25: 0,
            dependentsOver65: 0,
            savingsIncome: {
              capitalGains: fifoResult.capitalGains !== 0 ? fifoResult.capitalGains : undefined,
              dividends:    fifoResult.dividends !== 0    ? fifoResult.dividends    : undefined,
              interest:     fifoResult.interest !== 0     ? fifoResult.interest     : undefined,
            },
          };
          result.taxResult = calculate(fullInput);
        } catch (err) {
          app.log.warn({ err }, 'Engine calculation failed for broker parse');
        }
      }

      return reply.send(result);
    });
  });
}
