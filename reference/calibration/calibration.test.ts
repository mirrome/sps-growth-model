/**
 * Calibration test — asserts the TypeScript engine reproduces the growth baseline
 * fixture to within 1e-6 relative tolerance.
 *
 * Architecture (Option 1 from PM change-3 instructions):
 *
 *   reference/calibration/growth_baseline_fixture.csv
 *     Pre-computed engine output captured by scripts/gen-growth-fixture.ts.
 *     Commit alongside any change to the growth baseline policy arrays or the
 *     illustrative scenario so the fixture stays in sync with the code.
 *
 *   reference/sps_reference_model.xlsx
 *     Human-readable spreadsheet the PM team keeps in sync with the UI default
 *     view. Serves as a documentation artifact for reviewers; no longer a test
 *     input, so edits to the spreadsheet for presentation purposes cannot break
 *     CI.
 *
 * This test is a permanent CI gate. Any discrepancy is a code change (engine
 * equations or policy arrays) that must be accompanied by a fixture regeneration.
 * To regenerate: npx tsx scripts/gen-growth-fixture.ts
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect, beforeAll } from 'vitest'
import { parseScenario } from '../../src/engine/scenario'
import { simulate, buildGrowthBaselinePolicy } from '../../src/engine/simulate'
import type { Policy } from '../../src/engine/types'

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = resolve(__dirname, 'growth_baseline_fixture.csv')
const SCENARIO_PATH = resolve(__dirname, '../../scenario.illustrative.json')

// ---------------------------------------------------------------------------
// CSV parser (same format as sps_reference_output.csv)
// ---------------------------------------------------------------------------

type CsvRow = { metric: string; year: number | null; value: number }

function parseCsv(path: string): CsvRow[] {
  const text = readFileSync(path, 'utf-8')
  const lines = text.trim().split('\n')
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    const metric = parts[0].trim()
    const yearStr = parts[1].trim()
    const value = parseFloat(parts[2].trim())
    const year = yearStr === '' ? null : parseInt(yearStr, 10)
    rows.push({ metric, year, value })
  }
  return rows
}

function buildLookup(rows: CsvRow[]): Map<string, Map<number, number>> {
  const lookup = new Map<string, Map<number, number>>()
  for (const row of rows) {
    if (!lookup.has(row.metric)) lookup.set(row.metric, new Map())
    lookup.get(row.metric)!.set(row.year ?? 0, row.value)
  }
  return lookup
}

// ---------------------------------------------------------------------------
// Relative tolerance assertion
// ---------------------------------------------------------------------------

// 1e-6 is tighter than "to the cent" for all values in the model range.
// The fixture is produced by the same engine code, so in practice the relative
// error will be exactly 0; the tolerance is a safety margin for minor IEEE 754
// differences across Node.js versions.
const REL_TOL = 1e-6

function assertClose(actual: number, expected: number, label: string, tol = REL_TOL): void {
  const denom = Math.max(Math.abs(expected), 1e-9)
  const relErr = Math.abs(actual - expected) / denom
  expect(
    relErr,
    `${label}: got ${actual.toPrecision(10)}, expected ${expected.toPrecision(10)}, rel err ${relErr.toExponential(2)}`,
  ).toBeLessThanOrEqual(tol)
}

// ---------------------------------------------------------------------------
// Short codes in scenario order
// ---------------------------------------------------------------------------

const SHORT_CODES = ['USS', 'SPN', 'FIS', 'EMS', 'ANS', 'NPS']

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let ref: Map<string, Map<number, number>>
let result: ReturnType<typeof simulate>
let BASE_YEAR: number
let T: number

beforeAll(() => {
  const csv = parseCsv(FIXTURE_PATH)
  ref = buildLookup(csv)

  const raw = JSON.parse(readFileSync(SCENARIO_PATH, 'utf-8')) as unknown
  const scenario = parseScenario(raw)
  // baseYear is in the JSON but not yet promoted to the TypeScript type
  BASE_YEAR = (scenario.meta as unknown as Record<string, number>).baseYear ?? 2026
  T = scenario.meta.horizonYears

  const policy: Policy = buildGrowthBaselinePolicy(scenario)
  result = simulate(scenario, policy)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Calibration: engine vs growth baseline fixture', () => {
  it('WACC matches fixture', () => {
    assertClose(result.wacc, ref.get('WACC')!.get(0)!, 'WACC')
  })

  it('terminal value matches fixture', () => {
    assertClose(result.terminalValue, ref.get('Terminal value ($M)')!.get(0)!, 'Terminal value')
  })

  it('NPV excluding terminal value matches fixture', () => {
    assertClose(result.npvExTV, ref.get('NPV excl. TV ($M)')!.get(0)!, 'NPV excl. TV')
  })

  it('NPV including terminal value matches fixture', () => {
    assertClose(result.npv, ref.get('NPV incl. TV ($M)')!.get(0)!, 'NPV incl. TV')
  })

  it('FCF matches fixture for every year t = 0..T', () => {
    for (let t = 0; t <= T; t++) {
      const year = BASE_YEAR + t
      assertClose(result.fcf[t], ref.get('FCF ($M)')!.get(year)!, `FCF year ${year}`)
    }
  })

  it('total EBITDA matches fixture for every year t = 0..T', () => {
    for (let t = 0; t <= T; t++) {
      const year = BASE_YEAR + t
      assertClose(
        result.ebitda[t],
        ref.get('EBITDA total ($M)')!.get(year)!,
        `EBITDA total year ${year}`,
      )
    }
  })

  it('total revenue matches fixture for every year t = 0..T', () => {
    for (let t = 0; t <= T; t++) {
      const year = BASE_YEAR + t
      const actual = result.lines.reduce((s, l) => s + l.revenue[t], 0)
      assertClose(actual, ref.get('Revenue total ($M)')!.get(year)!, `Revenue total year ${year}`)
    }
  })

  it('per-line revenue matches fixture for every line and year', () => {
    for (let i = 0; i < SHORT_CODES.length; i++) {
      const code = SHORT_CODES[i]
      for (let t = 0; t <= T; t++) {
        const year = BASE_YEAR + t
        assertClose(
          result.lines[i].revenue[t],
          ref.get(`Revenue ${code}`)!.get(year)!,
          `Revenue ${code} year ${year}`,
        )
      }
    }
  })

  it('per-line EBITDA matches fixture for every line and year', () => {
    for (let i = 0; i < SHORT_CODES.length; i++) {
      const code = SHORT_CODES[i]
      for (let t = 0; t <= T; t++) {
        const year = BASE_YEAR + t
        assertClose(
          result.lines[i].ebitda[t],
          ref.get(`EBITDA ${code}`)!.get(year)!,
          `EBITDA ${code} year ${year}`,
        )
      }
    }
  })

  it('per-line output Q matches fixture for every line and year', () => {
    for (let i = 0; i < SHORT_CODES.length; i++) {
      const code = SHORT_CODES[i]
      for (let t = 0; t <= T; t++) {
        const year = BASE_YEAR + t
        assertClose(
          result.lines[i].output[t],
          ref.get(`Q ${code}`)!.get(year)!,
          `Q ${code} year ${year}`,
        )
      }
    }
  })

  it('per-line capacity K matches fixture for every line and year', () => {
    for (let i = 0; i < SHORT_CODES.length; i++) {
      const code = SHORT_CODES[i]
      for (let t = 0; t <= T; t++) {
        const year = BASE_YEAR + t
        assertClose(
          result.lines[i].capacity[t],
          ref.get(`K ${code}`)!.get(year)!,
          `K ${code} year ${year}`,
        )
      }
    }
  })
})
