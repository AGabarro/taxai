import type { TaxInput } from '@taxai/shared';

// All constants in cents (euros × 100)
const PERSONAL_BASE = 555_000;        // €5,550
const PERSONAL_AGE_65 = 115_000;      // +€1,150 for age 65–74
const PERSONAL_AGE_75 = 140_000;      // additional +€1,400 for age ≥75 (on top of AGE_65)

// Art. 60 — mínimo por discapacidad del contribuyente
const DISABILITY_BASE = 300_000;      // +€3,000 for taxpayer disability ≥ 33%
const DISABILITY_SEVERE = 900_000;    // +€9,000 for taxpayer disability ≥ 65%

const CHILD_1ST = 240_000;            // €2,400 — 1st child under 25
const CHILD_2ND = 270_000;            // €2,700 — 2nd child
const CHILD_3RD = 400_000;            // €4,000 — 3rd child
const CHILD_4TH_PLUS = 450_000;       // €4,500 — 4th child and beyond (2025 Ley 5/2025)
const CHILD_UNDER_3_SUPPLEMENT = 280_000;  // +€2,800 per child under 3

const ASCENDANT_OVER_65 = 115_000;    // €1,150 per ascendant over 65

// Art. 60.2 — mínimo por discapacidad de ascendientes/descendientes
const DEP_DISABILITY_33 = 300_000;    // +€3,000 per dependent with disability ≥ 33% < 65%
const DEP_DISABILITY_65 = 900_000;    // +€9,000 per dependent with disability ≥ 65%

/**
 * Calculates the mínimo personal y familiar (Art. 57–61 LIRPF).
 * Returns value in cents.
 */
export function calcMinimumPersonalFamiliar(input: TaxInput): number {
  let minimumCents = PERSONAL_BASE;

  // Mínimo por edad del contribuyente
  if (input.age >= 75) {
    minimumCents += PERSONAL_AGE_65 + PERSONAL_AGE_75;
  } else if (input.age >= 65) {
    minimumCents += PERSONAL_AGE_65;
  }

  // Art. 60.1 — mínimo por discapacidad del contribuyente
  if (input.disability) {
    minimumCents += input.disability >= 65 ? DISABILITY_SEVERE : DISABILITY_BASE;
  }

  // Mínimo por descendientes (under 25, living with taxpayer)
  const n = input.dependentsUnder25;
  if (n >= 1) minimumCents += CHILD_1ST;
  if (n >= 2) minimumCents += CHILD_2ND;
  if (n >= 3) minimumCents += CHILD_3RD;
  // 4th child and beyond
  for (let i = 4; i <= n; i++) {
    minimumCents += CHILD_4TH_PLUS;
  }

  // Supplement for children under 3
  const under3 = input.dependentsUnder3 ?? 0;
  minimumCents += under3 * CHILD_UNDER_3_SUPPLEMENT;

  // Mínimo por ascendientes (over 65)
  minimumCents += input.dependentsOver65 * ASCENDANT_OVER_65;

  // Art. 60.2 — mínimo por discapacidad de familiares (dependientes)
  minimumCents += (input.dependentsDisability33 ?? 0) * DEP_DISABILITY_33;
  minimumCents += (input.dependentsDisability65 ?? 0) * DEP_DISABILITY_65;

  return minimumCents;
}
