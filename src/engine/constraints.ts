/**
 * Constraint evaluator — checks all constraint families from §3.8.
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

  // §3.8.2a Debt-raising gate: when canRaiseDebt[t] = false, the firm may not issue new debt,
  // so total capex is limited to internally generated cash (C_t = max(FCF_t, 0)).
  // Entries for years when canRaiseDebt[t] = true are always satisfied (limit = +∞).
  const debtGate: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const canRaise = scenario.corporate.canRaiseDebt?.[t] ?? true
    if (canRaise) {
      return { satisfied: true, slack: Infinity, value: 0, limit: Infinity }
    }
    const totalCapex = policy.capex.reduce((sum, lineCx) => sum + (lineCx[t] ?? 0), 0)
    const cashAvailable = Math.max(result.fcf[t], 0)
    return {
      satisfied: totalCapex <= cashAvailable + 1e-6,
      slack: cashAvailable - totalCapex,
      value: totalCapex,
      limit: cashAvailable,
    }
  })

  // §3.8.2b Capex budget: Σ I_{i,t} ≤ C_t + ΔD_t
  // When canRaiseDebt[t] = false: ΔD_t = 0 (same rule as debt gate, shown separately in UI).
  // When canRaiseDebt[t] = true: ΔD_t = net new debt raised in year t per the simulation.
  const capexBudget: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const totalCapex = policy.capex.reduce((sum, lineCx) => sum + (lineCx[t] ?? 0), 0)
    const cashAvailable = Math.max(result.fcf[t], 0)
    const canRaise = scenario.corporate.canRaiseDebt?.[t] ?? true

    if (!canRaise) {
      // No debt allowed — capex limit is cash-only (debtGate already surfaces this)
      return {
        satisfied: totalCapex <= cashAvailable + 1e-6,
        slack: cashAvailable - totalCapex,
        value: totalCapex,
        limit: cashAvailable,
      }
    }

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
    debtGate.some((s) => !s.satisfied) ||
    capexBudget.some((s) => !s.satisfied) ||
    leverage.some((s) => !s.satisfied) ||
    legacyFloor.some((lineStatuses) => lineStatuses.some((s) => s !== null && !s.satisfied)) ||
    capacity.some((lineStatuses) => lineStatuses.some((s) => !s.satisfied))

  return { rockSupply, debtGate, capexBudget, leverage, legacyFloor, capacity, anyViolation }
}
