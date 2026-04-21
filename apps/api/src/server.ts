import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { calculateRoute } from './routes/calculate.js';
import { extractRoute } from './routes/extract.js';
import { explainRoute } from './routes/explain.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
});

await app.register(calculateRoute);
await app.register(extractRoute);
await app.register(explainRoute);

const port = parseInt(process.env.PORT ?? '3000', 10);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
