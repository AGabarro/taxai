export interface Bracket {
  from: number;    // euros
  to: number | null;
  rate: number;    // decimal, e.g. 0.095 = 9.5%
}

export interface TrabajoReductions {
  fullReductionThreshold: number;  // euros
  maxReduction: number;            // euros
  baseReduction: number;           // euros
  phaseOutStart: number;           // euros
  phaseOutEnd: number;             // euros
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
