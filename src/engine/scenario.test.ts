/**
 * Unit tests for scenario.ts — parsing, validation, schema version enforcement.
 */

import { describe, it, expect } from 'vitest'
import { parseScenario, ScenarioValidationError } from './scenario'
import type { Scenario } from './types'

function makeValidScenario(): object {
  return {
    schemaVersion: 1,
    meta: {
      name: 'Test Scenario',
      horizonYears: 3,
      isIllustrative: true,
    },
    corporate: {
      taxRate: 0.28,
      rD: 0.045,
      rE: 0.12,
      equity0: 1000,
      debt0: 400,
      leverageMax: 2.5,
      terminalGrowth: 0.025,
      depreciation: [10, 11, 12, 13],
    },
    supply: [1000, 1050, 1100, 1150],
    businessLines: [
      {
        name: 'Test Line A',
        shortCode: 'TLA',
        isLegacy: false,
        yield: 0.72,
        capexUnitCost: 1.8,
        buildLeadTime: 2,
        capacityDepreciation: 0.04,
        baseUnitCost: 0.38,
        learningExponent: 0.15,
        baseCumulativeVolume: 5000,
        basePrice: 0.65,
        priceErosion: 0.02,
        rdProductivity: 0.3,
        rdLag: 3,
        rdConversion: 0.25,
        legacyFloor: 0,
        opex: [60, 62, 64, 66],
        initialCapacity: 3500,
        initialPipeline: 20,
      },
    ],
  }
}

describe('parseScenario', () => {
  it('parses a valid scenario without errors', () => {
    const result = parseScenario(makeValidScenario()) as Scenario
    expect(result.meta.name).toBe('Test Scenario')
    expect(result.corporate.taxRate).toBe(0.28)
    expect(result.businessLines).toHaveLength(1)
    expect(result.businessLines[0].shortCode).toBe('TLA')
  })

  it('rejects wrong schemaVersion', () => {
    const raw = { ...makeValidScenario(), schemaVersion: 99 }
    expect(() => parseScenario(raw)).toThrow(ScenarioValidationError)
    try {
      parseScenario(raw)
    } catch (e) {
      const err = e as ScenarioValidationError
      expect(err.fieldErrors.some((f) => f.field === 'schemaVersion')).toBe(true)
    }
  })

  it('rejects missing schemaVersion', () => {
    const raw = makeValidScenario() as Record<string, unknown>
    delete raw.schemaVersion
    expect(() => parseScenario(raw)).toThrow(ScenarioValidationError)
  })

  it('rejects non-object input', () => {
    expect(() => parseScenario('not an object')).toThrow(ScenarioValidationError)
    expect(() => parseScenario(null)).toThrow(ScenarioValidationError)
    expect(() => parseScenario(42)).toThrow(ScenarioValidationError)
  })

  it('rejects taxRate outside [0, 1]', () => {
    const raw = makeValidScenario() as Record<string, unknown>
    ;(raw.corporate as Record<string, unknown>).taxRate = 1.5
    expect(() => parseScenario(raw)).toThrow(ScenarioValidationError)
  })

  it('rejects negative equity0', () => {
    const raw = makeValidScenario() as Record<string, unknown>
    ;(raw.corporate as Record<string, unknown>).equity0 = -100
    expect(() => parseScenario(raw)).toThrow(ScenarioValidationError)
  })

  it('rejects supply array of wrong length', () => {
    const raw = makeValidScenario() as Record<string, unknown>
    raw.supply = [1000, 1050]
    expect(() => parseScenario(raw)).toThrow(ScenarioValidationError)
    try {
      parseScenario(raw)
    } catch (e) {
      const err = e as ScenarioValidationError
      expect(err.fieldErrors.some((f) => f.field === 'supply')).toBe(true)
    }
  })

  it('rejects empty businessLines array', () => {
    const raw = { ...makeValidScenario(), businessLines: [] }
    expect(() => parseScenario(raw)).toThrow(ScenarioValidationError)
  })

  it('includes field path in error messages', () => {
    const raw = makeValidScenario() as Record<string, unknown>
    const lines = raw.businessLines as Record<string, unknown>[]
    lines[0].yield = 1.5
    expect(() => parseScenario(raw)).toThrow(ScenarioValidationError)
    try {
      parseScenario(raw)
    } catch (e) {
      const err = e as ScenarioValidationError
      expect(err.fieldErrors.some((f) => f.field === 'businessLines[0].yield')).toBe(true)
    }
  })

  it('collects all errors rather than stopping at first', () => {
    const raw = makeValidScenario() as Record<string, unknown>
    ;(raw.corporate as Record<string, unknown>).taxRate = -1
    ;(raw.corporate as Record<string, unknown>).rD = -0.5
    try {
      parseScenario(raw)
      expect.fail('should have thrown')
    } catch (e) {
      const err = e as ScenarioValidationError
      expect(err.fieldErrors.length).toBeGreaterThanOrEqual(2)
    }
  })
})
