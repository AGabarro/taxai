import type { FastifyInstance } from 'fastify';
import { calculate } from '@taxai/engine';
import type { TaxInput } from '@taxai/shared';

const VALID_REGIONS = [
  'andalusia', 'aragon', 'asturias', 'balearics', 'canarias', 'cantabria',
  'castilla-la-mancha', 'castilla-leon', 'catalonia', 'extremadura', 'galicia',
  'la-rioja', 'madrid', 'murcia', 'navarra', 'pais-vasco', 'valenciana',
] as const;

const VALID_CIVIL_STATUS = ['single', 'married', 'widowed', 'separated'] as const;

const bodySchema = {
  type: 'object',
  required: [
    'fiscalYear', 'region', 'age', 'grossSalary', 'retenciones',
    'dependentsUnder25', 'dependentsOver65', 'civilStatus',
  ],
  properties: {
    fiscalYear:        { type: 'integer', minimum: 2020, maximum: 2030 },
    region:            { type: 'string', enum: VALID_REGIONS },
    age:               { type: 'integer', minimum: 0, maximum: 120 },
    grossSalary:       { type: 'number', minimum: 0 },
    otherIncome:       { type: 'number', minimum: 0 },
    retenciones:       { type: 'number', minimum: 0 },
    dependentsUnder25: { type: 'integer', minimum: 0 },
    dependentsOver65:  { type: 'integer', minimum: 0 },
    civilStatus:       { type: 'string', enum: VALID_CIVIL_STATUS },
    disability:        { type: 'integer', enum: [33, 65] },
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
      try {
        const result = calculate(request.body);
        return reply.send(result);
      } catch (err) {
        app.log.error(err);
        // Region rules file might not exist yet
        if (err instanceof Error && err.message.includes('Cannot find module')) {
          return reply.status(422).send({
            error: `La comunidad autónoma '${request.body.region}' no está disponible todavía`,
          });
        }
        return reply.status(500).send({ error: 'Error interno del servidor' });
      }
    },
  );
}
