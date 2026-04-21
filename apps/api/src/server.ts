import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { calculateRoute } from './routes/calculate.js';
import { extractRoute } from './routes/extract.js';
import { explainRoute } from './routes/explain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolves to apps/web/dist from apps/api/src/
const FRONTEND_DIST = path.resolve(__dirname, '../../web/dist');

const app = Fastify({ logger: true });

// CORS only needed when frontend is served separately (dev mode with Vite proxy)
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
});

// API routes — registered before static so /api/* is never caught by the file server
await app.register(calculateRoute);
await app.register(extractRoute);
await app.register(explainRoute);

// Serve the built React app
try {
  await app.register(fastifyStatic, {
    root: FRONTEND_DIST,
    prefix: '/',
    // Don't throw if dist doesn't exist yet (first run before build)
  });

  // SPA fallback: any non-API, non-static request returns index.html
  app.setNotFoundHandler((_request, reply) => {
    reply.sendFile('index.html');
  });
} catch {
  app.log.warn(
    `Frontend dist not found at ${FRONTEND_DIST}. ` +
    'Run "pnpm build" to generate it, or use "pnpm dev" for development mode.',
  );
}

const port = parseInt(process.env.PORT ?? '3000', 10);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
