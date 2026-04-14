/**
 * Performance verification — §8.2 acceptance criteria timing.
 *
 * §8.2 requirements:
 * - Simulation run: < 50ms
 * - Sensitivity analysis (all params, 6 lines): < 2000ms
 */

import { describe, it, expect } from 'vitest'
import { simulate, buildEqualPolicy } from './simulate'
import { runSensitivityAnalysis } from './sensitivity'
import illustrativeScenario from '../../scenario.illustrative.json'
import { parseScenario } from './scenario'

const scenario = parseScenario(illustrativeScenario)
const policy = buildEqualPolicy(scenario)

describe('Performance requirements (§8.2)', () => {
  it('single simulation run completes in < 50ms', () => {
    const runs = 20
    const start = performance.now()
    for (let i = 0; i < runs; i++) {
      simulate(scenario, policy)
    }
    const avg = (performance.now() - start) / runs
    console.log(`Simulation avg: ${avg.toFixed(2)}ms`)
    expect(avg).toBeLessThan(50)
  })

  it('sensitivity analysis over all params completes in < 2000ms', () => {
    const start = performance.now()
    const result = runSensitivityAnalysis(scenario, policy)
    const elapsed = performance.now() - start
    console.log(
      `Sensitivity: ${elapsed.toFixed(0)}ms — ${result.parameters.length} params evaluated`,
    )
    expect(elapsed).toBeLessThan(2000)
  })
})
