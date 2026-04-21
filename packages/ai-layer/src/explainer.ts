import Anthropic from '@anthropic-ai/sdk';
import type { TaxResult } from '@taxai/shared';
import { EXPLAINER_SYSTEM_PROMPT } from './prompts.js';

export async function explainResult(
  result: TaxResult,
  question: string,
  client?: Anthropic,
): Promise<string> {
  const anthropic = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userMessage = `
Resultado del cálculo IRPF:
${JSON.stringify(result, null, 2)}

Pregunta del usuario: ${question}
`.trim();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: EXPLAINER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );

  return textBlock?.text ?? '';
}
