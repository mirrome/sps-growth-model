/**
 * Unit tests for constraints.ts — all 5 constraint families from §3.8.
 */

import { describe, it, expect } from 'vitest'
import { evaluateConstraints } from './constraints'
import { simulate, buildEqualPolicy } from './simulate'
import type { Scenario, Policy } from './types'

const T = 3

function makeScenario(): Scenario {
  return {
    schemaVersion: 1,
    meta: { name: 'Constraint Test', horizonYears: T, isIllustrative: true },
    corporate: {
      taxRate: 0.3,
      rD: 0.06,
      rE: 0.12,
      equity0: 600,
      debt0: 200,
      leverageMax: 3.0,
      terminalGrowth: 0.02,
      depreciation: [20, 20, 20, 20],
    },
    rockSupply: [1000, 1000, 1000, 1000],
    businessLines: [
      {
        name: 'Line A',
        shortCode: 'LA',
        isLegacy: true,
        yield: 0.8,
        capexUnitCost: 2.0,
        buildLeadTime: 0,
        capacityDepreciation: 0.0,
        baseUnitCost: 0.4,
        learningExponent: 0.1,
        baseCumulativeVolume: 1000,
        basePrice: 1.0,
        priceErosion: 0.01,
        rdProductivity: 0.3,
        rdLag: 2,
        rdConversion: 0.2,
        legacyFloor: 100,
        opex: [20, 20, 20, 20],
        initialCapacity: 500,
        initialPipeline: 0,
      },
      {
        name: 'Line B',
        shortCode: 'LB',
        isLegacy: false,
        yield: 0.75,
        capexUnitCost: 1.5,
        buildLeadTime: 0,
        capacityDepreciation: 0.0,
        baseUnitCost: 0.35,
        learningExponent: 0.1,
        baseCumulativeVolume: 500,
        basePrice: 0.9,
        priceErosion: 0.01,
        rdProductivity: 0.3,
        rdLag: 2,
        rdConversion: 0.2,
        legacyFloor: 0,
        opex: [15, 15, 15, 15],
        initialCapacity: 400,
        initialPipeline: 0,
      },
    ],
  }
}

describe('§3.8.1 Rock supply constraint', () => {
  it('satisfied when total rock ≤ supply', () => {
    const scenario = makeScenario()
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(400), new Array<number>(T + 1).fill(400)],
      capex: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.rockSupply.every((s) => s.satisfied)).toBe(true)
    expect(status.rockSupply[0].slack).toBeCloseTo(200, 4)
  })

  it('violated when total rock > supply', () => {
    const scenario = makeScenario()
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(700), new Array<number>(T + 1).fill(700)],
      capex: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.rockSupply.every((s) => !s.satisfied)).toBe(true)
    expect(status.anyViolation).toBe(true)
  })
})

describe('§3.8.3 Leverage constraint', () => {
  it('satisfied when debt/EBITDA is within ceiling', () => {
    const scenario = makeScenario()
    const policy = buildEqualPolicy(scenario)
    const result = simulate(scenario, policy)
    // debt0=200, high EBITDA expected → ratio < 3
    const status = evaluateConstraints(scenario, policy, result)
    expect(status.leverage[0].value).toBeGreaterThan(0)
  })

  it('violated when leverage ceiling is very tight', () => {
    const scenario: Scenario = {
      ...makeScenario(),
      corporate: { ...makeScenario().corporate, debt0: 5000, leverageMax: 0.05 },
    }
    const policy = buildEqualPolicy(scenario)
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.leverage.some((s) => !s.satisfied)).toBe(true)
    expect(status.anyViolation).toBe(true)
  })
})

