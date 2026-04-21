// Local copy of shared types — replace with `import from '@taxai/shared'` when [SIGNAL: shared-types-ready]

export interface TaxInput {
  fiscalYear: number
  region: SpanishRegion
  age: number
  grossSalary: number
  otherIncome?: number
  retenciones: number
  dependentsUnder25: number
  dependentsOver65: number
  civilStatus: CivilStatus
  disability?: DisabilityGrade
}

export type SpanishRegion =
  | 'andalusia'
  | 'aragon'
  | 'asturias'
  | 'balearics'
  | 'canarias'
  | 'cantabria'
  | 'castilla-la-mancha'
  | 'castilla-leon'
  | 'catalonia'
  | 'extremadura'
  | 'galicia'
  | 'la-rioja'
  | 'madrid'
  | 'murcia'
  | 'navarra'
  | 'pais-vasco'
  | 'valenciana'

export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated'
export type DisabilityGrade = 33 | 65

export interface TaxResult {
  fiscalYear: number
  region: SpanishRegion
  grossSalary: number

  rendimientoNetoReducido: number
  baseImponibleGeneral: number
  minimumPersonalFamiliar: number

  cuotaIntegraEstatal: number
  cuotaIntegraAutonomica: number
  cuotaIntegraTOTAL: number

  cuotaLiquidaEstatal: number
  cuotaLiquidaAutonomica: number
  cuotaLiquidaTOTAL: number

  retenciones: number
  resultAmount: number
  resultType: 'a_ingresar' | 'a_devolver' | 'cero'

  waterfallSteps: WaterfallStep[]
}

export interface WaterfallStep {
  label: string
  amount: number
  runningTotal: number
  bracketRate?: number
}
