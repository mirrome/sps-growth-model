/**
 * Zustand store — holds the active scenario, policy, and simulation result.
 *
 * The simulator is re-run synchronously on every state change.
 * In v2, if simulation takes >50ms, move this to a web worker.
 */

import { create } from 'zustand'
import type { Scenario, Policy, SimResult, ConstraintStatus } from '../engine/types'
import { simulate, buildEqualPolicy } from '../engine/simulate'
import { evaluateConstraints } from '../engine/constraints'

interface SimStore {
  scenario: Scenario | null
  policy: Policy | null
  result: SimResult | null
  constraints: ConstraintStatus | null
  isIllustrative: boolean

  /** Reference (pinned) scenario for KPI delta comparison */
  referenceResult: SimResult | null
  referenceLabel: string | null

  setScenario: (scenario: Scenario, isIllustrative: boolean) => void
  setPolicy: (policy: Policy) => void
  updatePolicyRock: (lineIndex: number, year: number, value: number) => void
  updatePolicyCapex: (lineIndex: number, year: number, value: number) => void
  updatePolicyRd: (lineIndex: number, year: number, value: number) => void
  pinReference: (label: string) => void
  clearReference: () => void
}

function runSim(scenario: Scenario, policy: Policy) {
  const result = simulate(scenario, policy)
  const constraints = evaluateConstraints(scenario, policy, result)
  return { result, constraints }
}

export const useSimStore = create<SimStore>((set, get) => ({
  scenario: null,
  policy: null,
  result: null,
  constraints: null,
  isIllustrative: true,
  referenceResult: null,
  referenceLabel: null,

  setScenario: (scenario, isIllustrative) => {
    const policy = buildEqualPolicy(scenario)
    const { result, constraints } = runSim(scenario, policy)
    set({ scenario, policy, result, constraints, isIllustrative })
  },

  setPolicy: (policy) => {
    const { scenario } = get()
    if (!scenario) return
    const { result, constraints } = runSim(scenario, policy)
    set({ policy, result, constraints })
  },

  updatePolicyRock: (lineIndex, year, value) => {
    const { scenario, policy } = get()
    if (!scenario || !policy) return
    const newRock = policy.rock.map((row, i) =>
      i === lineIndex ? row.map((v, t) => (t === year ? value : v)) : [...row],
    )
    const newPolicy = { ...policy, rock: newRock }
    const { result, constraints } = runSim(scenario, newPolicy)
    set({ policy: newPolicy, result, constraints })
  },

  updatePolicyCapex: (lineIndex, year, value) => {
    const { scenario, policy } = get()
    if (!scenario || !policy) return
    const newCapex = policy.capex.map((row, i) =>
      i === lineIndex ? row.map((v, t) => (t === year ? value : v)) : [...row],
    )
    const newPolicy = { ...policy, capex: newCapex }
    const { result, constraints } = runSim(scenario, newPolicy)
    set({ policy: newPolicy, result, constraints })
  },

  updatePolicyRd: (lineIndex, year, value) => {
    const { scenario, policy } = get()
    if (!scenario || !policy) return
    const newRd = policy.rd.map((row, i) =>
      i === lineIndex ? row.map((v, t) => (t === year ? value : v)) : [...row],
    )
    const newPolicy = { ...policy, rd: newRd }
    const { result, constraints } = runSim(scenario, newPolicy)
    set({ policy: newPolicy, result, constraints })
  },

  pinReference: (label) => {
    const { result } = get()
    if (!result) return
    set({ referenceResult: result, referenceLabel: label })
  },

  clearReference: () => set({ referenceResult: null, referenceLabel: null }),
}))
