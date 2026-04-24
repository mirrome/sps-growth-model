/**
 * All 8 required charts from §5.3.2.
 *
 * Each chart:
 * - Is wired to live simulation output
 * - Has a hover tooltip with exact values
 * - Has unit labels on axes
 * - Has a PNG export button
 */

import { useRef, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { SimResult, Scenario } from '../engine/types'
import { LINE_COLORS, fmtMillions, fmtKt, fmtRatio, fmtPrice, exportChartAsPng } from './chartUtils'

/** Toggle state for per-series show/hide on legend click. */
function useSeriesToggle() {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  /** Legend formatter — strikethrough + dimmed when hidden. */
  const legendFormatter = (value: string) => (
    <span
      style={{
        textDecoration: hidden.has(value) ? 'line-through' : 'none',
        opacity: hidden.has(value) ? 0.4 : 1,
        cursor: 'pointer',
      }}
    >
      {value}
    </span>
  )
  return { hidden, toggle, legendFormatter }
}

interface ChartsProps {
  result: SimResult
  scenario: Scenario
}

// Recharts v3 passes value as unknown; these helpers keep TypeScript happy.
function safeNum(v: unknown): number {
  return typeof v === 'number' ? v : 0
}
function tooltipFormatter(fmt: (v: number, n: string) => [string, string]) {
  return (value: unknown, name: unknown) => fmt(safeNum(value), String(name ?? ''))
}
function tooltipLabel(label: unknown) {
  return `Year ${label}`
}
function tickYear(t: unknown) {
  return `Y${t}`
}

/** Shared chart wrapper with title, unit hint, collapse toggle, and PNG export button. */
function ChartCard({
  title,
  unit,
  children,
  chartId,
  defaultCollapsed = false,
}: {
  title: string
  unit: string
  children: React.ReactNode
  chartId: string
  defaultCollapsed?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      {/* Header — always visible */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-gray-400 text-xs w-4 shrink-0 transition-transform duration-200"
            style={{
              display: 'inline-block',
              transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 truncate">{title}</h3>
            {!collapsed && <p className="text-xs text-gray-400">{unit}</p>}
          </div>
        </div>
        {/* PNG export — stop propagation so click doesn't toggle collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            exportChartAsPng(containerRef.current, chartId)
          }}
          className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5 transition-colors shrink-0 ml-2"
          title="Export as PNG"
        >
          ↓ PNG
        </button>
      </div>

      {/* Chart body — hidden when collapsed */}
      {!collapsed && (
        <div ref={containerRef} className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

const CHART_HEIGHT = 200

// ---------------------------------------------------------------------------
// Build data arrays shared across charts
// ---------------------------------------------------------------------------

function buildYearData(result: SimResult, scenario: Scenario) {
  const T = scenario.meta.horizonYears
  return Array.from({ length: T + 1 }, (_, t) => {
    const row: Record<string, number> = { year: t }
    scenario.businessLines.forEach((line, i) => {
      row[line.shortCode] = result.lines[i].revenue[t]
    })
    return row
  })
}

function buildFCFData(result: SimResult, scenario: Scenario) {
  const T = scenario.meta.horizonYears
  return Array.from({ length: T + 1 }, (_, t) => ({
    year: t,
    FCF: result.fcf[t],
    EBITDA: result.ebitda[t],
  }))
}

function buildCapacityUtilData(result: SimResult, scenario: Scenario) {
  const T = scenario.meta.horizonYears
  return scenario.businessLines.map((line, i) => ({
    shortCode: line.shortCode,
    name: line.name,
    data: Array.from({ length: T + 1 }, (_, t) => ({
      year: t,
      utilization:
        result.lines[i].capacity[t] > 0
          ? Math.min((result.lines[i].output[t] / result.lines[i].capacity[t]) * 100, 100)
          : 0,
    })),
  }))
}

function buildProductionData(result: SimResult, scenario: Scenario) {
  const T = scenario.meta.horizonYears
  return Array.from({ length: T + 1 }, (_, t) => {
    const row: Record<string, number> = { year: t }
    scenario.businessLines.forEach((line, i) => {
      row[line.shortCode] = result.lines[i].output[t]
    })
    return row
  })
}

function buildRockData(scenario: Scenario, policy: { rock: number[][] }) {
  const T = scenario.meta.horizonYears
  return Array.from({ length: T + 1 }, (_, t) => {
    const row: Record<string, number> = {
      year: t,
      supply: scenario.supply[t],
    }
    scenario.businessLines.forEach((line, i) => {
      row[line.shortCode] = policy.rock[i]?.[t] ?? 0
    })
    return row
  })
}

function buildLeverageData(result: SimResult, scenario: Scenario) {
  const T = scenario.meta.horizonYears
  return Array.from({ length: T + 1 }, (_, t) => ({
    year: t,
    leverage: result.ebitda[t] > 0 ? result.debt[t] / result.ebitda[t] : 0,
  }))
}

function buildUnitCostData(result: SimResult, scenario: Scenario) {
  const T = scenario.meta.horizonYears
  return Array.from({ length: T + 1 }, (_, t) => {
    const row: Record<string, number> = { year: t }
    scenario.businessLines.forEach((line, i) => {
      row[line.shortCode] = result.lines[i].unitCost[t]
    })
    return row
  })
}

function buildLaunchedRevData(result: SimResult, scenario: Scenario) {
  const T = scenario.meta.horizonYears
  return Array.from({ length: T + 1 }, (_, t) => {
    const row: Record<string, number> = { year: t }
    scenario.businessLines.forEach((line, i) => {
      row[line.shortCode] = result.lines[i].launchedRevenue[t]
    })
    return row
  })
}

// ---------------------------------------------------------------------------
// Chart 1: Revenue by line — stacked area
// ---------------------------------------------------------------------------
function RevenueChart({ result, scenario }: ChartsProps) {
  const data = buildYearData(result, scenario)
  const { hidden, toggle, legendFormatter } = useSeriesToggle()
  return (
    <ChartCard title="Revenue by Business Line" unit="USD millions" chartId="revenue-by-line">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tickFormatter={tickYear} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmtMillions} tick={{ fontSize: 11 }} width={52} />
          <Tooltip
            formatter={tooltipFormatter((v, n) => [fmtMillions(v), n])}
            labelFormatter={tooltipLabel}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
            formatter={legendFormatter}
            onClick={(p) => toggle(String(p.value))}
          />
          {scenario.businessLines.map((line, i) => (
            <Area
              key={line.shortCode}
              type="monotone"
              dataKey={line.shortCode}
              stackId="1"
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              fill={LINE_COLORS[i % LINE_COLORS.length]}
              fillOpacity={0.7}
              name={line.shortCode}
              hide={hidden.has(line.shortCode)}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 2: Free cash flow — bar chart
// ---------------------------------------------------------------------------
function FCFChart({ result, scenario }: ChartsProps) {
  const data = buildFCFData(result, scenario)
  return (
    <ChartCard title="Free Cash Flow" unit="USD millions" chartId="free-cash-flow">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tickFormatter={tickYear} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmtMillions} tick={{ fontSize: 11 }} width={52} />
          <Tooltip
            formatter={tooltipFormatter((v, n) => [fmtMillions(v), n])}
            labelFormatter={tooltipLabel}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#888" />
          <Bar dataKey="EBITDA" fill="#93c5fd" name="EBITDA" />
          <Bar dataKey="FCF" fill="#2563eb" name="FCF" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 3: Capacity utilization — small multiples (one panel per line)
// ---------------------------------------------------------------------------
function CapacityUtilChart({ result, scenario }: ChartsProps) {
  const lineData = buildCapacityUtilData(result, scenario)
  return (
    <ChartCard
      title="Capacity Utilization by Business Line"
      unit="Percent of installed capacity"
      chartId="capacity-utilization"
    >
      <div className="grid grid-cols-3 gap-2">
        {lineData.map((line, i) => (
          <div key={line.shortCode}>
            <p className="text-xs font-medium text-gray-600 mb-1">{line.shortCode}</p>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={line.data} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                <XAxis dataKey="year" hide />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  formatter={tooltipFormatter((v) => [`${v.toFixed(1)}%`, 'Utilization'])}
                  labelFormatter={tooltipLabel}
                />
                <Area
                  type="monotone"
                  dataKey="utilization"
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  fill={LINE_COLORS[i % LINE_COLORS.length]}
                  fillOpacity={0.4}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 4: Production volume by line — line chart
// ---------------------------------------------------------------------------
function ProductionChart({ result, scenario }: ChartsProps) {
  const data = buildProductionData(result, scenario)
  const { hidden, toggle, legendFormatter } = useSeriesToggle()
  return (
    <ChartCard
      title="Production Volume by Business Line"
      unit="Kilotons per year"
      chartId="production-volume"
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tickFormatter={tickYear} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmtKt} tick={{ fontSize: 11 }} width={52} />
          <Tooltip
            formatter={tooltipFormatter((v, n) => [fmtKt(v), n])}
            labelFormatter={tooltipLabel}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
            formatter={legendFormatter}
            onClick={(p) => toggle(String(p.value))}
          />
          {scenario.businessLines.map((line, i) => (
            <Line
              key={line.shortCode}
              type="monotone"
              dataKey={line.shortCode}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              dot={false}
              strokeWidth={2}
              name={line.shortCode}
              hide={hidden.has(line.shortCode)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 5: Rock allocation — stacked area with supply ceiling dashed line
// ---------------------------------------------------------------------------
interface RockChartProps extends ChartsProps {
  policy: { rock: number[][] }
}

function RockAllocationChart({ scenario, policy }: RockChartProps) {
  const data = buildRockData(scenario, policy)
  const { hidden, toggle, legendFormatter } = useSeriesToggle()
  return (
    <ChartCard title="Supply Allocation" unit="Kilotons per year" chartId="rock-allocation">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tickFormatter={tickYear} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmtKt} tick={{ fontSize: 11 }} width={52} />
          <Tooltip
            formatter={tooltipFormatter((v, n) => [
              n === 'Supply ceiling' ? `${fmtKt(v)} (ceiling)` : fmtKt(v),
              n,
            ])}
            labelFormatter={tooltipLabel}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
            formatter={legendFormatter}
            onClick={(p) => toggle(String(p.value))}
          />
          {scenario.businessLines.map((line, i) => (
            <Area
              key={line.shortCode}
              type="monotone"
              dataKey={line.shortCode}
              stackId="1"
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              fill={LINE_COLORS[i % LINE_COLORS.length]}
              fillOpacity={0.6}
              name={line.shortCode}
              hide={hidden.has(line.shortCode)}
            />
          ))}
          <Line
            type="monotone"
            dataKey="supply"
            stroke="#dc2626"
            strokeDasharray="6 3"
            strokeWidth={2}
            dot={false}
            name="Supply ceiling"
            hide={hidden.has('Supply ceiling')}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 6: Leverage — line chart with Lmax dashed line
// ---------------------------------------------------------------------------
function LeverageChart({ result, scenario }: ChartsProps) {
  const data = buildLeverageData(result, scenario)
  const lmax = scenario.corporate.leverageMax
  return (
    <ChartCard title="Leverage (Debt / EBITDA)" unit="Multiple" chartId="leverage">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tickFormatter={tickYear} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmtRatio} tick={{ fontSize: 11 }} width={44} />
          <Tooltip
            formatter={tooltipFormatter((v) => [`${v.toFixed(2)}×`, 'D/EBITDA'])}
            labelFormatter={tooltipLabel}
          />
          <ReferenceLine
            y={lmax}
            stroke="#dc2626"
            strokeDasharray="6 3"
            label={{
              value: `Ceiling ${lmax}×`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: '#dc2626',
            }}
          />
          <Line
            type="monotone"
            dataKey="leverage"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={false}
            name="D/EBITDA"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 7: Unit cost by line — line chart (learning curve)
// ---------------------------------------------------------------------------
function UnitCostChart({ result, scenario }: ChartsProps) {
  const data = buildUnitCostData(result, scenario)
  const { hidden, toggle, legendFormatter } = useSeriesToggle()
  return (
    <ChartCard
      title="Unit Production Cost by Business Line"
      unit="USD millions per kiloton"
      chartId="unit-cost"
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tickFormatter={tickYear} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmtPrice} tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            formatter={tooltipFormatter((v, n) => [fmtPrice(v), n])}
            labelFormatter={tooltipLabel}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
            formatter={legendFormatter}
            onClick={(p) => toggle(String(p.value))}
          />
          {scenario.businessLines.map((line, i) => (
            <Line
              key={line.shortCode}
              type="monotone"
              dataKey={line.shortCode}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              dot={false}
              strokeWidth={2}
              name={line.shortCode}
              hide={hidden.has(line.shortCode)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 8: Launched revenue from pipeline — stacked area
// ---------------------------------------------------------------------------
function LaunchedRevenueChart({ result, scenario }: ChartsProps) {
  const data = buildLaunchedRevData(result, scenario)
  const { hidden, toggle, legendFormatter } = useSeriesToggle()
  return (
    <ChartCard
      title="Revenue from Newly Developed Products"
      unit="USD millions per year (launched from R&D pipeline)"
      chartId="launched-revenue"
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tickFormatter={tickYear} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmtMillions} tick={{ fontSize: 11 }} width={52} />
          <Tooltip
            formatter={tooltipFormatter((v, n) => [fmtMillions(v), n])}
            labelFormatter={tooltipLabel}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
            formatter={legendFormatter}
            onClick={(p) => toggle(String(p.value))}
          />
          {scenario.businessLines.map((line, i) => (
            <Area
              key={line.shortCode}
              type="monotone"
              dataKey={line.shortCode}
              stackId="1"
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              fill={LINE_COLORS[i % LINE_COLORS.length]}
              fillOpacity={0.7}
              name={line.shortCode}
              hide={hidden.has(line.shortCode)}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// All charts combined
// ---------------------------------------------------------------------------
export function AllCharts({
  result,
  scenario,
  policy,
}: {
  result: SimResult
  scenario: Scenario
  policy: { rock: number[][] }
}) {
  return (
    <div>
      {/* 1 */ <RevenueChart result={result} scenario={scenario} />}
      {/* 2 — moved up from last position per PM request */}
      <LaunchedRevenueChart result={result} scenario={scenario} />
      <FCFChart result={result} scenario={scenario} />
      <CapacityUtilChart result={result} scenario={scenario} />
      <ProductionChart result={result} scenario={scenario} />
      <RockAllocationChart result={result} scenario={scenario} policy={policy} />
      <LeverageChart result={result} scenario={scenario} />
      <UnitCostChart result={result} scenario={scenario} />
    </div>
  )
}
