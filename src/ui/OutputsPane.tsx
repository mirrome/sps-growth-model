/**
 * Center pane — KPI tiles, charts, and constraint status strip.
 *
 * Phase 2: KPI tiles implemented.
 * Phase 3: All 8 charts and constraint strip added.
 */

import { useSimStore } from '../store/useSimStore'
import { AllCharts } from './Charts'
import { ConstraintStrip } from './ConstraintStrip'

interface KpiTileProps {
  label: string
  value: string
  unit: string
  delta?: string
  deltaPositive?: boolean
  highlight?: 'warn' | 'danger' | 'normal'
}

function KpiTile({ label, value, unit, delta, deltaPositive, highlight = 'normal' }: KpiTileProps) {
  const borderColor =
    highlight === 'danger'
      ? 'border-red-400'
      : highlight === 'warn'
        ? 'border-amber-400'
        : 'border-gray-200'

  return (
    <div className={`bg-white border ${borderColor} rounded-lg p-4 shadow-sm`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${deltaPositive ? 'text-emerald-600' : 'text-red-500'}`}>
          {deltaPositive ? '▲' : '▼'} {delta} vs reference
        </p>
      )}
    </div>
  )
}

function fmt(value: number, decimals = 0): string {
  if (!isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })
}

export function OutputsPane() {
  const result = useSimStore((s) => s.result)
  const scenario = useSimStore((s) => s.scenario)
  const policy = useSimStore((s) => s.policy)
  const constraints = useSimStore((s) => s.constraints)

  if (!result || !scenario || !policy || !constraints) {
    return (
      <main className="h-full overflow-y-auto bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading simulation…</p>
      </main>
    )
  }

  const T = scenario.meta.horizonYears

  const npvWithTV = result.npv
  const npvExTV = result.npvExTV
  const terminalRevenue = result.lines.reduce((sum, line) => sum + line.revenue[T], 0)
  const peakLeverage = Math.max(
    ...result.debt.map((d, t) => (result.ebitda[t] > 0 ? d / result.ebitda[t] : 0)),
  )

  const leverageHighlight =
    peakLeverage > scenario.corporate.leverageMax
      ? 'danger'
      : peakLeverage > scenario.corporate.leverageMax * 0.9
        ? 'warn'
        : 'normal'

  return (
    <main className="h-full overflow-y-auto bg-gray-50 p-6">
      {/* KPI Tiles */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Key Performance Indicators
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <KpiTile
            label="NPV (incl. terminal value)"
            value={fmt(npvWithTV)}
            unit="USD millions"
            highlight={npvWithTV < 0 ? 'danger' : 'normal'}
          />
          <KpiTile
            label="NPV (excl. terminal value)"
            value={fmt(npvExTV)}
            unit="USD millions"
            highlight={npvExTV < 0 ? 'warn' : 'normal'}
          />
          <KpiTile label={`Revenue — Year ${T}`} value={fmt(terminalRevenue)} unit="USD millions" />
          <KpiTile
            label="Peak leverage (D/EBITDA)"
            value={fmt(peakLeverage, 2)}
            unit={`× (ceiling ${scenario.corporate.leverageMax}×)`}
            highlight={leverageHighlight}
          />
        </div>
      </section>

      {/* WACC readout */}
      <section className="mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Model Parameters
          </p>
          <div className="flex gap-8 text-sm text-gray-700">
            <span>
              WACC: <strong>{(result.wacc * 100).toFixed(2)}%</strong>
            </span>
            <span>
              Terminal value: <strong>{fmt(result.terminalValue)} M</strong>
            </span>
            <span>
              Horizon: <strong>{T} years</strong>
            </span>
            <span>
              Lines: <strong>{scenario.businessLines.length}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Simulator warnings */}
      {result.warnings.length > 0 && (
        <section className="mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
              Diagnostic warnings ({result.warnings.length})
            </p>
            <ul className="space-y-1">
              {result.warnings.map((w, idx) => (
                <li key={idx} className="text-xs text-amber-700">
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* FCF summary table */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Free Cash Flow by Year
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Year</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">EBITDA (M)</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">FCF (M)</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Debt (M)</th>
              </tr>
            </thead>
            <tbody>
              {result.fcf.map((fcf, t) => (
                <tr key={t} className={`border-b border-gray-100 ${fcf < 0 ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-1.5 font-medium text-gray-700">{t}</td>
                  <td className="px-3 py-1.5 text-right text-gray-600">
                    {fmt(result.ebitda[t], 1)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right font-medium ${fcf < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                  >
                    {fmt(fcf, 1)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-600">{fmt(result.debt[t], 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Constraint Status Strip */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Constraint Status
        </h2>
        <ConstraintStrip status={constraints} leverageMax={scenario.corporate.leverageMax} />
      </section>

      {/* All 8 Charts */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Charts
        </h2>
        <AllCharts result={result} scenario={scenario} policy={policy} />
      </section>
    </main>
  )
}
