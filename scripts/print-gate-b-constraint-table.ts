/**
 * Prints per-year debt gate and capex budget status for the growth baseline
 * on scenario.illustrative.json — for PM Gate B diagnostics.
 *
 *   npx tsx scripts/print-gate-b-constraint-table.ts
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseScenario } from '../src/engine/scenario'
import { simulate, buildGrowthBaselinePolicy } from '../src/engine/simulate'
import { evaluateConstraints } from '../src/engine/constraints'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scenarioPath = resolve(__dirname, '../public/scenario.illustrative.json')
const scenario = parseScenario(JSON.parse(readFileSync(scenarioPath, 'utf-8')) as unknown)
const policy = buildGrowthBaselinePolicy(scenario)
const result = simulate(scenario, policy)
const c = evaluateConstraints(scenario, policy, result)
const base = scenario.meta.baseYear

const totalCapex = (t: number) => policy.capex.reduce((s, row) => s + row[t], 0)

console.log(
  'year\tcalendar\tcanRaiseDebt\tcapex_M\tdebtGate_slack_M\tcapexBudget_slack_M\tdebtGate_ok\tcapexBudget_ok',
)
for (let t = 0; t <= scenario.meta.horizonYears; t++) {
  const yr = base + t
  const canRaise = scenario.corporate.canRaiseDebt?.[t] ?? true
  console.log(
    [
      t,
      yr,
      canRaise,
      totalCapex(t).toFixed(1),
      Number.isFinite(c.debtGate[t].slack) ? c.debtGate[t].slack.toFixed(1) : 'inf',
      c.capexBudget[t].slack.toFixed(1),
      c.debtGate[t].satisfied,
      c.capexBudget[t].satisfied,
    ].join('\t'),
  )
}

const worstCapexBudget = [...c.capexBudget.entries()]
  .map(([t, s]) => ({ t, slack: s.slack }))
  .reduce((a, b) => (a.slack < b.slack ? a : b))
console.log('')
console.log(
  `Worst capex-budget slack: year ${worstCapexBudget.t}, slack $${worstCapexBudget.slack.toFixed(1)}M`,
)
