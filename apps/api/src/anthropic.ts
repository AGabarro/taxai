import Anthropic from '@anthropic-ai/sdk';
import type { FastifyRequest } from 'fastify';

/**
 * Creates an Anthropic client for a request.
 * Uses the X-Api-Key header when provided; falls back to ANTHROPIC_API_KEY env var.
 * Never logs the key.
 */
export function clientFromRequest(req: FastifyRequest): InstanceType<typeof Anthropic> {
  const header = req.headers['x-api-key'];
  const key = typeof header === 'string' && header.trim()
    ? header.trim()
    : process.env.ANTHROPIC_API_KEY;
  return new Anthropic({ apiKey: key });
}
