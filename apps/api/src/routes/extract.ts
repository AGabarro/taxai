import type { FastifyInstance } from 'fastify';
import { extractTaxInput, PiiDetectedError } from '@taxai/ai-layer';
import { aiRateLimiter } from '../ratelimit.js';

export async function extractRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { message: string } }>(
    '/api/extract',
    {
      schema: {
        body: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', maxLength: 2000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const ip = request.ip;
      if (!aiRateLimiter.isAllowed(ip)) {
        return reply.status(429).send({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' });
      }
      try {
        const result = await extractTaxInput(request.body.message);
        return reply.send(result);
      } catch (err) {
        if (err instanceof PiiDetectedError) {
          return reply.status(400).send({
            error: 'No incluyas datos personales identificativos (DNI, IBAN, etc.)',
          });
        }
        app.log.error(err);
        return reply.status(500).send({ error: 'Error interno del servidor' });
      }
    },
  );
}
