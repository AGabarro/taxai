import Anthropic from '@anthropic-ai/sdk';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages.js';
import type { TaxInput, SpanishRegion, CivilStatus, DisabilityGrade } from '@taxai/shared';
import { EXTRACTOR_SYSTEM_PROMPT } from './prompts.js';

// PII patterns — DNI/NIE and IBAN
const PII_PATTERNS = [
  /\b\d{8}[A-Za-z]\b/,           // DNI
  /\b[XYZ]\d{7}[A-Za-z]\b/,      // NIE
  /\bES\d{22}\b/,                 // IBAN
];

export class PiiDetectedError extends Error {
  constructor() {
    super('PII detected in input');
    this.name = 'PiiDetectedError';
  }
}

function detectPii(message: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(message));
}

const VALID_REGIONS: SpanishRegion[] = [
  'andalusia', 'aragon', 'asturias', 'balearics', 'canarias', 'cantabria',
  'castilla-la-mancha', 'castilla-leon', 'catalonia', 'extremadura', 'galicia',
  'la-rioja', 'madrid', 'murcia', 'navarra', 'pais-vasco', 'valenciana',
];

const VALID_CIVIL_STATUS: CivilStatus[] = ['single', 'married', 'widowed', 'separated'];
const VALID_DISABILITY: DisabilityGrade[] = [33, 65];

// Tool definition for structured extraction
const EXTRACT_TOOL: Tool = {
  name: 'extract_tax_data',
  description: 'Extrae los datos fiscales del mensaje del usuario para el cálculo del IRPF',
  input_schema: {
    type: 'object' as const,
    properties: {
      fiscalYear: {
        type: 'integer',
        description: 'Año fiscal del que se declara (ej. 2024)',
      },
      region: {
        type: 'string',
        enum: VALID_REGIONS,
        description: 'Comunidad autónoma del contribuyente',
      },
      age: {
        type: 'integer',
        description: 'Edad del contribuyente en años',
      },
      grossSalary: {
        type: 'number',
        description: 'Salario bruto anual en euros (rendimientos del trabajo)',
      },
      otherIncome: {
        type: 'number',
        description: 'Otros rendimientos (capital mobiliario, etc.) en euros',
      },
      retenciones: {
        type: 'number',
        description: 'Total de retenciones a cuenta ya practicadas en euros',
      },
      dependentsUnder25: {
        type: 'integer',
        description: 'Número de hijos o descendientes menores de 25 años que conviven con el contribuyente',
      },
      dependentsOver65: {
        type: 'integer',
        description: 'Número de ascendientes mayores de 65 años que conviven con el contribuyente',
      },
      civilStatus: {
        type: 'string',
        enum: VALID_CIVIL_STATUS,
        description: 'Estado civil: single (soltero/a), married (casado/a), widowed (viudo/a), separated (separado/a)',
      },
      disability: {
        type: 'integer',
        enum: VALID_DISABILITY,
        description: 'Grado de discapacidad reconocida: 33 o 65 (porcentaje)',
      },
    },
    // No required fields — only include what the user explicitly mentioned
  },
};

export async function extractTaxInput(
  message: string,
  client?: InstanceType<typeof Anthropic>,
): Promise<Partial<TaxInput>> {
  if (detectPii(message)) {
    throw new PiiDetectedError();
  }

  const anthropic = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: EXTRACTOR_SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: message }],
  });

  // Find tool use block
  const toolUse = response.content.find((block): block is ToolUseBlock =>
    block.type === 'tool_use' && block.name === 'extract_tax_data',
  );

  if (!toolUse) {
    // Model responded without using the tool (e.g. no extractable data)
    return {};
  }

  // The tool input is already a partial TaxInput-shaped object
  return toolUse.input as Partial<TaxInput>;
}
