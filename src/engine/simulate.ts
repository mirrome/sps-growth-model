/**
 * Core forward simulator — pure function.
 *
 * Implements the simulation loop from §7.1 of the requirements document.
 * Takes a Scenario and a Policy, returns a SimResult with all time series.
 *
 * This function has no side effects and no global state. It can be called
 * thousands of times concurrently for Monte Carlo or optimizer use in v2.
 */

import type { Scenario, Policy, SimResult, LineResult, SimWarning } from './types'
import { computeWACC, computeFCF, computeTerminalValue, computeNPV } from './finance'

/** Floor to prevent division by zero in price update (§3.6.5) */
const Q_MIN = 1.0

/** Tiny epsilon for guard-zero division */
const EPSILON = 1e-10

export function simulate(scenario: Scenario, policy: Policy): SimResult {
  const { corporate: corp, businessLines: lines } = scenario
  const T = scenario.meta.horizonYears
  const N = lines.length
  const warnings: SimWarning[] = []

  // Initialize state arrays — one row per line, T+1 columns
  const capacity: number[][] = lines.map((l) => {
    const row = new Array<number>(T + 1).fill(0)
    row[0] = l.initialCapacity
    return row
  })

  const pipeline: number[][] = lines.map((l) => {
    const row = new Array<number>(T + 1).fill(0)
    row[0] = l.initialPipeline
    return row
  })

  // Opening-of-year pipeline values — recorded before each year's R&D spend is added.
  // The requirements formula P_{t+1} = P_t + μX_t − φP_{t−λ} uses P_{t−λ} as the
  // opening balance at year t−λ (before that year's R&D), not the intra-year
  // post-R&D value. Storing opening values separately avoids reading a pipeline[t−λ]
  // that has already been augmented with year-(t−λ) R&D spend.
  const pipelineOpening: number[][] = Array.from({ length: N }, () =>
    new Array<number>(T + 1).fill(0),
  )

  const cumulativeVolume: number[][] = lines.map((l) => {
    const row = new Array<number>(T + 1).fill(0)
    row[0] = l.baseCumulativeVolume
    return row
  })

  const unitCost: number[][] = lines.map((l) => {
    const row = new Array<number>(T + 1).fill(0)
    row[0] = l.baseUnitCost
    return row
  })

  const unitPrice: number[][] = lines.map((l) => {
    const row = new Array<number>(T + 1).fill(0)
    row[0] = l.basePrice
    return row
  })

  // Per-year, per-line outputs
  const output: number[][] = Array.from({ length: N }, () => new Array<number>(T + 1).fill(0))
  const revenue: number[][] = Array.from({ length: N }, () => new Array<number>(T + 1).fill(0))
  const cogs: number[][] = Array.from({ length: N }, () => new Array<number>(T + 1).fill(0))
  const ebitdaLine: number[][] = Array.from({ length: N }, () => new Array<number>(T + 1).fill(0))
  const launchedRevenue: number[][] = Array.from({ length: N }, () =>
    new Array<number>(T + 1).fill(0),
  )
  const bindingConstraint: ('capacity' | 'rock' | 'neither')[][] = Array.from({ length: N }, () =>
    new Array<'capacity' | 'rock' | 'neither'>(T + 1).fill('neither'),
  )

  const ebitdaTotal: number[] = new Array<number>(T + 1).fill(0)
  const fcf: number[] = new Array<number>(T + 1).fill(0)
  const debt: number[] = new Array<number>(T + 1).fill(0)
  debt[0] = corp.debt0

  const wacc = computeWACC(corp)

  for (let t = 0; t <= T; t++) {
    let ebitdaSum = 0
    let totalCapex = 0

    for (let i = 0; i < N; i++) {
      const line = lines[i]
      const rock = policy.rock[i][t]
      const capex = policy.capex[i][t]
      const rd = policy.rd[i][t]

      // §3.6.2 Production: Q_{i,t} = min(K_{i,t}, η_i · r_{i,t})
      const rockConstrained = line.yield * rock
      const cap = capacity[i][t]
      const Q = Math.min(cap, rockConstrained)
      output[i][t] = Q

      // Track binding constraint
      if (rockConstrained < cap) {
        bindingConstraint[i][t] = 'rock'
      } else if (cap < rockConstrained) {
        bindingConstraint[i][t] = 'capacity'
      } else {
        bindingConstraint[i][t] = 'neither'
      }

      // §3.6.4 Pipeline: record opening balance, then augment with R&D.
      // The lag reference P[t−λ] in the requirements formula refers to the OPENING
      // pipeline at year t−λ (before that year's R&D spend). Reading pipeline[t−λ]
      // after it has already been augmented with year-(t−λ) R&D would overcount the
      // pipeline available to mature. By recording pipelineOpening[t] before the
      // in-place R&D update, the lagged read always sees the correct opening value.
      pipelineOpening[i][t] = pipeline[i][t]
      pipeline[i][t] += line.rdProductivity * rd
      const laggedPipelineIndex = t - line.rdLag
      const pipelineMaturing =
        laggedPipelineIndex >= 0 ? pipelineOpening[i][laggedPipelineIndex] : 0
      const dRev = line.rdConversion * pipelineMaturing
      launchedRevenue[i][t] = dRev

      // §3.6.6 Revenue and COGS
      const p = unitPrice[i][t]
      const c = unitCost[i][t]
      revenue[i][t] = p * Q
      cogs[i][t] = c * Q

      // §3.6.6 EBITDA_i
      const opex = line.opex[t] ?? line.opex[line.opex.length - 1]
      ebitdaLine[i][t] = revenue[i][t] - cogs[i][t] - opex - rd
      ebitdaSum += ebitdaLine[i][t]
      totalCapex += capex

      // --- State updates for t+1 ---
      if (t < T) {
        // §3.6.1 Capacity accumulation: K[t+1] = (1-δ)·K[t] + I[t+1-τ]/κ
        // Capex invested at year s arrives as capacity at year s+τ (lead time τ years).
        // When computing K[t+1], the arriving capex is I[(t+1)-τ] = I[t+1-buildLeadTime].
        const capexArrivingIndex = t + 1 - line.buildLeadTime
        const capexArriving = capexArrivingIndex >= 0 ? policy.capex[i][capexArrivingIndex] : 0
        const newCap = (1 - line.capacityDepreciation) * cap + capexArriving / line.capexUnitCost
        capacity[i][t + 1] = clampNonNegative(newCap, i, t + 1, 'capacity', warnings)

        // §3.6.3 Cumulative volume
        const newCV = cumulativeVolume[i][t] + Q
        cumulativeVolume[i][t + 1] = newCV

        // §3.6.3 Unit cost learning curve: c_{i,t} = c_{i,0}·(V_{i,t}/V_{i,0})^(-β_i)
        const cvRatio = newCV / Math.max(line.baseCumulativeVolume, EPSILON)
        unitCost[i][t + 1] = line.baseUnitCost * Math.pow(cvRatio, -line.learningExponent)

        // §3.6.4 Pipeline update: P[t+1] = P[t] - φ·P[t-λ]
        // (P[t] was already augmented by R&D at the start of this iteration)
        //
        // The drain φ·P[t-λ] is based on a lagged value that may exceed the current
        // pipeline in late years with low or zero R&D (products maturing from a larger
        // past pipeline). This is correct model behaviour: those products were committed
        // λ years ago and convert regardless of the current pipeline level. The result
        // is floored at 0 silently — pipeline reaching zero during a harvest-only policy
        // is expected depletion, not a parameter error, so no diagnostic warning is emitted.
        const newPipeline = pipeline[i][t] - line.rdConversion * pipelineMaturing
        pipeline[i][t + 1] = Math.max(0, newPipeline)

        // §3.6.5 Price dynamics: p_{i,t+1} = p_{i,t}·(1−π_i) + ΔRev_{i,t}/max(Q_{i,t}, Q_min)
        unitPrice[i][t + 1] = p * (1 - line.priceErosion) + dRev / Math.max(Q, Q_MIN)
      }
    }

    ebitdaTotal[t] = ebitdaSum

    // §3.6.7 Free cash flow
    const dep = corp.depreciation[t] ?? corp.depreciation[corp.depreciation.length - 1]
    fcf[t] = computeFCF(ebitdaSum, corp.taxRate, dep, totalCapex)

    // Debt tracking (simplified: debt adjusts to meet capex beyond FCF, subject to leverage)
    if (t < T) {
      const retainedCash = Math.max(fcf[t], 0)
      const capexGap = totalCapex - retainedCash
      if (capexGap > 0) {
        const proposedDebt = debt[t] + capexGap
        const maxDebt = ebitdaSum > 0 ? corp.leverageMax * ebitdaSum : debt[t]
        debt[t + 1] = Math.min(proposedDebt, maxDebt)
      } else {
        debt[t + 1] = Math.max(0, debt[t] - -capexGap * 0.5)
      }
    }
  }

  const terminalValue = computeTerminalValue(fcf[T], wacc, corp.terminalGrowth)
  const { npv, npvExTV } = computeNPV(fcf, wacc, terminalValue)

  // Build per-line results
  const lineResults: LineResult[] = lines.map((_, i) => ({
    capacity: capacity[i],
    output: output[i],
    cumulativeVolume: cumulativeVolume[i],
    unitCost: unitCost[i],
    unitPrice: unitPrice[i],
    pipeline: pipeline[i],
    revenue: revenue[i],
    cogs: cogs[i],
    ebitda: ebitdaLine[i],
    launchedRevenue: launchedRevenue[i],
    bindingConstraint: bindingConstraint[i],
  }))

  return {
    lines: lineResults,
    ebitda: ebitdaTotal,
    fcf,
    debt,
    wacc,
    terminalValue,
    npv,
    npvExTV,
    warnings,
  }
}

