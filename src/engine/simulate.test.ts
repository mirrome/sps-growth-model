/**
 * Simulation engine unit tests — all 7 cases from §8.1 of the requirements document.
 *
 * Each test constructs a minimal scenario targeting one specific model behavior.
 * Tests use controlled inputs with known analytical answers.
 */

import { describe, it, expect } from 'vitest'
import { simulate, buildEqualPolicy } from './simulate'
import type { Scenario, Policy } from './types'

const T = 5

/** Minimal single-line scenario for focused unit tests. */
function makeScenario(overrides: Partial<Parameters<typeof singleLineScenario>[0]> = {}): Scenario {
  return singleLineScenario({ ...overrides })
}

interface LineOverrides {
  buildLeadTime?: number
  rdLag?: number
  rdConversion?: number
  priceErosion?: number
  learningExponent?: number
  initialCapacity?: number
  initialPipeline?: number
  isLegacy?: boolean
  legacyFloor?: number
  yield?: number
}

function singleLineScenario(overrides: LineOverrides = {}): Scenario {
  const horizon = T
  return {
    schemaVersion: 1,
    meta: { name: 'Test', horizonYears: horizon, baseYear: 2026, isIllustrative: true },
    corporate: {
      taxRate: 0.3,
      rD: 0.06,
      rE: 0.12,
      equity0: 600,
      debt0: 400,
      leverageMax: 3.0,
      terminalGrowth: 0.02,
      depreciation: new Array<number>(horizon + 1).fill(20),
    },
    supply: new Array<number>(horizon + 1).fill(10000),
    businessLines: [
      {
        name: 'Line A',
        shortCode: 'LA',
        isLegacy: overrides.isLegacy ?? false,
        yield: overrides.yield ?? 0.8,
        capexUnitCost: 2.0,
        buildLeadTime: overrides.buildLeadTime ?? 0,
        capacityDepreciation: 0.0,
        baseUnitCost: 0.5,
        learningExponent: overrides.learningExponent ?? 0.15,
        baseCumulativeVolume: 1000,
        basePrice: 1.0,
        priceErosion: overrides.priceErosion ?? 0.0,
        rdProductivity: 0.5,
        rdLag: overrides.rdLag ?? 0,
        rdConversion: overrides.rdConversion ?? 0.0,
        legacyFloor: overrides.legacyFloor ?? 0,
        opex: new Array<number>(horizon + 1).fill(10),
        initialCapacity: overrides.initialCapacity ?? 500,
        initialPipeline: overrides.initialPipeline ?? 0,
      },
    ],
  }
}

function zeroPolicy(scenario: Scenario): Policy {
  const T = scenario.meta.horizonYears
  const N = scenario.businessLines.length
  return {
    rock: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
    capex: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
    rd: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
  }
}

function steadyRockPolicy(scenario: Scenario, rockPerLine: number): Policy {
  const T = scenario.meta.horizonYears
  const N = scenario.businessLines.length
  return {
    rock: Array.from({ length: N }, () => new Array<number>(T + 1).fill(rockPerLine)),
    capex: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
    rd: Array.from({ length: N }, () => new Array<number>(T + 1).fill(0)),
  }
}

// ---------------------------------------------------------------------------
// Test 1 — §8.1: Zero investment, zero R&D, steady rock allocation.
// Revenue should decline at price erosion rate. Unit cost falls with learning.
// ---------------------------------------------------------------------------
describe('Test 1 — zero investment, zero R&D, steady rock', () => {
  it('revenue declines at price erosion rate', () => {
    const pi = 0.05
    const scenario = makeScenario({ priceErosion: pi, learningExponent: 0 })
    const rock = 400
    const policy = steadyRockPolicy(scenario, rock)
    const result = simulate(scenario, policy)

    // With capacity 500 and yield 0.8, rock 400 → Q = min(500, 0.8*400) = 320
    // With no R&D (dRev=0) price just erodes: p_{t+1} = p_t*(1-pi)
    // Revenue_t = p_t * Q_t
    for (let t = 1; t <= T; t++) {
      const expectedPrice = Math.pow(1 - pi, t)
      expect(result.lines[0].unitPrice[t]).toBeCloseTo(expectedPrice, 5)
    }
    for (let t = 1; t <= T; t++) {
      expect(result.lines[0].revenue[t]).toBeLessThan(result.lines[0].revenue[t - 1])
    }
  })

  it('unit cost falls as cumulative volume grows', () => {
    const scenario = makeScenario({ priceErosion: 0, learningExponent: 0.15 })
    const policy = steadyRockPolicy(scenario, 400)
    const result = simulate(scenario, policy)

    // Unit cost must strictly decrease over time as cumulative volume grows
    for (let t = 1; t <= T; t++) {
      expect(result.lines[0].unitCost[t]).toBeLessThan(result.lines[0].unitCost[t - 1])
    }
  })

  it('EBITDA falls when revenue declines and costs are sticky', () => {
    const scenario = makeScenario({ priceErosion: 0.05, learningExponent: 0 })
    const policy = steadyRockPolicy(scenario, 400)
    const result = simulate(scenario, policy)

    for (let t = 1; t <= T; t++) {
      expect(result.ebitda[t]).toBeLessThan(result.ebitda[t - 1])
    }
  })
})

