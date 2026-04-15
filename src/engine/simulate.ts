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

      // §3.6.4 Pipeline: augment P[t] with current R&D spend first, then read lag reference.
      // R&D at year t is invested immediately into the pipeline. The lag λ measures
      // the time from investment until conversion begins, so P[t-λ] (post-R&D) is used.
      pipeline[i][t] += line.rdProductivity * rd
      const laggedPipelineIndex = t - line.rdLag
      const pipelineMaturing = laggedPipelineIndex >= 0 ? pipeline[i][laggedPipelineIndex] : 0
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
        (_, t) => scenario.rockSupply[t] * share * (1 / scenario.businessLines[i].yield),
      ),
    ),
    capex: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
    rd: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
  }
}

/**
 * Build the "steady-state" default policy used on first load.
 *
 * Rock is held at each line's initial run-rate (K_{i,0} / η_i) across all years —
 * the same baseline the PM reference spreadsheet and calibration test use. This ensures
 * every line produces at its initial capacity in year 0 and the rock supply constraint
 * is satisfied from day one. Capex and R&D are zero, which is intentional: the default
 * view shows what happens if SPS does not invest. That is a deliberate strategic
 * signal (doing nothing destroys value), not a bug.
 *
 * Note on initial leverage: the initial debt-to-EBITDA ratio (D₀ / EBITDA₀) may
 * exceed the leverage ceiling in the first few years purely because of the starting
 * capital structure — no policy choice can change D₀. The leverage constraint
 * transitions to green once debt is paid down sufficiently through accumulated FCF.
 * See README.md §"Understanding the default view" for context.
 */
export function buildSteadyStatePolicy(scenario: Scenario): Policy {
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
