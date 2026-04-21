import { describe, it, expect, vi } from 'vitest';
import { parseNomina } from '../src/nomina-parser.js';
import type Anthropic from '@anthropic-ai/sdk';

function makeClientMock(toolInput: Record<string, unknown>): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            name: 'extract_nomina_data',
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
        content: [{ type: 'text', text: 'No se encontraron datos.' }],
      }),
    },
  } as unknown as Anthropic;
}

const SAMPLE_NOMINA_TEXT = `
EMPRESA EJEMPLO S.L.
Período de liquidación: enero 2025

DEVENGOS
Salario base            2.000,00
Plus convenio             300,00
-----------------------------------
TOTAL DEVENGADO         2.300,00

DEDUCCIONES
Seg. Social trabajador    154,88
Retención IRPF (15,50%)   356,50
-----------------------------------
TOTAL DEDUCCIONES         511,38

LÍQUIDO A PERCIBIR      1.788,62
`;

describe('parseNomina — structured extraction', () => {
  it('returns NominaData from a standard nómina', async () => {
    const client = makeClientMock({
      period: 'enero 2025',
      fiscalYear: 2025,
      monthlyGross: 2300,
      monthlyRetenciones: 356.5,
      retentionPercentage: 15.5,
      monthlySSEmployee: 154.88,
    });

    const result = await parseNomina(SAMPLE_NOMINA_TEXT, client);

    expect(result.period).toBe('enero 2025');
    expect(result.fiscalYear).toBe(2025);
    expect(result.monthlyGross).toBe(2300);
    expect(result.monthlyRetenciones).toBe(356.5);
    expect(result.retentionPercentage).toBe(15.5);
    expect(result.monthlySSEmployee).toBe(154.88);
  });

  it('returns empty object when model finds no structured data', async () => {
    const result = await parseNomina('Documento sin datos de nómina', makeEmptyClientMock());
    expect(result).toEqual({});
  });

  it('handles nomina with annual totals (December payslip)', async () => {
    const client = makeClientMock({
      period: 'diciembre 2024',
      fiscalYear: 2024,
      monthlyGross: 2500,
      annualGross: 30000,
      monthlyRetenciones: 437.5,
      annualRetenciones: 5250,
      retentionPercentage: 17.5,
    });

    const result = await parseNomina('Nómina diciembre con acumulados', client);

    expect(result.period).toBe('diciembre 2024');
    expect(result.annualGross).toBe(30000);
    expect(result.annualRetenciones).toBe(5250);
    expect(result.retentionPercentage).toBe(17.5);
  });

  it('returns only the fields that appear in the nómina (partial extraction)', async () => {
    const client = makeClientMock({
      monthlyGross: 1800,
      retentionPercentage: 10,
    });

    const result = await parseNomina('Nómina parcial', client);

    expect(result.monthlyGross).toBe(1800);
    expect(result.retentionPercentage).toBe(10);
    expect(result.period).toBeUndefined();
    expect(result.monthlyRetenciones).toBeUndefined();
  });

  it('passes the PDF text to the AI model', async () => {
    const client = makeClientMock({ monthlyGross: 3000 });
    const spy = vi.spyOn(client.messages, 'create');

    await parseNomina(SAMPLE_NOMINA_TEXT, client);

    expect(spy).toHaveBeenCalledOnce();
    const call = spy.mock.calls[0][0];
    // The user message content must contain the PDF text
    const userMessage = (call.messages as Array<{ role: string; content: string }>)
      .find((m) => m.role === 'user');
    expect(userMessage?.content).toContain(SAMPLE_NOMINA_TEXT);
  });

  it('uses the correct tool name', async () => {
    const client = makeClientMock({ monthlyGross: 2000 });
    const spy = vi.spyOn(client.messages, 'create');

    await parseNomina('Nómina de prueba', client);

    const call = spy.mock.calls[0][0];
    const tools = call.tools as Array<{ name: string }>;
    expect(tools[0].name).toBe('extract_nomina_data');
  });
});