// ---------------------------------------------------------------------------
// Test 2 — §8.1: Capex with lead time 2.
// Capacity must increase starting in year 2, not before.
// ---------------------------------------------------------------------------
describe('Test 2 — capex build lead time', () => {
  it('capacity does not increase before lead time has elapsed', () => {
    const scenario = makeScenario({ buildLeadTime: 2 })
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(300)],
      capex: [
        // Large capex only in year 0
        [200, 0, 0, 0, 0, 0],
      ],
      rd: [new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const cap = result.lines[0].capacity

    // Year 1 capacity must equal year 0 (no new capacity arrives until year 2)
    expect(cap[1]).toBeCloseTo(cap[0], 6)

    // Year 2 capacity must be greater than year 1 (capex from year 0 arrives)
    expect(cap[2]).toBeGreaterThan(cap[1])
  })

  it('the capacity addition equals I_{t-τ}/κ', () => {
    const scenario = makeScenario({ buildLeadTime: 2 })
    const capexY0 = 100
    const kappa = scenario.businessLines[0].capexUnitCost
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(300)],
      capex: [[capexY0, 0, 0, 0, 0, 0]],
      rd: [new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const cap = result.lines[0].capacity

    const expectedAddition = capexY0 / kappa
    expect(cap[2] - cap[1]).toBeCloseTo(expectedAddition, 5)
  })
})

// ---------------------------------------------------------------------------
// Test 3 — §8.1: R&D spending in year 0, lag 3, conversion 0.2.
//
// Pipeline timing note: the formula P_{t+1} = P_t + μ·RD_t − φ·P_{t−λ}
// uses P_0 = initialPipeline (before year-0 R&D). R&D at year 0 increases
// P_1, not P_0. So launched revenue at year t = φ·P_{t−λ} first receives
// year-0 R&D when t−λ = 1, i.e. t = λ+1. With initialPipeline=0, the
// launched revenue is zero through year λ and first becomes positive at
// year λ+1 (year "lag+1" below).
// ---------------------------------------------------------------------------
describe('Test 3 — R&D pipeline maturation lag', () => {
  it('no launched revenue appears before the lag has elapsed', () => {
    const lag = 3
    const scenario = makeScenario({ rdLag: lag, rdConversion: 0.2, initialPipeline: 0 })
    const rdSpend = 50
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(300)],
      capex: [new Array<number>(T + 1).fill(0)],
      rd: [
        // R&D only in year 0
        [rdSpend, 0, 0, 0, 0, 0],
      ],
    }
    const result = simulate(scenario, policy)

    // Launched revenue must be zero through year lag (P_0..P_lag excludes year-0 R&D)
    for (let t = 0; t <= lag; t++) {
      expect(result.lines[0].launchedRevenue[t]).toBe(0)
    }

    // Launched revenue must be positive starting at year lag+1 (first reads P_1 which
    // includes year-0 R&D: P_1 = P_0 + μ·RD_0 = 0 + μ·rdSpend > 0)
    expect(result.lines[0].launchedRevenue[lag + 1]).toBeGreaterThan(0)
  })

  it('pipeline depletes gradually after the lag', () => {
    const lag = 3
    const scenario = makeScenario({ rdLag: lag, rdConversion: 0.2, initialPipeline: 0 })
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(300)],
      capex: [new Array<number>(T + 1).fill(0)],
      rd: [[50, 0, 0, 0, 0, 0]],
    }
    const result = simulate(scenario, policy)

    // Pipeline starts draining at year lag+1 (when year-0 R&D first matures)
    for (let t = lag + 1; t < T; t++) {
      expect(result.lines[0].pipeline[t + 1]).toBeLessThan(result.lines[0].pipeline[t])
    }
  })
})

