/**
 * Left pane — full parameter input controls (Phase 4).
 *
 * Organized as collapsible accordion sections:
 * 1. Corporate parameters — sliders
 * 2. Rock supply — editable time series
 * 3. Business line parameters — tabbed, one tab per line
 * 4. Allocation policy — rock, capex, R&D tables with column-sum validation
 * 5. Scenario controls — save, load, export, import, reset
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSimStore } from '../store/useSimStore'
import type { Scenario, Policy } from '../engine/types'
import { parseScenario } from '../engine/scenario'

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------

function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide hover:bg-gray-100 transition-colors"
      >
        {title}
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slider with inline validation
// ---------------------------------------------------------------------------

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  unit?: string
  /**
   * When true the field stores values as decimals (e.g. 0.27) but shows
   * them multiplied by 100 so the user reads "27 %" instead of "0.27 %".
   * Input is parsed back by dividing by 100 before calling onChange.
   */
  pct?: boolean
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  unit,
  pct,
}: SliderFieldProps) {
  const scale = pct ? 100 : 1
  const toDisplay = (raw: number) => +(raw * scale).toFixed(8)
  const toRaw = (display: number) => display / scale

  const [inputValue, setInputValue] = useState(String(toDisplay(value)))
  const [error, setError] = useState<string | null>(null)

  // Sync display when value is changed externally (e.g. scenario reset).
  // useEffect with setState is intentional here: value is an external prop and
  // we need to mirror it into local inputValue state when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setInputValue(String(toDisplay(value)))
    setError(null)
  }, [value])

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value)
    setInputValue(String(toDisplay(raw)))
    setError(null)
    onChange(raw)
  }

  const handleText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    const display = parseFloat(e.target.value)
    if (isNaN(display)) {
      setError('Must be a number')
      return
    }
    const raw = toRaw(display)
    if (raw < min || raw > max) {
      setError(`Must be between ${format(min)} and ${format(max)}`)
    } else {
      setError(null)
      onChange(raw)
    }
  }

  const displayMin = toDisplay(min)
  const displayMax = toDisplay(max)
  const displayStep = +(step * scale).toFixed(8)
  const rawFromInput = isNaN(parseFloat(inputValue))
    ? min
    : Math.min(Math.max(toRaw(parseFloat(inputValue)), min), max)

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={inputValue}
            onChange={handleText}
            step={displayStep}
            min={displayMin}
            max={displayMax}
            className={`w-20 text-right text-xs border rounded px-1 py-0.5 ${
              error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-400'
            } focus:outline-none`}
          />
          {unit && <span className="text-xs text-gray-400">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={rawFromInput}
        onChange={handleSlider}
        className="w-full h-1 rounded appearance-none bg-gray-200 accent-blue-500"
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Corporate Parameters accordion
// ---------------------------------------------------------------------------

function CorporateSection() {
  const scenario = useSimStore((s) => s.scenario)
  const setScenarioStore = useSimStore((s) => s.setScenario)
  const isIllustrative = useSimStore((s) => s.isIllustrative)

  const update = useCallback(
    (patch: Partial<Scenario['corporate']>) => {
      if (!scenario) return
      const newScenario: Scenario = {
        ...scenario,
        corporate: { ...scenario.corporate, ...patch },
      }
      setScenarioStore(newScenario, isIllustrative)
    },
    [scenario, setScenarioStore, isIllustrative],
  )

  if (!scenario) return null

  const corp = scenario.corporate
  return (
    <div className="space-y-0 pt-2">
      <SliderField
        label="Tax rate (T_c)"
        value={corp.taxRate}
        pct
        min={0}
        max={0.5}
        step={0.01}
        format={(v) => `${(v * 100).toFixed(0)}%`}
        unit="%"
        onChange={(v) => update({ taxRate: v })}
      />
      <SliderField
        label="Cost of debt (r_D)"
        value={corp.rD}
        pct
        min={0.01}
        max={0.15}
        step={0.001}
        format={(v) => `${(v * 100).toFixed(2)}%`}
        unit="%"
        onChange={(v) => update({ rD: v })}
      />
      <SliderField
        label="Cost of equity (r_E)"
        value={corp.rE}
        pct
        min={0.05}
        max={0.25}
        step={0.001}
        format={(v) => `${(v * 100).toFixed(2)}%`}
        unit="%"
        onChange={(v) => update({ rE: v })}
      />
      <SliderField
        label="Leverage ceiling (L_max)"
        value={corp.leverageMax}
        min={0.5}
        max={6}
        step={0.1}
        format={(v) => `${v.toFixed(1)}×`}
        unit="×"
        onChange={(v) => update({ leverageMax: v })}
      />
      <SliderField
        label="Terminal growth (g_T)"
        value={corp.terminalGrowth}
        pct
        min={0}
        max={0.06}
        step={0.001}
        format={(v) => `${(v * 100).toFixed(1)}%`}
        unit="%"
        onChange={(v) => update({ terminalGrowth: v })}
      />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <NumericField
          label="Equity₀ ($M)"
          value={corp.equity0}
          min={0}
          onChange={(v) => update({ equity0: v })}
        />
        <NumericField
          label="Debt₀ ($M)"
          value={corp.debt0}
          min={0}
          onChange={(v) => update({ debt0: v })}
        />
      </div>
    </div>
  )
}

function NumericField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: number
  min: number
  onChange: (v: number) => void
}) {
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      <input
        type="number"
        defaultValue={value}
        min={min}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (isNaN(v) || v < min) {
            setError(`Must be ≥ ${min}`)
          } else {
            setError(null)
            onChange(v)
          }
        }}
        className={`w-full text-xs border rounded px-2 py-1 focus:outline-none ${
          error ? 'border-red-400' : 'border-gray-200 focus:border-blue-400'
        }`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rock Supply accordion
// ---------------------------------------------------------------------------

function RockSupplySection() {
  const scenario = useSimStore((s) => s.scenario)
  const setScenarioStore = useSimStore((s) => s.setScenario)
  const isIllustrative = useSimStore((s) => s.isIllustrative)

  if (!scenario) return null

  const update = (t: number, v: number) => {
    const newSupply = [...scenario.rockSupply]
    newSupply[t] = v
    setScenarioStore({ ...scenario, rockSupply: newSupply }, isIllustrative)
  }

  return (
    <div className="pt-2">
      <p className="text-xs text-gray-400 mb-2">Kilotons per year available to SPS each year.</p>
      <div className="space-y-1">
        {scenario.rockSupply.map((s, t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10">Year {t}</span>
            <input
              type="number"
              defaultValue={s}
              min={0}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && v >= 0) update(t, v)
              }}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-blue-400"
            />
            <span className="text-xs text-gray-400">kt</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Business Line Parameters — tabbed
// ---------------------------------------------------------------------------

function BusinessLineSection() {
  const scenario = useSimStore((s) => s.scenario)
  const setScenarioStore = useSimStore((s) => s.setScenario)
  const isIllustrative = useSimStore((s) => s.isIllustrative)
  const [activeTab, setActiveTab] = useState(0)

  if (!scenario) return null

  const updateLine = (lineIndex: number, patch: Partial<Scenario['businessLines'][number]>) => {
    const newLines = scenario.businessLines.map((l, i) =>
      i === lineIndex ? { ...l, ...patch } : l,
    )
    setScenarioStore({ ...scenario, businessLines: newLines }, isIllustrative)
  }

  const line = scenario.businessLines[activeTab]

  return (
    <div className="pt-2">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-3">
        {scenario.businessLines.map((l, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              i === activeTab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {l.shortCode}
            {l.isLegacy && ' ●'}
          </button>
        ))}
      </div>

      {/* Active line name */}
      <p className="text-xs font-semibold text-gray-700 mb-3">
        {line.name}
        {line.isLegacy && (
          <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded px-1">legacy</span>
        )}
      </p>

      {/* Sliders */}
      <SliderField
        label="Base price (p₀, $/kt)"
        value={line.basePrice}
        min={0.01}
        max={5}
        step={0.01}
        format={(v) => `$${v.toFixed(3)}`}
        unit="$/kt"
        onChange={(v) => updateLine(activeTab, { basePrice: v })}
      />
      <SliderField
        label="Price erosion (π, %/yr)"
        value={line.priceErosion}
        pct
        min={0}
        max={0.1}
        step={0.001}
        format={(v) => `${(v * 100).toFixed(1)}%`}
        unit="%"
        onChange={(v) => updateLine(activeTab, { priceErosion: v })}
      />
      <SliderField
        label="Base unit cost (c₀, $/kt)"
        value={line.baseUnitCost}
        min={0.01}
        max={3}
        step={0.01}
        format={(v) => `$${v.toFixed(3)}`}
        unit="$/kt"
        onChange={(v) => updateLine(activeTab, { baseUnitCost: v })}
      />
      <SliderField
        label="Learning exponent (β)"
        value={line.learningExponent}
        min={0}
        max={0.4}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => updateLine(activeTab, { learningExponent: v })}
      />
      <SliderField
        label="Yield (η, kt product/kt rock)"
        value={line.yield}
        min={0.1}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => updateLine(activeTab, { yield: v })}
      />
      <SliderField
        label="Capex unit cost (κ, $/ktpa)"
        value={line.capexUnitCost}
        min={0.1}
        max={10}
        step={0.1}
        format={(v) => `$${v.toFixed(2)}M`}
        unit="$M"
        onChange={(v) => updateLine(activeTab, { capexUnitCost: v })}
      />
      <SliderField
        label="R&D productivity (μ)"
        value={line.rdProductivity}
        min={0}
        max={2}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(v) => updateLine(activeTab, { rdProductivity: v })}
      />
      <SliderField
        label="R&D conversion rate (φ, %/yr)"
        value={line.rdConversion}
        pct
        min={0}
        max={0.5}
        step={0.01}
        format={(v) => `${(v * 100).toFixed(0)}%`}
        unit="%"
        onChange={(v) => updateLine(activeTab, { rdConversion: v })}
      />
      {line.isLegacy && (
        <SliderField
          label="Legacy floor (F, kt/yr)"
          value={line.legacyFloor}
          min={0}
          max={5000}
          step={50}
          format={(v) => `${v.toFixed(0)} kt`}
          unit="kt"
          onChange={(v) => updateLine(activeTab, { legacyFloor: v })}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Allocation Policy — rock, capex, R&D tables
// ---------------------------------------------------------------------------

type AllocationType = 'rock' | 'capex' | 'rd'

function AllocationTable({
  type,
  scenario,
  policy,
}: {
  type: AllocationType
  scenario: Scenario
  policy: Policy
}) {
  const updateRock = useSimStore((s) => s.updatePolicyRock)
  const updateCapex = useSimStore((s) => s.updatePolicyCapex)
  const updateRd = useSimStore((s) => s.updatePolicyRd)
  const T = scenario.meta.horizonYears
  const years = Array.from({ length: T + 1 }, (_, t) => t)
  const shownYears = years.slice(0, 8)

  const updateFn = type === 'rock' ? updateRock : type === 'capex' ? updateCapex : updateRd
  const policyData = type === 'rock' ? policy.rock : type === 'capex' ? policy.capex : policy.rd

  const labels = {
    rock: 'Rock allocation (kt/yr)',
    capex: 'Capex ($M/yr)',
    rd: 'R&D spending ($M/yr)',
  }
  const units = { rock: 'kt', capex: '$M', rd: '$M' }

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-600 mb-2">{labels[type]}</p>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr>
              <th className="pr-2 py-1 text-left text-gray-500 font-medium sticky left-0 bg-gray-50">
                Line
              </th>
              {shownYears.map((t) => (
                <th key={t} className="px-1 py-1 text-center text-gray-400 font-medium w-14">
                  Y{t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.businessLines.map((line, i) => {
              // Column sums for rock supply constraint check
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td
                    className="pr-2 py-0.5 font-semibold text-gray-700 sticky left-0 bg-inherit"
                    title={line.name}
                  >
                    {line.shortCode}
                  </td>
                  {shownYears.map((t) => {
                    const val = policyData[i]?.[t] ?? 0
                    const isOverSupply =
                      type === 'rock' &&
                      policy.rock.reduce((sum, row) => sum + (row[t] ?? 0), 0) >
                        scenario.rockSupply[t]
                    return (
                      <td key={t} className="px-0.5 py-0.5">
                        <input
                          type="number"
                          value={Math.round(val * 10) / 10}
                          min={0}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v >= 0) updateFn(i, t, v)
                          }}
                          className={`w-14 text-center text-xs border rounded px-1 py-0.5 focus:outline-none ${
                            isOverSupply
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-200 focus:border-blue-400'
                          }`}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100">
              <td className="pr-2 py-1 text-xs font-semibold text-gray-500">Total</td>
              {shownYears.map((t) => {
                const total = policyData.reduce((sum, row) => sum + (row[t] ?? 0), 0)
                const supply = type === 'rock' ? scenario.rockSupply[t] : null
                const overSupply = supply !== null && total > supply
                return (
                  <td
                    key={t}
                    className={`px-1 py-1 text-center text-xs font-medium ${
                      overSupply ? 'text-red-600' : 'text-gray-600'
                    }`}
                  >
                    {Math.round(total)}
                    {supply !== null && (
                      <span className="block text-gray-400 text-xs">/{Math.round(supply)}</span>
                    )}
                    <span className="text-gray-300 text-xs">{units[type]}</span>
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      {T > 7 && (
        <p className="text-xs text-gray-400 mt-1 italic">
          Showing years 0–7. Full horizon in exported scenario file.
        </p>
      )}
    </div>
  )
}

function AllocationSection() {
  const scenario = useSimStore((s) => s.scenario)
  const policy = useSimStore((s) => s.policy)

  if (!scenario || !policy) return null

  return (
    <div className="pt-2">
      <AllocationTable type="rock" scenario={scenario} policy={policy} />
      <AllocationTable type="capex" scenario={scenario} policy={policy} />
      <AllocationTable type="rd" scenario={scenario} policy={policy} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scenario Controls
// ---------------------------------------------------------------------------

function ScenarioControls() {
  const scenario = useSimStore((s) => s.scenario)
  const policy = useSimStore((s) => s.policy)
  const setScenarioStore = useSimStore((s) => s.setScenario)
  const isIllustrative = useSimStore((s) => s.isIllustrative)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const exportScenario = () => {
    if (!scenario) return
    const blob = new Blob([JSON.stringify(scenario, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scenario_${scenario.meta.name.replace(/\s+/g, '_').toLowerCase()}.json`
    a.click()
  }

  const exportPolicy = () => {
    if (!policy) return
    const blob = new Blob([JSON.stringify(policy, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'policy.json'
    a.click()
  }

  const importScenario = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string)
        const parsed = parseScenario(raw)
        setScenarioStore(parsed, parsed.meta.isIllustrative)
        setMessage(`Loaded: ${parsed.meta.name}`)
      } catch (err) {
        setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const resetToDefaults = () => {
    window.location.href = '/?scenario=illustrative'
  }

  return (
    <div className="pt-2 space-y-2">
      <button
        onClick={exportScenario}
        className="w-full text-xs border border-gray-300 text-gray-700 rounded py-1.5 hover:bg-gray-50 transition-colors"
      >
        ↓ Export scenario as JSON
      </button>
      <button
        onClick={exportPolicy}
        className="w-full text-xs border border-gray-300 text-gray-700 rounded py-1.5 hover:bg-gray-50 transition-colors"
      >
        ↓ Export policy as JSON
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full text-xs border border-blue-300 text-blue-700 rounded py-1.5 hover:bg-blue-50 transition-colors"
      >
        ↑ Import scenario JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={importScenario}
        className="hidden"
      />
      <button
        onClick={resetToDefaults}
        className="w-full text-xs border border-amber-300 text-amber-700 rounded py-1.5 hover:bg-amber-50 transition-colors"
      >
        ↺ Reset to illustrative defaults
      </button>

      {message && (
        <p
          className={`text-xs p-2 rounded ${
            message.startsWith('Error')
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          {message}
        </p>
      )}

      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Active scenario:{' '}
          <span className="font-medium text-gray-600">{scenario?.meta.name ?? '—'}</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isIllustrative ? '⚠ Illustrative data' : '🔒 OCP confidential'}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root InputsPane
// ---------------------------------------------------------------------------

export function InputsPane() {
  return (
    <aside className="h-full overflow-y-auto border-r border-gray-200 bg-gray-50">
      <AccordionSection title="Corporate Parameters" defaultOpen={true}>
        <CorporateSection />
      </AccordionSection>

      <AccordionSection title="Rock Supply">
        <RockSupplySection />
      </AccordionSection>

      <AccordionSection title="Business Line Parameters">
        <BusinessLineSection />
      </AccordionSection>

      <AccordionSection title="Allocation Policy">
        <AllocationSection />
      </AccordionSection>

      <AccordionSection title="Scenario Controls">
        <ScenarioControls />
      </AccordionSection>
    </aside>
  )
}
