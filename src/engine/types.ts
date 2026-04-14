/**
 * Shared TypeScript interfaces for the SPS Growth Model simulation engine.
 *
 * Notation follows Section 3 of SPS_Growth_Model_Requirements.md.
 * Index i = business line (0-based), index t = year (0 = base year).
 * All monetary values in USD millions. All physical volumes in kilotons per year.
 */

/** Schema version — loader rejects files with a different version. */
export const CURRENT_SCHEMA_VERSION = 1

/** Per-line parameters loaded from the scenario file. */
export interface BusinessLineParams {
  name: string
  shortCode: string
  isLegacy: boolean

  /** η_i — kilotons of product output per kiloton of rock input */
  yield: number
  /** κ_i — capex cost per unit of new capacity (USD millions per ktpa) */
  capexUnitCost: number
  /** τ_i — construction lead time in years */
  buildLeadTime: number
  /** δ_i — annual capacity depreciation rate */
  capacityDepreciation: number

  /** c_{i,0} — baseline unit production cost (USD millions per kt) */
  baseUnitCost: number
  /** β_i — learning curve exponent */
  learningExponent: number
  /** V_{i,0} — baseline cumulative volume for learning curve (kt) */
  baseCumulativeVolume: number

  /** p_{i,0} — baseline unit selling price (USD millions per kt) */
  basePrice: number
  /** π_i — annual price erosion rate */
  priceErosion: number

  /** μ_i — R&D productivity: latent revenue per USD of R&D spend */
  rdProductivity: number
  /** λ_i — R&D maturation lag in years */
  rdLag: number
  /** φ_i — annual conversion rate of mature pipeline to launched revenue */
  rdConversion: number

  /** F_i — minimum production floor for legacy lines (kt/yr) */
  legacyFloor: number

  /** OpEx_{i,t} — fixed operating expense by year (USD millions), length T+1 */
  opex: number[]

  /** K_{i,0} — initial installed capacity (kt/yr) */
  initialCapacity: number
  /** P_{i,0} — initial pipeline value (USD millions of latent revenue) */
  initialPipeline: number
}

/** Corporate-level parameters loaded from the scenario file. */
export interface CorporateParams {
  /** T_c — corporate tax rate */
  taxRate: number
  /** r_D — cost of debt */
  rD: number
  /** r_E — cost of equity */
  rE: number
  /** E_0 — starting equity value (USD millions) */
  equity0: number
  /** D_0 — starting debt (USD millions) */
  debt0: number
  /** L_max — maximum debt-to-EBITDA ratio */
  leverageMax: number
  /** g_T — terminal growth rate */
  terminalGrowth: number
  /** Dep_t — tax depreciation by year (USD millions), length T+1 */
  depreciation: number[]
}

/** Top-level scenario file structure. */
export interface Scenario {
  schemaVersion: number
  meta: {
    name: string
    description?: string
    horizonYears: number
    isIllustrative: boolean
  }
  corporate: CorporateParams
  /** S_t — rock supply by year (kt/yr), length T+1 */
  rockSupply: number[]
  businessLines: BusinessLineParams[]
}

/**
 * Decision variables set by the user for each line and each year.
 * Arrays are indexed [lineIndex][year], length businessLines × (T+1).
 */
export interface Policy {
  /** r_{i,t} — rock allocated to line i in year t (kt/yr) */
  rock: number[][]
  /** I_{i,t} — capex in line i in year t (USD millions) */
  capex: number[][]
  /** R_{i,t} — R&D spending in line i in year t (USD millions) */
  rd: number[][]
}

/** Time-series state for a single business line. Arrays of length T+1. */
export interface LineResult {
  /** K_{i,t} — installed capacity (kt/yr) */
  capacity: number[]
  /** Q_{i,t} — output volume (kt/yr) */
  output: number[]
  /** V_{i,t} — cumulative volume (kt) */
  cumulativeVolume: number[]
  /** c_{i,t} — unit cost (USD millions/kt) */
  unitCost: number[]
  /** p_{i,t} — unit price (USD millions/kt) */
  unitPrice: number[]
  /** P_{i,t} — pipeline value (USD millions latent revenue) */
  pipeline: number[]
  /** Rev_{i,t} — revenue (USD millions) */
  revenue: number[]
  /** COGS_{i,t} — cost of goods sold (USD millions) */
  cogs: number[]
  /** EBITDA_{i,t} — line-level EBITDA (USD millions) */
  ebitda: number[]
  /** ΔRev_{i,t} — launched revenue from pipeline (USD millions) */
  launchedRevenue: number[]
  /** Whether capacity or rock is the binding constraint each year */
  bindingConstraint: ('capacity' | 'rock' | 'neither')[]
}

/** Aggregated simulation result returned by simulate(). */
export interface SimResult {
  lines: LineResult[]
  /** EBITDA_t — total firm EBITDA by year (USD millions) */
  ebitda: number[]
  /** FCF_t — free cash flow by year (USD millions) */
  fcf: number[]
  /** D_t — debt outstanding by year (USD millions) */
  debt: number[]
  /** WACC — weighted average cost of capital (constant in v1) */
  wacc: number
  /** TV_T — terminal value (USD millions) */
  terminalValue: number
  /** NPV including terminal value (USD millions) */
  npv: number
  /** NPV excluding terminal value (USD millions) */
  npvExTV: number
  /** Diagnostic warnings produced during simulation */
  warnings: SimWarning[]
}

/** A named diagnostic warning from the simulator. */
export interface SimWarning {
  type: 'negative_accumulator' | 'nan_clamped' | 'constraint_implicit'
  message: string
  lineIndex?: number
  year?: number
  quantity?: string
}

/** Status of a single constraint in a single year. */
export interface ConstraintYearStatus {
  satisfied: boolean
  /** Positive = slack (headroom). Negative = violation magnitude. */
  slack: number
  value: number
  limit: number
}

/** Full constraint evaluation result across all years. */
export interface ConstraintStatus {
  rockSupply: ConstraintYearStatus[]
  capexBudget: ConstraintYearStatus[]
  leverage: ConstraintYearStatus[]
  /** Indexed [lineIndex][year] for legacy lines only */
  legacyFloor: (ConstraintYearStatus | null)[][]
  capacity: ConstraintYearStatus[][]
  /** True if any constraint is violated in any year */
  anyViolation: boolean
}
