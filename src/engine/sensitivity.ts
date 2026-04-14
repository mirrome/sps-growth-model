/**
 * Sensitivity analysis engine — §5.4 (tornado chart).
 *
 * Automatically evaluates every numeric parameter in the active scenario file
 * over a ±20% band and computes the NPV range induced by each parameter.
 *
 * Pure function: no side effects, no global state.
 */

import type { Scenario, Policy } from './types'
import { simulate } from './simulate'

export interface SensitivityParameter {
  id: string
  label: string
  baseValue: number
  lowValue: number
  highValue: number
  npvAtLow: number
  npvAtHigh: number
  npvRange: number
  npvBase: number
}

export interface SensitivityResult {
  baseNPV: number
  parameters: SensitivityParameter[]
}

const BAND = 0.2 // ±20%

/**
 * Run sensitivity analysis over all eligible numeric parameters.
 *
 * For each parameter:
 *   low  = base * (1 - BAND)
 *   high = base * (1 + BAND)
 *   npvRange = |NPV(high) - NPV(low)|
 *
 * Parameters with zero base value or near-zero range are excluded.
 */
export function runSensitivityAnalysis(scenario: Scenario, policy: Policy): SensitivityResult {
  const baseResult = simulate(scenario, policy)
  const baseNPV = baseResult.npv

  const parameters: SensitivityParameter[] = []

  // --- Corporate parameters ---
  const corp = scenario.corporate
  addParam(
    parameters,
    'taxRate',
    'Tax rate (T_c)',
    corp.taxRate,
    scenario,
    policy,
    baseNPV,
    (s, v) => ({ ...s, corporate: { ...s.corporate, taxRate: clamp(v, 0, 0.99) } }),
  )
  addParam(parameters, 'rD', 'Cost of debt (r_D)', corp.rD, scenario, policy, baseNPV, (s, v) => ({
    ...s,
    corporate: { ...s.corporate, rD: clamp(v, 0.001, 0.5) },
  }))
  addParam(
    parameters,
    'rE',
    'Cost of equity (r_E)',
    corp.rE,
    scenario,
    policy,
    baseNPV,
    (s, v) => ({ ...s, corporate: { ...s.corporate, rE: clamp(v, 0.001, 0.5) } }),
  )
  addParam(
    parameters,
    'leverageMax',
    'Leverage ceiling (L_max)',
    corp.leverageMax,
    scenario,
    policy,
    baseNPV,
    (s, v) => ({ ...s, corporate: { ...s.corporate, leverageMax: clamp(v, 0.1, 20) } }),
  )
  addParam(
    parameters,
    'terminalGrowth',
    'Terminal growth (g_T)',
    corp.terminalGrowth,
    scenario,
    policy,
    baseNPV,
    (s, v) => ({ ...s, corporate: { ...s.corporate, terminalGrowth: clamp(v, -0.1, 0.1) } }),
  )

  // --- Per-business-line parameters ---
  scenario.businessLines.forEach((line, i) => {
    const pfx = line.shortCode
    addParam(
      parameters,
      `${pfx}.basePrice`,
      `${pfx}: Base price (p₀)`,
      line.basePrice,
      scenario,
      policy,
      baseNPV,
      (s, v) => patchLine(s, i, { basePrice: clamp(v, 0.001, 100) }),
    )
    addParam(
      parameters,
      `${pfx}.priceErosion`,
      `${pfx}: Price erosion (π)`,
      line.priceErosion,
      scenario,
      policy,
      baseNPV,
      (s, v) => patchLine(s, i, { priceErosion: clamp(v, 0, 0.5) }),
    )
    addParam(
      parameters,
      `${pfx}.baseUnitCost`,
      `${pfx}: Base unit cost (c₀)`,
      line.baseUnitCost,
      scenario,
      policy,
      baseNPV,
      (s, v) => patchLine(s, i, { baseUnitCost: clamp(v, 0.001, 100) }),
    )
    addParam(
      parameters,
      `${pfx}.learningExp`,
      `${pfx}: Learning exponent (β)`,
      line.learningExponent,
      scenario,
      policy,
      baseNPV,
      (s, v) => patchLine(s, i, { learningExponent: clamp(v, 0, 1) }),
    )
    addParam(
      parameters,
      `${pfx}.yield`,
      `${pfx}: Yield (η)`,
      line.yield,
      scenario,
      policy,
      baseNPV,
      (s, v) => patchLine(s, i, { yield: clamp(v, 0.01, 1) }),
    )
    addParam(
      parameters,
      `${pfx}.rdProductivity`,
      `${pfx}: R&D productivity (μ)`,
      line.rdProductivity,
      scenario,
      policy,
      baseNPV,
      (s, v) => patchLine(s, i, { rdProductivity: clamp(v, 0, 10) }),
    )
    addParam(
      parameters,
      `${pfx}.rdConversion`,
      `${pfx}: R&D conversion (φ)`,
      line.rdConversion,
      scenario,
      policy,
      baseNPV,
      (s, v) => patchLine(s, i, { rdConversion: clamp(v, 0, 1) }),
    )
    addParam(
      parameters,
      `${pfx}.capexUnitCost`,
      `${pfx}: Capex unit cost (κ)`,
      line.capexUnitCost,
      scenario,
      policy,
      baseNPV,
      (s, v) => patchLine(s, i, { capexUnitCost: clamp(v, 0.001, 100) }),
    )
  })

  // Sort by NPV range descending
  parameters.sort((a, b) => b.npvRange - a.npvRange)

  return { baseNPV, parameters }
}

function addParam(
  out: SensitivityParameter[],
  id: string,
  label: string,
  baseValue: number,
  scenario: Scenario,
  policy: Policy,
  baseNPV: number,
  patch: (s: Scenario, v: number) => Scenario,
): void {
  if (baseValue === 0) return // skip zero-base params (no range to compute)

  const low = baseValue * (1 - BAND)
  const high = baseValue * (1 + BAND)

  const npvAtLow = simulate(patch(scenario, low), policy).npv
  const npvAtHigh = simulate(patch(scenario, high), policy).npv
  const npvRange = Math.abs(npvAtHigh - npvAtLow)

  if (npvRange < 0.01) return // too small to show

  out.push({
    id,
    label,
    baseValue,
    lowValue: low,
    highValue: high,
    npvAtLow,
    npvAtHigh,
    npvRange,
    npvBase: baseNPV,
  })
}

function patchLine(
  scenario: Scenario,
  lineIndex: number,
  patch: Partial<Scenario['businessLines'][number]>,
): Scenario {
  return {
    ...scenario,
    businessLines: scenario.businessLines.map((l, i) => (i === lineIndex ? { ...l, ...patch } : l)),
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}
