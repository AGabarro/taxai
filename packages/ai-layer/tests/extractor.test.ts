import { describe, it, expect, vi } from 'vitest';
import { extractTaxInput, PiiDetectedError } from '../src/extractor.js';
import type Anthropic from '@anthropic-ai/sdk';

// Minimal mock of the Anthropic client
function makeClientMock(toolInput: Record<string, unknown>): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            name: 'extract_tax_data',
            input: toolInput,
          },
        ],
      }),
    },
  } as unknown as Anthropic;
}

function makeEmptyClientMock(): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'No hay datos.' }],
      }),
    },
  } as unknown as Anthropic;
}

describe('extractTaxInput — PII guard', () => {
  it('rejects messages containing a DNI', async () => {
    await expect(
      extractTaxInput('Me llamo Juan, mi DNI es 12345678A y gano 30000 euros', makeEmptyClientMock()),
    ).rejects.toBeInstanceOf(PiiDetectedError);
  });

  it('rejects messages containing a NIE', async () => {
    await expect(
      extractTaxInput('Mi NIE es X1234567Z, vivo en Madrid', makeEmptyClientMock()),
    ).rejects.toBeInstanceOf(PiiDetectedError);
  });

  it('rejects messages containing an IBAN', async () => {
    await expect(
      extractTaxInput('Mi cuenta ES9121000418450200051332 tiene retenciones', makeEmptyClientMock()),
    ).rejects.toBeInstanceOf(PiiDetectedError);
  });
});

describe('extractTaxInput — structured output', () => {
  it('returns parsed Partial<TaxInput> from tool call', async () => {
    const client = makeClientMock({ grossSalary: 30000, region: 'madrid', age: 35 });
    const result = await extractTaxInput('Gano 30000 euros en Madrid, tengo 35 años', client);
    expect(result).toEqual({ grossSalary: 30000, region: 'madrid', age: 35 });
  });

  it('returns empty object when model returns no tool call', async () => {
    const result = await extractTaxInput('¿Cómo funciona el IRPF?', makeEmptyClientMock());
    expect(result).toEqual({});
  });

  it('passes through all extractable TaxInput fields', async () => {
    const fields = {
      fiscalYear: 2024,
      region: 'catalonia',
      age: 45,
      grossSalary: 55000,
      retenciones: 10000,
      dependentsUnder25: 2,
      dependentsOver65: 1,
      civilStatus: 'married',
    };
    const client = makeClientMock(fields);
    const result = await extractTaxInput('Datos completos de mi situación fiscal', client);
    expect(result).toEqual(fields);
  });
});
