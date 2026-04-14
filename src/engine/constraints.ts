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

  // ---------------------------------------------------------------------------
  // Pre-compute per-year capex totals and pre-capex operating cash flow.
  //
  // FCF_t = EBITDA_t·(1−Tc) + Tc·Dep_t − ΣI_t  (capex already subtracted)
  // OCF_t = EBITDA_t·(1−Tc) + Tc·Dep_t          (pre-capex; the cash the firm
  //         earns from operations before committing to capital expenditure)
  //       = result.fcf[t] + totalCapex_t
  //
  // Using FCF[t] directly to check "can we afford capex_t?" is circular because
  // FCF[t] already has capex_t subtracted. OCF_t is the correct bound.
  // ---------------------------------------------------------------------------
  const totalCapexByYear = Array.from({ length: T + 1 }, (_, t) =>
    policy.capex.reduce((sum, lineCx) => sum + (lineCx[t] ?? 0), 0),
  )

  const ocfByYear = Array.from({ length: T + 1 }, (_, t) => result.fcf[t] + totalCapexByYear[t])

  // ---------------------------------------------------------------------------
  // Accumulate a cash balance across years.
  //
  // C_t = cash available in year t = surplus carried from years 0..t-1 + OCF_t.
  // After paying capex, the surplus carried to t+1 is max(C_t − CapEx_t, 0),
  // which equals max(cashCarried + FCF_t, 0) (FCF already nets out capex).
  //
  // Initial cash balance is zero (no cash0 field in v1 scenario schema;
  // a future v2 could add corporate.cash0 if needed).
  // ---------------------------------------------------------------------------
  let cashCarried = 0
  const accumulatedCashByYear = Array.from({ length: T + 1 }, (_, t) => {
    const available = cashCarried + ocfByYear[t]
    cashCarried = Math.max(cashCarried + result.fcf[t], 0)
    return available
  })

  // §3.8.1 Rock supply: Σ r_{i,t} ≤ S_t
  const rockSupply: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const totalRock = policy.rock.reduce((sum, lineRock) => sum + (lineRock[t] ?? 0), 0)
    const limit = scenario.rockSupply[t]
    return { satisfied: totalRock <= limit, slack: limit - totalRock, value: totalRock, limit }
  })

  // §3.8.2a Debt-raising gate: when canRaiseDebt[t] = false, the firm may not issue new
  // debt, so total capex is strictly limited to accumulated operating cash C_t.
  // Entries for years when canRaiseDebt[t] = true are always satisfied (slack = +∞).
  const debtGate: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const canRaise = scenario.corporate.canRaiseDebt?.[t] ?? true
    if (canRaise) {
      return { satisfied: true, slack: Infinity, value: 0, limit: Infinity }
    }
    const capex = totalCapexByYear[t]
    const available = accumulatedCashByYear[t]
    return {
      satisfied: capex <= available + 1e-6,
      slack: available - capex,
      value: capex,
      limit: available,
    }
  })

  // §3.8.2b Capex budget: Σ I_{i,t} ≤ C_t + ΔD_t
  // When canRaiseDebt[t] = false: ΔD_t = 0 (same cash-only rule as debt gate, surfaced
  // separately in the UI so users can distinguish the two failure modes).
  // When canRaiseDebt[t] = true: ΔD_t = net new debt raised per the simulation.
  const capexBudget: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const capex = totalCapexByYear[t]
    const available = accumulatedCashByYear[t]
    const canRaise = scenario.corporate.canRaiseDebt?.[t] ?? true

    if (!canRaise) {
      return {
        satisfied: capex <= available + 1e-6,
        slack: available - capex,
        value: capex,
        limit: available,
      }
    }

    const debtPrev = t === 0 ? scenario.corporate.debt0 : result.debt[t - 1]
    const debtNow = result.debt[t]
    const newDebt = Math.max(debtNow - debtPrev, 0)
    const limit = available + newDebt
    return {
      satisfied: capex <= limit + 1e-6,
      slack: limit - capex,
      value: capex,
      limit,
    }
  })

  // §3.8.3 Leverage: D_t / EBITDA_t ≤ L_max
  const leverage: ConstraintYearStatus[] = Array.from({ length: T + 1 }, (_, t) => {
    const ebitda = result.ebitda[t]
    if (ebitda <= 0) {
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
