/**
 * Fixture generator — writes reference/calibration/growth_baseline_fixture.csv
 *
 * Run once whenever the growth baseline policy arrays or the illustrative
 * scenario change, then commit the output CSV alongside the code change.
 * The calibration test reads this CSV and asserts the engine reproduces
 * every value to 1e-6 relative tolerance.
 *
 * Usage:
 *   npx tsx scripts/gen-growth-fixture.ts
 *
 * The script is deterministic: same inputs → same CSV. The tolerance in the
 * test is 1e-6 to accommodate minor IEEE 754 differences across JS runtimes,
 * not floating-point non-determinism (which does not apply here).
 *
 * ─── TWO-ARTIFACT REGENERATION CHECKLIST ────────────────────────────────────
 * This fixture and reference/sps_reference_output.csv must always be committed
 * together. They are produced by independent code paths (TypeScript engine vs.
 * Excel formulas) and must agree to 1e-6 or calibration.spreadsheet-consistency
 * .test.ts will fail. Before committing a new fixture:
 *
 *   1. Run this script:
 *        npx tsx scripts/gen-growth-fixture.ts
 *   2. Ask the PM to rerun their Python build script and provide an updated
 *        reference/sps_reference_output.csv
 *   3. Commit BOTH CSVs in the same commit.
 *
 * A policy change that updates only one artifact will be caught by CI.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseScenario } from '../src/engine/scenario.js'
import { simulate, buildGrowthBaselinePolicy } from '../src/engine/simulate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCENARIO_PATH = resolve(__dirname, '../public/scenario.illustrative.json')
const OUT_PATH = resolve(__dirname, '../reference/calibration/growth_baseline_fixture.csv')

const SHORT_CODES = ['USS', 'SPN', 'FIS', 'EMS', 'ANS', 'NPS']

function fmt(n: number): string {
  // Enough precision to reconstruct to 1e-6 relative for all values in range
  return n.toPrecision(15)
}

const raw = JSON.parse(readFileSync(SCENARIO_PATH, 'utf-8')) as unknown
const scenario = parseScenario(raw)
const BASE_YEAR = scenario.meta.baseYear
const T = scenario.meta.horizonYears
const policy = buildGrowthBaselinePolicy(scenario)
const result = simulate(scenario, policy)

const rows: string[] = ['metric,year,value']

// Scalars — year column is empty (stored as 0 in the lookup)
rows.push(`WACC,,${fmt(result.wacc)}`)
rows.push(`Terminal value ($M),,${fmt(result.terminalValue)}`)
rows.push(`NPV excl. TV ($M),,${fmt(result.npvExTV)}`)
rows.push(`NPV incl. TV ($M),,${fmt(result.npv)}`)

// Per-year aggregates
for (let t = 0; t <= T; t++) {
  const yr = BASE_YEAR + t
  rows.push(`FCF ($M),${yr},${fmt(result.fcf[t])}`)
}
for (let t = 0; t <= T; t++) {
  const yr = BASE_YEAR + t
  rows.push(`EBITDA total ($M),${yr},${fmt(result.ebitda[t])}`)
}
for (let t = 0; t <= T; t++) {
  const yr = BASE_YEAR + t
  const rev = result.lines.reduce((s, l) => s + l.revenue[t], 0)
  rows.push(`Revenue total ($M),${yr},${fmt(rev)}`)
}

// Per-line per-year
for (let i = 0; i < SHORT_CODES.length; i++) {
  const code = SHORT_CODES[i]
  for (let t = 0; t <= T; t++) {
    const yr = BASE_YEAR + t
    rows.push(`Revenue ${code},${yr},${fmt(result.lines[i].revenue[t])}`)
  }
}
for (let i = 0; i < SHORT_CODES.length; i++) {
  const code = SHORT_CODES[i]
  for (let t = 0; t <= T; t++) {
    const yr = BASE_YEAR + t
    rows.push(`EBITDA ${code},${yr},${fmt(result.lines[i].ebitda[t])}`)
  }
}
for (let i = 0; i < SHORT_CODES.length; i++) {
  const code = SHORT_CODES[i]
  for (let t = 0; t <= T; t++) {
    const yr = BASE_YEAR + t
    rows.push(`Q ${code},${yr},${fmt(result.lines[i].output[t])}`)
  }
}
for (let i = 0; i < SHORT_CODES.length; i++) {
  const code = SHORT_CODES[i]
  for (let t = 0; t <= T; t++) {
    const yr = BASE_YEAR + t
    rows.push(`K ${code},${yr},${fmt(result.lines[i].capacity[t])}`)
  }
}

writeFileSync(OUT_PATH, rows.join('\n') + '\n', 'utf-8')
console.log(`Wrote ${rows.length - 1} data rows to ${OUT_PATH}`)
