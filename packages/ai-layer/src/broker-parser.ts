import Anthropic from '@anthropic-ai/sdk';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages.js';
import type { BrokerReportData } from '@taxai/shared';
import { BROKER_PARSER_SYSTEM_PROMPT } from './prompts.js';

const PARSE_BROKER_TOOL: Tool = {
  name: 'extract_broker_transactions',
  description: 'Extrae transacciones e ingresos de capital de un informe anual de broker para la declaración IRPF',
  input_schema: {
    type: 'object' as const,
    required: ['fiscalYear', 'transactions'],
    properties: {
      brokerName: { type: 'string' },
      fiscalYear: { type: 'integer' },
      currency: {
        type: 'string',
        description: 'Currency of the report (usually EUR)',
      },
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['transactionType', 'date', 'totalAmount', 'fees', 'currency'],
          properties: {
            assetId:            { type: 'string' },
            assetName:          { type: 'string' },
            transactionType:    { type: 'string', enum: ['buy', 'sell', 'dividend', 'interest', 'fee'] },
            date:               { type: 'string', description: 'ISO date YYYY-MM-DD' },
            quantity:           { type: 'number' },
            pricePerUnit:       { type: 'number' },
            totalAmount:        { type: 'number', description: 'Positive=income/proceeds, negative=cost' },
            fees:               { type: 'number', description: 'Always positive' },
            currency:           { type: 'string' },
            fxRate:             { type: 'number', description: 'Exchange rate to EUR on transaction date' },
            foreignTaxWithheld: { type: 'number' },
          },
        },
      },
      reportedCapitalGains: { type: 'number' },
      reportedDividends:    { type: 'number' },
      reportedInterest:     { type: 'number' },
      reportedFees:         { type: 'number' },
    },
  },
};

export async function parseBrokerReport(
  reportText: string,
  client?: InstanceType<typeof Anthropic>,
): Promise<BrokerReportData> {
  const anthropic = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: BROKER_PARSER_SYSTEM_PROMPT,
    tools: [PARSE_BROKER_TOOL],
    tool_choice: { type: 'auto' },
    messages: [
      {
        role: 'user',
        content: `Extrae todas las transacciones de este informe de broker:\n\n${reportText}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is ToolUseBlock =>
      block.type === 'tool_use' && block.name === 'extract_broker_transactions',
  );

  if (!toolUse) {
    // Model couldn't find extractable data — return minimal structure
    return {
      fiscalYear: new Date().getFullYear(),
      currency: 'EUR',
      transactions: [],
    };
  }

  const raw = toolUse.input as Record<string, unknown>;
  return {
    brokerName:           raw.brokerName as string | undefined,
    fiscalYear:           (raw.fiscalYear as number) ?? new Date().getFullYear(),
    currency:             (raw.currency as string) ?? 'EUR',
    transactions:         (raw.transactions as BrokerReportData['transactions']) ?? [],
    reportedCapitalGains: raw.reportedCapitalGains as number | undefined,
    reportedDividends:    raw.reportedDividends as number | undefined,
    reportedInterest:     raw.reportedInterest as number | undefined,
    reportedFees:         raw.reportedFees as number | undefined,
  };
}
