import type { FastifyInstance } from 'fastify';
import { explainResult } from '@taxai/ai-layer';
import type { TaxResult } from '@taxai/shared';

export async function explainRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { result: TaxResult; question: string } }>(
    '/api/explain',
    {
      schema: {
        body: {
          type: 'object',
          required: ['result', 'question'],
          properties: {
            result: { type: 'object' },
            question: { type: 'string', maxLength: 1000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const explanation = await explainResult(request.body.result, request.body.question);
        return reply.send({ explanation });
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send({ error: 'Error interno del servidor' });
      }
    },
  );
}