/** Clamp a value to zero and emit a warning if negative. */
function clampNonNegative(
  value: number,
  lineIndex: number,
  year: number,
  quantity: string,
  warnings: SimWarning[],
): number {
  if (!isFinite(value) || value < 0) {
    warnings.push({
      type: 'negative_accumulator',
      message: `${quantity} for line ${lineIndex} in year ${year} was ${value.toFixed(4)}, clamped to 0`,
      lineIndex,
      year,
      quantity,
    })
    return 0
  }
  return value
}

/** Build a zero policy for a given scenario (all allocations spread equally). */
export function buildEqualPolicy(scenario: Scenario): Policy {
  const T = scenario.meta.horizonYears
  const N = scenario.businessLines.length
  const share = 1 / N

  return {
    rock: scenario.businessLines.map((_, i) =>
      Array.from(
        { length: T + 1 },
        (_, t) => scenario.supply[t] * share * (1 / scenario.businessLines[i].yield),
      ),
    ),
    capex: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
    rd: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
  }
}

/**
 * Build the calibration baseline policy — rock at each line's initial run-rate,
 * zero capex, zero R&D.
 *
 * This is the exact policy the PM reference spreadsheet implements, and the
 * calibration test (reference/calibration/calibration.test.ts) runs against it.
 * It is NOT the default UI policy; that role belongs to buildGrowthBaselinePolicy.
 * Keeping this function ensures the calibration test remains independent of any
 * future changes to the default UI policy.
 *
 * Formerly named buildSteadyStatePolicy.
 */
