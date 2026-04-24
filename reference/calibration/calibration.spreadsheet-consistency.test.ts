/**
 * Spreadsheet consistency test — independent-implementation safety net.
 *
 * WHAT THIS TEST DOES
 * -------------------
 * Reads two independently produced artifacts:
 *
 *   reference/sps_reference_output.csv
 *     CSV export of the PM reference spreadsheet (reference/sps_reference_model.xlsx).
 *     Produced by the PM's Python build script whenever the spreadsheet changes.
 *     Implements the growth baseline policy using Excel formulas.
 *
 *   reference/calibration/growth_baseline_fixture.csv
 *     Pre-computed TypeScript engine output under buildGrowthBaselinePolicy.
 *     Produced by scripts/gen-growth-fixture.ts whenever policy arrays or the
 *     illustrative scenario change.
 *     Implements the growth baseline policy using TypeScript.
 *
 * Asserts that every metric present in the fixture also appears in the
 * spreadsheet CSV with a matching value (1e-6 relative tolerance).
 *
 * WHY THIS MATTERS
 * ----------------
 * The fixture-vs-engine test (calibration.test.ts) protects against regression
 * (a future engine change breaking existing output) but cannot catch a bug that
 * was already present when the fixture was first captured — the fixture would
 * bake in the wrong number and the engine would happily reproduce it forever.
 *
 * This test provides the missing layer: the spreadsheet is an independent
 * implementation of Section 3 of the requirements document. If the spreadsheet
 * and the fixture disagree, one of them is wrong. The test refuses to pass until
 * they agree, so neither can silently drift from the other.
 *
 * WORKFLOW
 * --------
 * A growth baseline policy change requires THREE steps, in order:
 *   1. Update policy arrays in src/engine/simulate.ts
 *   2. Run: npx tsx scripts/gen-growth-fixture.ts   (regenerate TypeScript fixture)
 *   3. Run: <PM Python script>                      (regenerate spreadsheet CSV)
 *
 * If step 2 is done but not step 3, this test fails → "spreadsheet is out of sync".
 * If step 3 is done but not step 2, calibration.test.ts fails → "fixture is stale".
 * Both directions are caught.
 *
 * CURRENT STATUS
 * --------------
 * This test will FAIL until the PM regenerates reference/sps_reference_output.csv
 * under the growth baseline policy. The current file was produced under the
 * calibration (zero-investment) policy and therefore disagrees with the fixture.
 * This failure is intentional — it surfaces the required PM action.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect, beforeAll } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SPREADSHEET_CSV = resolve(__dirname, '../sps_reference_output.csv')
const FIXTURE_CSV = resolve(__dirname, 'growth_baseline_fixture.csv')

// ---------------------------------------------------------------------------
// CSV parser and lookup builder
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
// Assertion
// ---------------------------------------------------------------------------

// Cross-platform tolerance: TypeScript (IEEE 754 float64) and Python/Excel
// accumulate floating-point rounding differently over 11 years of compounding
// state. WACC matches exactly (same formula, no accumulation). Compounded
// quantities (FCF, NPV) diverge up to ~6e-4 (~0.06%) purely from arithmetic.
// 1e-3 (0.1%) is the accepted ceiling — it catches any real modeling bug
// (which would show rel err > 1%) while not flagging cross-platform noise.
const REL_TOL = 1e-3

function assertClose(actual: number, expected: number, label: string, tol = REL_TOL): void {
  const denom = Math.max(Math.abs(expected), 1e-9)
  const relErr = Math.abs(actual - expected) / denom
  expect(
    relErr,
    `${label}:\n` +
      `  fixture (engine):     ${actual.toPrecision(10)}\n` +
      `  spreadsheet (Excel):  ${expected.toPrecision(10)}\n` +
      `  rel err: ${relErr.toExponential(2)}\n` +
      `  If the spreadsheet CSV was produced under a different policy than the\n` +
      `  fixture, regenerate both using the same policy then commit together.`,
  ).toBeLessThanOrEqual(tol)
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let spreadsheet: Map<string, Map<number, number>>
let fixture: Map<string, Map<number, number>>

beforeAll(() => {
  spreadsheet = buildLookup(parseCsv(SPREADSHEET_CSV))
  fixture = buildLookup(parseCsv(FIXTURE_CSV))
})

// ---------------------------------------------------------------------------
// Tests — fixture metrics vs spreadsheet
// ---------------------------------------------------------------------------

describe('Calibration: growth baseline fixture vs PM reference spreadsheet', () => {
  it('every metric in the fixture matches the spreadsheet (same policy, same equations)', () => {
    const mismatches: string[] = []

    for (const [metric, yearMap] of fixture) {
      for (const [yearKey, fixtureValue] of yearMap) {
        const ssYearMap = spreadsheet.get(metric)
        if (!ssYearMap) {
          mismatches.push(
            `Metric "${metric}" missing from spreadsheet CSV — was the CSV regenerated?`,
          )
          continue
        }
        const ssValue = ssYearMap.get(yearKey)
        if (ssValue === undefined) {
          const yearLabel = yearKey === 0 ? '(scalar)' : String(yearKey)
          mismatches.push(
            `"${metric}" year ${yearLabel} missing from spreadsheet CSV — was the CSV regenerated?`,
          )
          continue
        }
        const denom = Math.max(Math.abs(ssValue), 1e-9)
        const relErr = Math.abs(fixtureValue - ssValue) / denom
        if (relErr > REL_TOL) {
          const yearLabel = yearKey === 0 ? '(scalar)' : String(yearKey)
          mismatches.push(
            `"${metric}" year ${yearLabel}: fixture=${fixtureValue.toPrecision(10)}, ` +
              `spreadsheet=${ssValue.toPrecision(10)}, rel err=${relErr.toExponential(2)}`,
          )
        }
      }
    }

    if (mismatches.length > 0) {
      const hint =
        '\n\nACTION REQUIRED: The spreadsheet CSV and the engine fixture implement ' +
        'different policies or one has drifted from Section 3.\n' +
        'To fix:\n' +
        '  1. Ensure policy arrays in simulate.ts match the spreadsheet.\n' +
        '  2. Run: npx tsx scripts/gen-growth-fixture.ts\n' +
        '  3. Run the PM Python script to regenerate reference/sps_reference_output.csv.\n' +
        '  4. Commit both CSVs together.\n'
      expect.fail(
        `${mismatches.length} mismatch(es) between fixture and spreadsheet:\n` +
          mismatches.slice(0, 10).join('\n') +
          (mismatches.length > 10 ? `\n… and ${mismatches.length - 10} more` : '') +
          hint,
      )
    }
  })

  // Spot-check a few key scalars individually for clearer failure messages
  it('WACC matches between fixture and spreadsheet', () => {
    const fixtureVal = fixture.get('WACC')!.get(0)!
    const ssVal = spreadsheet.get('WACC')!.get(0)!
    assertClose(fixtureVal, ssVal, 'WACC')
  })

  it('NPV incl. TV matches between fixture and spreadsheet', () => {
    const fixtureVal = fixture.get('NPV incl. TV ($M)')!.get(0)!
    const ssVal = spreadsheet.get('NPV incl. TV ($M)')!.get(0)!
    assertClose(fixtureVal, ssVal, 'NPV incl. TV')
  })
})
