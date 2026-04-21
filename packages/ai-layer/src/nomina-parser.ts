import Anthropic from '@anthropic-ai/sdk';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages.js';
import type { NominaData } from '@taxai/shared';
import { NOMINA_PARSER_SYSTEM_PROMPT } from './prompts.js';

const PARSE_NOMINA_TOOL: Tool = {
  name: 'extract_nomina_data',
  description: 'Extrae los datos financieros de una nómina española para comparar la retención IRPF',
  input_schema: {
    type: 'object' as const,
    properties: {
      period: {
        type: 'string',
        description: 'Período de liquidación, ej. "enero 2025" o "12/2024"',
      },
      fiscalYear: {
        type: 'integer',
        description: 'Año fiscal al que corresponde la nómina (ej. 2025)',
      },
      numberOfPayments: {
        type: 'integer',
        description: 'Número de pagas anuales: 14 si hay pagas extras, 12 si no. Omitir si no está claro.',
      },
      monthlyGross: {
        type: 'number',
        description: 'Total Devengado del período (suma de todos los devengos), en euros',
      },
      annualGross: {
        type: 'number',
        description: 'Salario bruto anual acumulado si aparece explícitamente en la nómina, en euros',
      },
      monthlyBaseIRPF: {
        type: 'number',
        description:
          'Base I.R.P.F. del período — base sujeta a retención IRPF, sin retribuciones exentas (ticket restaurante, seguro médico, etc.). ' +
          'Suele aparecer en la sección "Bases de Cotización/Retención" con la etiqueta "Base I.R.P.F.", "Base Retención" o similar. ' +
          'Puede ser inferior al Total Devengado. Solo extrae este campo si aparece explícitamente.',
      },
      monthlyRetenciones: {
        type: 'number',
        description: 'Importe de retención IRPF este período (Concepto 999 / "Tributación I.R.P.F."), en euros',
      },
      annualRetenciones: {
        type: 'number',
        description: 'Total IRPF retenido acumulado anual si aparece en la nómina, en euros',
      },
      retentionPercentage: {
        type: 'number',
        description: 'Tipo de retención IRPF aplicado en porcentaje (ej. 15.5 para 15,5%)',
      },
      monthlySS_CC: {
        type: 'number',
        description: 'Cuota de Contingencias Comunes del trabajador este período, en euros',
      },
      monthlySS_MEI: {
        type: 'number',
        description: 'Cuota MEI (Mecanismo de Equidad Intergeneracional) del trabajador, en euros',
      },
      monthlySS_unemployment: {
        type: 'number',
        description: 'Cuota de Desempleo del trabajador este período, en euros',
      },
      monthlySS_vocational: {
        type: 'number',
        description: 'Cuota de Formación Profesional del trabajador, en euros',
      },
      monthlySSEmployee: {
        type: 'number',
        description: 'Total cuotas SS del trabajador si no aparecen desglosadas en los campos anteriores, en euros',
      },
      monthlySalarioBase: {
        type: 'number',
        description: 'Salario base del período (el concepto "Salario Base" o "Sueldo Base"), en euros. No incluir complementos ni otros conceptos.',
      },
      monthlyRetribucionEspecie: {
        type: 'number',
        description:
          'Retribución en especie incluida en el Total Devengado (seguro médico empresa, coche de empresa, tickets guardería, etc.), en euros. ' +
          'Solo si aparece explícitamente como "Retribución en especie", "Retrib. Especie", "R. Especie" u otro concepto claramente identificable como especie.',
      },
      monthlyDietas: {
        type: 'number',
        description:
          'Dietas y asignaciones para gastos de viaje/manutención del período, en euros. ' +
          'Busca conceptos como "Dietas", "Plus transporte", "Plus distancia", "Gastos viaje", "Manutención". ' +
          'Solo si aparece explícitamente.',
      },
      monthlyAnticipo: {
        type: 'number',
        description: 'Anticipo o adelanto de nómina descontado en este período, en euros. Busca "Anticipo", "Adelanto s/nómina".',
      },
    },
    // All fields optional — only extract what's clearly present
  },
};

export async function parseNomina(
  pdfText: string,
  client?: InstanceType<typeof Anthropic>,
): Promise<NominaData> {
  const anthropic = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: NOMINA_PARSER_SYSTEM_PROMPT,
    tools: [PARSE_NOMINA_TOOL],
    tool_choice: { type: 'auto' },
    messages: [
      {
        role: 'user',
        content: `Extrae los datos financieros de esta nómina:\n\n${pdfText}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is ToolUseBlock =>
      block.type === 'tool_use' && block.name === 'extract_nomina_data',
  );

  if (!toolUse) {
    // Model couldn't find extractable data
    return {};
  }

  return toolUse.input as NominaData;
}
