/**
 * Zustand store — holds the active scenario, policy, and simulation result.
 *
 * The simulator is re-run synchronously on every state change.
 * In v2, if simulation takes >50ms, move this to a web worker.
 */

import { create } from 'zustand'
import type { Scenario, Policy, SimResult } from '../engine/types'
import { simulate, buildEqualPolicy } from '../engine/simulate'

interface SimStore {
  scenario: Scenario | null
  policy: Policy | null
  result: SimResult | null
  isIllustrative: boolean

  setScenario: (scenario: Scenario, isIllustrative: boolean) => void
  setPolicy: (policy: Policy) => void
  updatePolicyRock: (lineIndex: number, year: number, value: number) => void
  updatePolicyCapex: (lineIndex: number, year: number, value: number) => void
  updatePolicyRd: (lineIndex: number, year: number, value: number) => void
}

export const useSimStore = create<SimStore>((set, get) => ({
  scenario: null,
  policy: null,
  result: null,
  isIllustrative: true,

  setScenario: (scenario, isIllustrative) => {
    const policy = buildEqualPolicy(scenario)
    const result = simulate(scenario, policy)
    set({ scenario, policy, result, isIllustrative })
  },

  setPolicy: (policy) => {
    const { scenario } = get()
    if (!scenario) return
    const result = simulate(scenario, policy)
    set({ policy, result })
  },

  updatePolicyRock: (lineIndex, year, value) => {
    const { scenario, policy } = get()
    if (!scenario || !policy) return
    const newRock = policy.rock.map((row, i) =>
      i === lineIndex ? row.map((v, t) => (t === year ? value : v)) : [...row],
    )
    const newPolicy = { ...policy, rock: newRock }
    const result = simulate(scenario, newPolicy)
    set({ policy: newPolicy, result })
  },

  updatePolicyCapex: (lineIndex, year, value) => {
    const { scenario, policy } = get()
    if (!scenario || !policy) return
    const newCapex = policy.capex.map((row, i) =>
      i === lineIndex ? row.map((v, t) => (t === year ? value : v)) : [...row],
    )
    const newPolicy = { ...policy, capex: newCapex }
    const result = simulate(scenario, newPolicy)
    set({ policy: newPolicy, result })
  },

  updatePolicyRd: (lineIndex, year, value) => {
    const { scenario, policy } = get()
    if (!scenario || !policy) return
    const newRd = policy.rd.map((row, i) =>
      i === lineIndex ? row.map((v, t) => (t === year ? value : v)) : [...row],
    )
    const newPolicy = { ...policy, rd: newRd }
    const result = simulate(scenario, newPolicy)
    set({ policy: newPolicy, result })
  },
}))
