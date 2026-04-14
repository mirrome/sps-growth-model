/**
 * Right pane — math drawer with KaTeX equations, prose, and sensitivity tornado.
 *
 * Two modes:
 * - Free navigation: table of contents → jump to equation section
 * - Tornado chart: NPV sensitivity over ±20% band for all numeric parameters
 *
 * Prose placeholders will be replaced with MIT-supplied content in Review gate C.
 */

import { useState, useEffect, useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { MATH_SECTIONS } from '../content/math'
import { useSimStore } from '../store/useSimStore'
import { runSensitivityAnalysis } from '../engine/sensitivity'
import type { SensitivityParameter } from '../engine/sensitivity'

// ---------------------------------------------------------------------------
// Equation renderer
// ---------------------------------------------------------------------------

function KatexEq({ latex, block = false }: { latex: string; block?: boolean }) {
  let html = ''
  try {
    html = katex.renderToString(latex, {
      displayMode: block,
      throwOnError: false,
      strict: false,
    })
  } catch {
    html = `<span class="text-red-500 text-xs">[KaTeX error: ${latex}]</span>`
  }
  return (
    <div
      className={block ? 'overflow-x-auto py-2' : 'inline'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ---------------------------------------------------------------------------
// Math section cards
// ---------------------------------------------------------------------------

function MathSectionCard({ section }: { section: (typeof MATH_SECTIONS)[number] }) {
  return (
    <div id={`math-${section.id}`} className="mb-6">
      <h3 className="text-sm font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-1">
        {section.title}
      </h3>
      {section.equations.map((eq) => (
        <div key={eq.id} className="bg-gray-50 border border-gray-100 rounded p-3 mb-2">
          <KatexEq latex={eq.latex} block={true} />
        </div>
      ))}
      {section.prose.split('\n\n').map((para, i) => (
        <p key={i} className="text-xs text-gray-600 leading-relaxed mt-2">
          {para}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------

function TableOfContents({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <nav className="mb-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contents</p>
      <ul className="space-y-1">
        {MATH_SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
            >
              {s.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Tornado chart (sensitivity analysis)
// ---------------------------------------------------------------------------

function fmtM(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}$${(v / 1).toFixed(0)}M`
}

function TornadoBar({ param, maxRange }: { param: SensitivityParameter; maxRange: number }) {
  const baseNPV = param.npvBase
  const lowDelta = param.npvAtLow - baseNPV
  const highDelta = param.npvAtHigh - baseNPV
  const scale = maxRange > 0 ? 100 / maxRange : 1

  const leftWidth = Math.abs(Math.min(lowDelta, highDelta)) * scale
  const rightWidth = Math.abs(Math.max(lowDelta, highDelta)) * scale
  const leftColor = Math.min(lowDelta, highDelta) < 0 ? 'bg-red-400' : 'bg-emerald-400'
  const rightColor = Math.max(lowDelta, highDelta) < 0 ? 'bg-red-400' : 'bg-emerald-400'

  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-gray-600 truncate max-w-32" title={param.label}>
          {param.label}
        </span>
        <span className="text-xs text-gray-400 ml-2 shrink-0">
          {fmtM(param.npvAtLow)} / {fmtM(param.npvAtHigh)}
        </span>
      </div>
      <div className="flex items-center gap-0">
        {/* Left bar (negative delta) */}
        <div className="flex-1 flex justify-end">
          <div
            className={`h-4 rounded-l ${leftColor} opacity-80`}
            style={{ width: `${leftWidth}%` }}
          />
        </div>
        {/* Center line */}
        <div className="w-px h-4 bg-gray-400" />
        {/* Right bar (positive delta) */}
        <div className="flex-1">
          <div
            className={`h-4 rounded-r ${rightColor} opacity-80`}
            style={{ width: `${rightWidth}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function TornadoChart() {
  const scenario = useSimStore((s) => s.scenario)
  const policy = useSimStore((s) => s.policy)
  const [filter, setFilter] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ReturnType<typeof runSensitivityAnalysis> | null>(null)

  const runAnalysis = () => {
    if (!scenario || !policy) return
    setRunning(true)
    // Use setTimeout to let the UI update before the synchronous simulation runs
    setTimeout(() => {
      const r = runSensitivityAnalysis(scenario, policy)
      setResult(r)
      setRunning(false)
    }, 10)
  }

  const filtered = useMemo(() => {
    if (!result) return []
    if (!filter.trim()) return result.parameters
    const q = filter.toLowerCase()
    return result.parameters.filter((p) => p.label.toLowerCase().includes(q))
  }, [result, filter])

  const maxRange = filtered[0]?.npvRange ?? 1

  if (!scenario || !policy) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          Auto-evaluates every numeric parameter over ±20% band.
        </p>
        <button
          onClick={runAnalysis}
          disabled={running}
          className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {running ? 'Running…' : 'Run analysis'}
        </button>
      </div>

      {result && (
        <>
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">
              Base NPV:{' '}
              <span className="font-semibold text-gray-800">${result.baseNPV.toFixed(0)}M</span>
              &nbsp;·&nbsp;{result.parameters.length} parameters evaluated
            </p>
            <input
              type="text"
              placeholder="Filter parameters…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Center axis label */}
          <div className="flex text-xs text-gray-400 mb-1">
            <div className="flex-1 text-right">−20% low</div>
            <div className="w-px mx-2" />
            <div className="flex-1">high +20%</div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filtered.map((p) => (
              <TornadoBar key={p.id} param={p} maxRange={maxRange} />
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">
                No parameters match &ldquo;{filter}&rdquo;
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root MathPane
// ---------------------------------------------------------------------------

type PaneMode = 'math' | 'tornado'

export function MathPane() {
  const [mode, setMode] = useState<PaneMode>('math')
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    if (activeSection) {
      const el = document.getElementById(`math-${activeSection}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeSection])

  return (
    <aside className="h-full flex flex-col border-l border-gray-200 bg-white">
      {/* Mode switcher */}
      <div className="flex border-b border-gray-200 shrink-0">
        <button
          onClick={() => setMode('math')}
          className={`flex-1 text-xs py-2.5 font-medium transition-colors ${
            mode === 'math'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Mathematics
        </button>
        <button
          onClick={() => setMode('tornado')}
          className={`flex-1 text-xs py-2.5 font-medium transition-colors ${
            mode === 'tornado'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sensitivity
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'math' && (
          <>
            <TableOfContents onSelect={setActiveSection} />
            {MATH_SECTIONS.map((s) => (
              <MathSectionCard key={s.id} section={s} />
            ))}

            {/* Content ownership notice */}
            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <strong>Content ownership:</strong> All prose in this pane is MIT-team-authored
              (Math_Drawer_Prose_v1.md, Gate C). Any edits require MIT team review. See AGENTS.md.
            </div>
          </>
        )}

        {mode === 'tornado' && (
          <>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">
              NPV Sensitivity — Tornado Chart
            </h2>
            <TornadoChart />
          </>
        )}
      </div>
    </aside>
  )
}