export function buildCalibrationPolicy(scenario: Scenario): Policy {
  const T = scenario.meta.horizonYears
  const N = scenario.businessLines.length

  return {
    rock: scenario.businessLines.map((line) => {
      const r = line.initialCapacity / line.yield
      return new Array<number>(T + 1).fill(r)
    }),
    capex: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
    rd: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
  }
}

/**
 * Build the growth baseline policy shown when the tool first loads.
 *
 * Rock ramps toward OCP strategic targets, capex builds capacity while
 * respecting the debt-raising gate in years 0-1, and R&D sustains the
 * product development pipeline across all six lines.
 *
 * Arrays are hardcoded for the six-line illustrative and OCP v1 scenarios
 * (both share the same six lines in the same order with the same short codes).
 * Lines are looked up by shortCode; if a scenario introduces a new line code
 * this function throws, which is the correct behaviour — update the arrays
 * and bump the schema version rather than silently applying zeros.
 */
export function buildGrowthBaselinePolicy(scenario: Scenario): Policy {
  // Supply allocation by line by year (kt/yr). ECR v2 April 2026.
  // Shares: USS 50%, SPN 15%, FIS 5%, EMS 8%, ANS 12%, NPS 10%.
  // Values = share × supply[t] for all t (100% allocation, no waste).
  // Y0–Y7 from SPS_Growth_Model_Params.xlsx; Y8–Y10 extended at supply growth rates.
  const rock: Record<string, number[]> = {
    USS: [
      650, 663, 696.15, 737.919, 782.194, 860.4135, 972.2675, 1118.1075, 1274.6425, 1516.8245,
      1820.1895,
    ],
    SPN: [
      195, 198.9, 208.845, 221.3757, 234.6582, 258.12405, 291.68025, 335.43225, 382.39275,
      455.04735, 546.05685,
    ],
    FIS: [
      65, 66.3, 69.615, 73.7919, 78.2194, 86.04135, 97.22675, 111.81075, 127.46425, 151.68245,
      182.01895,
    ],
    EMS: [
      104, 106.08, 111.384, 118.06704, 125.15104, 137.66616, 155.5628, 178.8972, 203.9428,
      242.69192, 291.23032,
    ],
    ANS: [
      156, 159.12, 167.076, 177.10056, 187.72656, 206.49924, 233.3442, 268.3458, 305.9142,
      364.03788, 436.84548,
    ],
    NPS: [
      130, 132.6, 139.23, 147.5838, 156.4388, 172.0827, 194.4535, 223.6215, 254.9285, 303.3649,
      364.0379,
    ],
  }

  // Capex by line by year ($M). ECR v2 April 2026.
  // Y0–Y7 from "current Capex Alloc" sheet of SPS_Growth_Model_Params.xlsx.
  // Y8–Y10 extended at 15% annual taper from Y7, floored at 10 per line.
  // Note: SPN Y3 = 4 is intentional (construction phasing gap per ECR §6.1).
  const capex: Record<string, number[]> = {
    USS: [25, 25, 50, 55, 65, 60, 55, 45, 38, 32, 27],
    SPN: [16, 16, 35, 4, 45, 40, 40, 30, 26, 22, 19],
    FIS: [12, 12, 25, 30, 35, 35, 30, 25, 21, 18, 15],
    EMS: [16, 16, 30, 35, 40, 35, 30, 25, 21, 18, 15],
    ANS: [29, 29, 55, 65, 75, 70, 60, 55, 47, 40, 34],
    NPS: [17, 17, 25, 35, 35, 40, 35, 30, 26, 22, 19],
  }

  // R&D by line by year ($M). ECR v2 April 2026.
  // Y0–Y7 from SPS_Growth_Model_Params.xlsx (70–85% reduction vs old budget).
  // Y8–Y10 extended at supply growth rates (×1.14, ×1.19, ×1.20).
  const rd: Record<string, number[]> = {
    USS: [5, 5.1, 5.36, 3.97, 3.61, 4.63, 4.49, 4.3, 4.9, 5.83, 7],
    SPN: [1.5, 1.53, 1.61, 1.7, 1.81, 1.99, 2.24, 2.58, 2.94, 3.5, 4.2],
    FIS: [1.5, 0.51, 0.54, 2.27, 2.41, 2.65, 2.99, 3.44, 3.92, 4.66, 5.59],
    EMS: [0.8, 0.82, 0.86, 0.91, 1.56, 1.32, 1.94, 3.44, 3.92, 4.66, 5.59],
    ANS: [0, 1.22, 1.29, 1.36, 1.44, 1.32, 1.8, 1.72, 1.96, 2.33, 2.8],
    NPS: [1, 1.02, 1.07, 1.14, 1.2, 1.32, 1.5, 1.72, 1.96, 2.33, 2.8],
  }

  return {
    rock: scenario.businessLines.map((l) => {
      const arr = rock[l.shortCode]
      if (!arr) throw new Error(`buildGrowthBaselinePolicy: unknown shortCode "${l.shortCode}"`)
      return arr
    }),
    capex: scenario.businessLines.map((l) => {
      const arr = capex[l.shortCode]
      if (!arr) throw new Error(`buildGrowthBaselinePolicy: unknown shortCode "${l.shortCode}"`)
      return arr
    }),
    rd: scenario.businessLines.map((l) => {
      const arr = rd[l.shortCode]
      if (!arr) throw new Error(`buildGrowthBaselinePolicy: unknown shortCode "${l.shortCode}"`)
      return arr
    }),
  }
}
