/**
 * Left pane — parameter inputs.
 *
 * Phase 2: Corporate parameter display + rock allocation table.
 * Phase 4: Full sliders, accordion sections, and scenario controls.
 */

import { useSimStore } from '../store/useSimStore'

function fmt(v: number, decimals = 1): string {
  return v.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })
}

export function InputsPane() {
  const scenario = useSimStore((s) => s.scenario)
  const policy = useSimStore((s) => s.policy)
  const updatePolicyRock = useSimStore((s) => s.updatePolicyRock)

  if (!scenario || !policy) {
    return (
      <aside className="h-full border-r border-gray-200 bg-gray-50 flex items-center justify-center p-4">
        <p className="text-xs text-gray-400">Loading…</p>
      </aside>
    )
  }

  const { corporate } = scenario
  const T = scenario.meta.horizonYears

  return (
    <aside className="h-full overflow-y-auto border-r border-gray-200 bg-gray-50">
      {/* Corporate Parameters */}
      <div className="px-4 py-4 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Corporate Parameters
        </h2>
        <div className="space-y-2 text-xs text-gray-700">
          <Row label="Tax rate" value={`${(corporate.taxRate * 100).toFixed(1)}%`} />
          <Row label="Cost of debt (r_D)" value={`${(corporate.rD * 100).toFixed(2)}%`} />
          <Row label="Cost of equity (r_E)" value={`${(corporate.rE * 100).toFixed(2)}%`} />
          <Row label="Starting equity (E₀)" value={`$${fmt(corporate.equity0)} M`} />
          <Row label="Starting debt (D₀)" value={`$${fmt(corporate.debt0)} M`} />
          <Row label="Leverage ceiling" value={`${corporate.leverageMax}×`} />
          <Row label="Terminal growth" value={`${(corporate.terminalGrowth * 100).toFixed(2)}%`} />
        </div>
      </div>

      {/* Rock Supply */}
      <div className="px-4 py-4 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Rock Supply (kt/yr)
        </h2>
        <div className="space-y-1 text-xs text-gray-700">
          {scenario.rockSupply.map((s, t) => (
            <Row key={t} label={`Year ${t}`} value={`${fmt(s, 0)} kt`} />
          ))}
        </div>
      </div>

      {/* Rock Allocation */}
      <div className="px-4 py-4 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Rock Allocation (kt/yr)
        </h2>
        <p className="text-xs text-gray-400 mb-3 italic">
          Full allocation controls in Phase 4. Click a cell to edit.
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="pr-2 py-1 text-left text-gray-500 font-medium">Line</th>
                {Array.from({ length: Math.min(T + 1, 6) }, (_, t) => (
                  <th key={t} className="px-1 py-1 text-center text-gray-500 font-medium w-10">
                    Y{t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenario.businessLines.map((line, i) => {
                const rowRock = policy.rock[i] ?? []
                void rowRock.reduce((s, v) => s + v, 0)
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td
                      className="pr-2 py-1 font-medium text-gray-700 truncate max-w-20"
                      title={line.name}
                    >
                      {line.shortCode}
                    </td>
                    {Array.from({ length: Math.min(T + 1, 6) }, (_, t) => (
                      <td key={t} className="px-0.5 py-0.5">
                        <input
                          type="number"
                          value={Math.round(rowRock[t] ?? 0)}
                          min={0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            if (!isNaN(val) && val >= 0) updatePolicyRock(i, t, val)
                          }}
                          className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 bg-white"
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Supply constraint check for year 0 */}
        {(() => {
          const totalY0 = policy.rock.reduce((sum, row) => sum + (row[0] ?? 0), 0)
          const supplyY0 = scenario.rockSupply[0]
          if (totalY0 > supplyY0) {
            return (
              <p className="mt-2 text-xs text-red-600 font-medium">
                ⚠ Year 0 total rock ({Math.round(totalY0)} kt) exceeds supply ({supplyY0} kt)
              </p>
            )
          }
          return (
            <p className="mt-2 text-xs text-gray-400">
              Year 0 total: {Math.round(totalY0)} / {supplyY0} kt
            </p>
          )
        })()}
      </div>

      {/* Business Lines summary */}
      <div className="px-4 py-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Business Lines
        </h2>
        <div className="space-y-2">
          {scenario.businessLines.map((line, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded p-2 text-xs text-gray-700"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{line.shortCode}</span>
                <span className="text-gray-400 text-xs truncate ml-2 flex-1 text-right">
                  {line.name}
                </span>
                {line.isLegacy && (
                  <span className="ml-1 text-xs bg-blue-100 text-blue-700 rounded px-1">
                    legacy
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 text-gray-500">
                <span>Base price: ${line.basePrice}/kt</span>
                <span>Yield: {(line.yield * 100).toFixed(0)}%</span>
                <span>Capacity: {fmt(line.initialCapacity, 0)} kt</span>
                <span>Lead time: {line.buildLeadTime}y</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  )
}