// ---------------------------------------------------------------------------
// Test 4 — §8.1: Rock allocation exceeds supply.
// The constraints module must flag a violation.
// ---------------------------------------------------------------------------
describe('Test 4 — supply constraint violation', () => {
  it('flags a violation when total rock exceeds supply', async () => {
    const { evaluateConstraints } = await import('./constraints')
    const scenario = makeScenario()
    // Supply is 10000, but we allocate 15000
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(15000)],
      capex: [new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.anyViolation).toBe(true)
    expect(status.supply.some((s) => !s.satisfied)).toBe(true)
    expect(status.supply.some((s) => s.slack < 0)).toBe(true)
  })

  it('does not flag a violation when rock is within supply', async () => {
    const { evaluateConstraints } = await import('./constraints')
    const scenario = makeScenario()
    const policy = steadyRockPolicy(scenario, 500)
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.supply.every((s) => s.satisfied)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 5 — §8.1: Debt exceeds leverage ceiling.
// The constraints module must flag a violation.
// ---------------------------------------------------------------------------
describe('Test 5 — leverage constraint violation', () => {
  it('flags leverage violation when debt/EBITDA exceeds ceiling', async () => {
    const { evaluateConstraints } = await import('./constraints')

    // Set a very tight leverage ceiling
    const scenario: Scenario = {
      ...makeScenario(),
      corporate: {
        taxRate: 0.3,
        rD: 0.06,
        rE: 0.12,
        equity0: 600,
        debt0: 5000,
        leverageMax: 0.1,
        terminalGrowth: 0.02,
        depreciation: new Array<number>(T + 1).fill(20),
      },
    }
    const policy = steadyRockPolicy(scenario, 300)
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    // With debt=5000 and small EBITDA, leverage ratio >> 0.1
    expect(status.anyViolation).toBe(true)
    expect(status.leverage.some((s) => !s.satisfied)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests for buildEqualPolicy helper
// ---------------------------------------------------------------------------
describe('buildEqualPolicy', () => {
  it('creates policy arrays of correct dimensions', () => {
    const scenario = makeScenario()
    const policy = buildEqualPolicy(scenario)
    const N = scenario.businessLines.length

    expect(policy.rock).toHaveLength(N)
    expect(policy.capex).toHaveLength(N)
    expect(policy.rd).toHaveLength(N)
    expect(policy.rock[0]).toHaveLength(T + 1)
  })
})

// ---------------------------------------------------------------------------
// Basic simulation integrity checks
// ---------------------------------------------------------------------------
describe('simulate — output integrity', () => {
  it('returns FCF, EBITDA, debt arrays of length T+1', () => {
    const scenario = makeScenario()
    const policy = buildEqualPolicy(scenario)
    const result = simulate(scenario, policy)

    expect(result.fcf).toHaveLength(T + 1)
    expect(result.ebitda).toHaveLength(T + 1)
    expect(result.debt).toHaveLength(T + 1)
  })

  it('initial capacity matches scenario initialCapacity', () => {
    const scenario = makeScenario({ initialCapacity: 750 })
    const policy = zeroPolicy(scenario)
    const result = simulate(scenario, policy)
    expect(result.lines[0].capacity[0]).toBe(750)
  })

  it('zero rock allocation produces zero output', () => {
    const scenario = makeScenario()
    const policy = zeroPolicy(scenario)
    const result = simulate(scenario, policy)

    for (let t = 0; t <= T; t++) {
      expect(result.lines[0].output[t]).toBe(0)
    }
  })

  it('output is bounded by capacity', () => {
    const scenario = makeScenario({ initialCapacity: 200 })
    const policy = steadyRockPolicy(scenario, 10000)
    const result = simulate(scenario, policy)

    for (let t = 0; t <= T; t++) {
      expect(result.lines[0].output[t]).toBeLessThanOrEqual(result.lines[0].capacity[t] + 1e-9)
    }
  })

  it('output is bounded by rock yield', () => {
    const scenario = makeScenario({ initialCapacity: 50000, yield: 0.8 })
    const rock = 100
    const policy = steadyRockPolicy(scenario, rock)
    const result = simulate(scenario, policy)

    for (let t = 0; t <= T; t++) {
      expect(result.lines[0].output[t]).toBeLessThanOrEqual(
        scenario.businessLines[0].yield * rock + 1e-9,
      )
    }
  })

  it('NPV and npvExTV are consistent (npv > npvExTV when TV > 0)', () => {
    const scenario = makeScenario({ priceErosion: 0 })
    const policy = steadyRockPolicy(scenario, 300)
    const result = simulate(scenario, policy)

    expect(result.npv).toBeGreaterThanOrEqual(result.npvExTV)
    expect(result.terminalValue).toBeGreaterThanOrEqual(0)
  })

  it('does not produce NaN or Infinity in any output array', () => {
    const scenario = makeScenario()
    const policy = buildEqualPolicy(scenario)
    const result = simulate(scenario, policy)

    const check = (arr: number[]) => arr.every((v) => isFinite(v))
    expect(check(result.fcf)).toBe(true)
    expect(check(result.ebitda)).toBe(true)
    expect(check(result.debt)).toBe(true)
    result.lines.forEach((line) => {
      expect(check(line.capacity)).toBe(true)
      expect(check(line.output)).toBe(true)
      expect(check(line.revenue)).toBe(true)
      expect(check(line.unitCost)).toBe(true)
      expect(check(line.unitPrice)).toBe(true)
    })
  })
})

// Growth baseline integration guards live in
// reference/calibration/growth_baseline_guards.test.ts alongside the other
// calibration tests. They require Node.js fs/path/url imports that cannot
// be included in the browser-targeted tsconfig.app.json include path.