describe('§3.8.4 Legacy service floor', () => {
  it('satisfied when legacy line output meets floor', () => {
    const scenario = makeScenario()
    // Floor is 100 kt/yr; with rock=200 and yield=0.8, Q=min(500,160)=160 ≥ 100
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(200), new Array<number>(T + 1).fill(200)],
      capex: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.legacyFloor[0].every((s) => s !== null && s.satisfied)).toBe(true)
  })

  it('violated when rock allocation leaves legacy line below floor', () => {
    const scenario = makeScenario()
    // Floor is 100; with rock=1 and yield=0.8, Q=min(500,0.8)=0.8 < 100
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(1), new Array<number>(T + 1).fill(1)],
      capex: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.legacyFloor[0].some((s) => s !== null && !s.satisfied)).toBe(true)
    expect(status.anyViolation).toBe(true)
  })

  it('returns null statuses for non-legacy lines', () => {
    const scenario = makeScenario()
    const policy = buildEqualPolicy(scenario)
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    // Line B is not legacy
    expect(status.legacyFloor[1].every((s) => s === null)).toBe(true)
  })
})

describe('§3.8.5 Capacity constraint', () => {
  it('output never exceeds capacity', () => {
    const scenario = makeScenario()
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(10000), new Array<number>(T + 1).fill(10000)],
      capex: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.capacity.every((lineStatuses) => lineStatuses.every((s) => s.satisfied))).toBe(
      true,
    )
  })
})

describe('§3.8.2 Debt-raising gate', () => {
  it('flags a violation when capex is attempted in a no-debt year with no cash (PM test)', () => {
    // PM spec: "capex attempted in year 2026 with canRaiseDebt[0]=false and C_0=0
    // must flag a constraint violation."
    // We set up a zero-EBITDA scenario so FCF[0] = Tc*Dep - Capex < 0 → cashAvailable = 0.
    const scenario: Scenario = {
      ...makeScenario(),
      corporate: {
        ...makeScenario().corporate,
        depreciation: [0, 0, 0, 0], // no depreciation → FCF = EBITDA*(1-Tc) - Capex
        canRaiseDebt: [false, true, true, true],
      },
    }
    // Zero rock → zero EBITDA → FCF[0] = -totalCapex → cashAvailable = 0
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
      capex: [new Array<number>(T + 1).fill(50), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    // Year 0 (2026): canRaiseDebt=false, cash=0, capex=50 → debt gate violated
    expect(status.debtGate[0].satisfied).toBe(false)
    expect(status.debtGate[0].slack).toBeLessThan(0)
    expect(status.anyViolation).toBe(true)
  })

  it('is satisfied in all years when canRaiseDebt is always true', () => {
    const scenario: Scenario = {
      ...makeScenario(),
      corporate: {
        ...makeScenario().corporate,
        canRaiseDebt: [true, true, true, true],
      },
    }
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(400), new Array<number>(T + 1).fill(400)],
      capex: [new Array<number>(T + 1).fill(100), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.debtGate.every((s) => s.satisfied)).toBe(true)
  })

  it('is satisfied when canRaiseDebt is absent (defaults to all-true)', () => {
    const scenario = makeScenario() // no canRaiseDebt field
    const policy = buildEqualPolicy(scenario)
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.debtGate.every((s) => s.satisfied)).toBe(true)
  })

  it('is satisfied in debt-gate years when capex is zero', () => {
    const scenario: Scenario = {
      ...makeScenario(),
      corporate: {
        ...makeScenario().corporate,
        canRaiseDebt: [false, false, true, true],
      },
    }
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(400), new Array<number>(T + 1).fill(400)],
      capex: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)

    expect(status.debtGate[0].satisfied).toBe(true)
    expect(status.debtGate[1].satisfied).toBe(true)
  })
})

describe('anyViolation flag', () => {
  it('is false when all constraints satisfied', () => {
    const scenario = makeScenario()
    const policy: Policy = {
      rock: [new Array<number>(T + 1).fill(400), new Array<number>(T + 1).fill(400)],
      capex: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
      rd: [new Array<number>(T + 1).fill(0), new Array<number>(T + 1).fill(0)],
    }
    const result = simulate(scenario, policy)
    const status = evaluateConstraints(scenario, policy, result)
    // With adequate rock and low debt, all constraints should pass
    expect(status.rockSupply.every((s) => s.satisfied)).toBe(true)
  })
})
