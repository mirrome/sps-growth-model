/**
 * Constraint evaluator — checks all 5 constraint families from §3.8.
 *
 * Pure function: takes a Scenario, Policy, and SimResult,
 * returns ConstraintStatus with slack/violation for every year.
 */

import type { Scenario, Policy, SimResult, ConstraintStatus, ConstraintYearStatus } from './types'

/**
 * Evaluate all constraints for the given scenario, policy, and simulation result.
 *
 * Positive slack = constraint is satisfied with headroom.
 * Negative slack = constraint is violated by that magnitude.
 */
export function evaluateConstraints(
  scenario: Scenario,
  policy: Policy,
  result: SimResult,
): ConstraintStatus {
  const T = scenario.meta.horizonYears
  const N = scenario.businessLines.length

  // §3.8.1 Rock supply: Σ r_{i,t} ≤ S_t
  const rockSupply: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const totalRock = policy.rock.reduce((sum, lineRock) => sum + (lineRock[t] ?? 0), 0)
    const limit = scenario.rockSupply[t]
    return { satisfied: totalRock <= limit, slack: limit - totalRock, value: totalRock, limit }
  })

  // §3.8.2 Capex budget: Σ I_{i,t} ≤ C_t + ΔD_t
  // Simplified: total capex ≤ positive FCF + net new debt raised
  const capexBudget: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const totalCapex = policy.capex.reduce((sum, lineCx) => sum + (lineCx[t] ?? 0), 0)
    const cashAvailable = Math.max(result.fcf[t], 0)
    const debtPrev = t === 0 ? scenario.corporate.debt0 : result.debt[t - 1]
    const debtNow = result.debt[t]
    const newDebt = Math.max(debtNow - debtPrev, 0)
    const limit = cashAvailable + newDebt
    return {
      satisfied: totalCapex <= limit + 1e-6,
      slack: limit - totalCapex,
      value: totalCapex,
      limit,
    }
  })

  // §3.8.3 Leverage: D_t / EBITDA_t ≤ L_max
  const leverage: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const ebitda = result.ebitda[t]
    if (ebitda <= 0) {
      // Leverage is undefined or infinite when EBITDA ≤ 0; always flag as violated
      return {
        satisfied: false,
        slack: -Infinity,
        value: Infinity,
        limit: scenario.corporate.leverageMax,
      }
    }
    const ratio = result.debt[t] / ebitda
    const limit = scenario.corporate.leverageMax
    return { satisfied: ratio <= limit, slack: limit - ratio, value: ratio, limit }
  })

  // §3.8.4 Legacy service floor: Q_{i,t} ≥ F_i for legacy lines
  const legacyFloor: (ConstraintYearStatus | null)[][] = Array.from({ length: N }, (_, i) => {
    const line = scenario.businessLines[i]
    if (!line.isLegacy) return new Array<null>(T + 1).fill(null)
    return Array.from({ length: T + 1 }, (_, t) => {
      const Q = result.lines[i].output[t]
      const floor = line.legacyFloor
      return { satisfied: Q >= floor, slack: Q - floor, value: Q, limit: floor }
    })
  })

  // §3.8.5 Capacity: Q_{i,t} ≤ K_{i,t}
  const capacity: ConstraintYearStatus[][] = Array.from({ length: N }, (_, i) =>
    Array.from({ length: T + 1 }, (_, t) => {
      const Q = result.lines[i].output[t]
      const K = result.lines[i].capacity[t]
      return { satisfied: Q <= K + 1e-6, slack: K - Q, value: Q, limit: K }
    }),
  )

  const anyViolation =
    rockSupply.some((s) => !s.satisfied) ||
    capexBudget.some((s) => !s.satisfied) ||
    leverage.some((s) => !s.satisfied) ||
    legacyFloor.some((lineStatuses) => lineStatuses.some((s) => s !== null && !s.satisfied)) ||
    capacity.some((lineStatuses) => lineStatuses.some((s) => !s.satisfied))

  return { rockSupply, capexBudget, leverage, legacyFloor, capacity, anyViolation }
}
