/**
 * Constraint status strip — §5.3.3.
 *
 * Shows, for each constraint family, whether it is satisfied, binding, or violated
 * in any year. Red for violation, amber for binding (< 5% slack), green for satisfied.
 *
 * Six indicators (2 rows of 3):
 *   Rock supply | Capex budget | Leverage
 *   Debt gate   | Legacy floors | Capacity bounds
 *
 * "Capex budget" catches "total funding (cash + allowed debt) is insufficient."
 * "Debt gate" catches specifically "we are trying to raise debt in years we cannot."
 * These are deliberately separate so the user can diagnose the binding constraint.
 */

import type { ConstraintStatus } from '../engine/types'

interface ConstraintStripProps {
  status: ConstraintStatus
  leverageMax: number
}

interface IndicatorProps {
  label: string
  satisfied: boolean
  binding: boolean
  detail: string
}

function Indicator({ label, satisfied, binding, detail }: IndicatorProps) {
  const bg = !satisfied
    ? 'bg-red-100 border-red-300'
    : binding
      ? 'bg-amber-50 border-amber-200'
      : 'bg-emerald-50 border-emerald-200'
  const dot = !satisfied ? 'bg-red-500' : binding ? 'bg-amber-400' : 'bg-emerald-500'
  const text = !satisfied ? 'text-red-700' : binding ? 'text-amber-700' : 'text-emerald-700'

  return (
    <div className={`flex items-start gap-2 border rounded px-2 py-1.5 ${bg}`}>
      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <div>
        <p className={`text-xs font-semibold ${text}`}>{label}</p>
        <p className="text-xs text-gray-500">{detail}</p>
      </div>
    </div>
  )
}

function summarizeStatuses(statuses: { satisfied: boolean; slack: number }[]): {
  allSatisfied: boolean
  binding: boolean
  worstSlack: number
} {
  const allSatisfied = statuses.every((s) => s.satisfied)
  const worstSlack = statuses.length > 0 ? Math.min(...statuses.map((s) => s.slack)) : 0
  const binding = allSatisfied && worstSlack >= 0 && worstSlack < 50
  return { allSatisfied, binding, worstSlack }
}

export function ConstraintStrip({ status, leverageMax }: ConstraintStripProps) {
  // Rock supply
  const rock = summarizeStatuses(status.rockSupply)

  // Capex budget (cash + allowed debt)
  const capex = summarizeStatuses(status.capexBudget)

  // Leverage
  const leverage = summarizeStatuses(status.leverage.filter((s) => isFinite(s.slack)))

  // Debt-raising gate (only gate-years contribute; open years have slack=Infinity)
  const gateYears = status.debtGate.filter((s) => isFinite(s.slack))
  const debtGateActive = gateYears.length > 0
  const gate = debtGateActive
    ? summarizeStatuses(gateYears)
    : { allSatisfied: true, binding: false, worstSlack: Infinity }

  // Legacy floors (all legacy lines, all years)
  const legacyStatuses = status.legacyFloor.flat().filter((s) => s !== null) as {
    satisfied: boolean
    slack: number
    limit: number
  }[]
  const legacy =
    legacyStatuses.length > 0
      ? summarizeStatuses(legacyStatuses)
      : { allSatisfied: true, binding: false, worstSlack: Infinity }

  // Capacity
  const capacityStatuses = status.capacity.flat()
  const capacity = summarizeStatuses(capacityStatuses)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Constraint Status
        </h3>
        {status.anyViolation && (
          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
            Violations detected
          </span>
        )}
        {!status.anyViolation && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
            All constraints satisfied
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Indicator
          label="Rock supply"
          satisfied={rock.allSatisfied}
          binding={rock.binding}
          detail={
            rock.allSatisfied
              ? `Slack: ${rock.worstSlack.toFixed(0)} kt`
              : `Over by ${(-rock.worstSlack).toFixed(0)} kt`
          }
        />
        <Indicator
          label="Capex budget"
          satisfied={capex.allSatisfied}
          binding={capex.binding}
          detail={
            capex.allSatisfied
              ? `Slack: ${fmtM(capex.worstSlack)}`
              : `Over by ${fmtM(-capex.worstSlack)}`
          }
        />
        <Indicator
          label={`Leverage (≤ ${leverageMax}×)`}
          satisfied={leverage.allSatisfied}
          binding={leverage.binding}
          detail={
            leverage.allSatisfied
              ? `Headroom: ${leverage.worstSlack.toFixed(2)}×`
              : `Exceeds by ${(-leverage.worstSlack).toFixed(2)}×`
          }
        />
        <Indicator
          label="Debt-raising gate"
          satisfied={gate.allSatisfied}
          binding={gate.binding}
          detail={
            !debtGateActive
              ? 'No gate years in scenario'
              : gate.allSatisfied
                ? `Slack: ${fmtM(gate.worstSlack)}`
                : `Over cash by ${fmtM(-gate.worstSlack)}`
          }
        />
        <Indicator
          label="Legacy floors"
          satisfied={legacy.allSatisfied}
          binding={legacy.binding}
          detail={
            legacyStatuses.length === 0
              ? 'No legacy lines'
              : legacy.allSatisfied
                ? `Slack: ${legacy.worstSlack.toFixed(0)} kt`
                : `Shortfall: ${(-legacy.worstSlack).toFixed(0)} kt`
          }
        />
        <Indicator
          label="Capacity bounds"
          satisfied={capacity.allSatisfied}
          binding={capacity.binding}
          detail={capacity.allSatisfied ? 'All within capacity' : 'Output exceeds capacity'}
        />
      </div>
    </div>
  )
}

function fmtM(v: number): string {
  return `$${v.toFixed(1)}M`
}
