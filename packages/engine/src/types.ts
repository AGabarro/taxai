export interface Bracket {
  from: number;    // euros
  to: number | null;
  rate: number;    // decimal, e.g. 0.095 = 9.5%
}

export interface TrabajoReductions {
  fullReductionThreshold: number;  // euros
  maxReduction: number;            // euros
  // 2024 legacy fields
  baseReduction?: number;          // euros
  phaseOutStart?: number;          // euros
  phaseOutEnd?: number;            // euros
  // 2025 fields (Ley 5/2025 two-segment phase-out)
  gastoFlatDeduction?: number;     // euros — flat gasto deducible (default €2,000)
  phaseOutSegment1End?: number;    // euros — end of segment 1 phase-out
  phaseOutRate1?: number;          // rate for segment 1 phase-out
  phaseOutSegment2End?: number;    // euros — end of segment 2 phase-out
  phaseOutRate2?: number;          // rate for segment 2 phase-out
  segment2BaseReduction?: number;  // euros — base reduction at start of segment 2
}

export interface RegionRules {
  region: string;
  fiscalYear: number;
  autonomicBrackets: Bracket[];
  trabajoReductions: TrabajoReductions;
}

export interface StateRules {
  region: 'state';
  fiscalYear: number;
  stateBrackets: Bracket[];
}
