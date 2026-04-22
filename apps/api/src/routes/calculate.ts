import type { FastifyInstance } from 'fastify';
import { calculate } from '@taxai/engine';
import type { TaxInput } from '@taxai/shared';

const FORAL_REGIONS = ['navarra', 'pais-vasco'] as const;

const VALID_REGIONS = [
  'andalusia', 'aragon', 'asturias', 'balearics', 'canarias', 'cantabria',
  'castilla-la-mancha', 'castilla-leon', 'catalonia', 'extremadura', 'galicia',
  'la-rioja', 'madrid', 'murcia', 'navarra', 'pais-vasco', 'valenciana',
] as const;

const VALID_CIVIL_STATUS = ['single', 'married', 'widowed', 'separated'] as const;

const bodySchema = {
  type: 'object',
  required: [
    'region', 'age', 'grossSalary', 'retenciones',
    'dependentsUnder25', 'dependentsOver65', 'civilStatus',
  ],
  properties: {
    fiscalYear:        { type: 'integer', minimum: 2020, maximum: 2030, default: 2025 },
    region:            { type: 'string', enum: VALID_REGIONS },
    age:               { type: 'integer', minimum: 0, maximum: 120 },
    grossSalary:       { type: 'number', minimum: 0 },
    ssContributions:   { type: 'number', minimum: 0 },
    otherIncome:       { type: 'number', minimum: 0 },
    retenciones:       { type: 'number', minimum: 0 },
    dependentsUnder25: { type: 'integer', minimum: 0 },
    dependentsUnder3:  { type: 'integer', minimum: 0 },
    dependentsOver65:  { type: 'integer', minimum: 0 },
    civilStatus:       { type: 'string', enum: VALID_CIVIL_STATUS },
    disability:        { type: 'integer', enum: [33, 65] },
    dependentsDisability33: { type: 'integer', minimum: 0 },
    dependentsDisability65: { type: 'integer', minimum: 0 },
    pensionContributions: { type: 'number', minimum: 0 },
    savingsIncome: {
      type: 'object',
      properties: {
        capitalGains: { type: 'number' },
        dividends:    { type: 'number', minimum: 0 },
        interest:     { type: 'number', minimum: 0 },
      },
      additionalProperties: false,
    },
    rentalIncome: {
      type: 'object',
      properties: {
        grossRentalIncome: { type: 'number', minimum: 0 },
        rentalExpenses:    { type: 'number', minimum: 0 },
        imputedIncome:     { type: 'number', minimum: 0 },
      },
      additionalProperties: false,
    },
    regionalDeductions: {
      type: 'object',
      properties: {
        catalonia: {
          type: 'object',
          properties: {
            birthAdoptionFirst:    { type: 'integer', minimum: 0 },
            birthAdoptionThird:    { type: 'integer', minimum: 0 },
            habitatgeRentMonthly:  { type: 'number', minimum: 0 },
            donacionsRecerca:      { type: 'number', minimum: 0 },
            donacionsEcologiques:  { type: 'number', minimum: 0 },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    rentPayments: {
      type: 'object',
      properties: {
        annualRentPaid:        { type: 'number', minimum: 0 },
        isUnder36:             { type: 'boolean' },
        hasDisability:         { type: 'boolean' },
        isLargeFamily:         { type: 'boolean' },
        isUnemployed6Months:   { type: 'boolean' },
        contractBefore2015:    { type: 'boolean' },
      },
      required: ['annualRentPaid', 'isUnder36', 'hasDisability', 'isLargeFamily', 'isUnemployed6Months', 'contractBefore2015'],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

export async function calculateRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: TaxInput }>(
    '/api/calculate',
    {
      schema: {
        body: bodySchema,
      },
      errorHandler(error, _request, reply) {
        if (error.validation) {
          return reply.status(400).send({
            error: 'Datos de entrada inválidos',
            detalle: error.message,
          });
        }
        app.log.error(error);
        return reply.status(500).send({ error: 'Error interno del servidor' });
      },
    },
    async (request, reply) => {
      const body = request.body;

      // Default fiscalYear to 2025 if not provided
      const fiscalYear = body.fiscalYear ?? 2025;
      const input: TaxInput = { ...body, fiscalYear };

      // Régimen foral not yet supported
      if (FORAL_REGIONS.includes(input.region as typeof FORAL_REGIONS[number])) {
        return reply.status(501).send({
          error: 'Las comunidades forales (Navarra y País Vasco) estarán disponibles próximamente.',
        });
      }

      try {
        const result = calculate(input);
        return reply.send(result);
      } catch (err) {
        app.log.error(err);
        if (err instanceof Error && err.message.includes('Cannot find module')) {
          return reply.status(422).send({
            error: `La comunidad autónoma '${input.region}' no está disponible todavía`,
          });
        }
        return reply.status(500).send({ error: 'Error interno del servidor' });
      }
    },
  );
}
