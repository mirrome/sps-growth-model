/**
 * Application shell — three-pane layout with top bar and ScenarioBanner.
 *
 * Scenario is loaded from URL query param ?scenario=<name>.
 * Defaults to scenario.illustrative.json.
 */

import { useEffect, useState } from 'react'
import { version as APP_VERSION } from '../../package.json'
import { ScenarioBanner } from './ScenarioBanner'
import { InputsPane } from './InputsPane'
import { OutputsPane } from './OutputsPane'
import { MathPane } from './MathPane'
import { parseScenario, ScenarioValidationError } from '../engine/scenario'
import { useSimStore } from '../store/useSimStore'
import type { FieldError } from '../engine/scenario'

function getScenarioName(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('scenario') ?? 'illustrative'
}

export default function App() {
  const setScenario = useSimStore((s) => s.setScenario)
  const scenario = useSimStore((s) => s.scenario)
  const isIllustrative = useSimStore((s) => s.isIllustrative)
  const [loadError, setLoadError] = useState<FieldError[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const name = getScenarioName()
    const url = `/${`scenario.${name}.json`}`

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${url}: ${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((raw) => {
        const parsed = parseScenario(raw)
        const illustrative = parsed.meta.isIllustrative
        setScenario(parsed, illustrative)
        setLoadError(null)
      })
      .catch((err) => {
        if (err instanceof ScenarioValidationError) {
          setLoadError(err.fieldErrors)
        } else {
          setLoadError([{ field: 'load', reason: err.message, value: url }])
        }
      })
      .finally(() => setLoading(false))
  }, [setScenario])

  const handleResetToDefaults = () => {
    window.location.href = '/?scenario=illustrative'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        Loading scenario…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-8">
          <h2 className="text-lg font-bold text-red-700 mb-2">Scenario failed to load</h2>
          <p className="text-sm text-gray-600 mb-4">
            The following fields are invalid. Fix the scenario file and reload, or reset to the
            illustrative defaults.
          </p>
          <ul className="space-y-2 mb-6 max-h-72 overflow-y-auto">
            {loadError.map((e, idx) => (
              <li key={idx} className="text-sm bg-red-50 border border-red-200 rounded p-2">
                <span className="font-mono font-semibold text-red-800">{e.field}</span>
                <span className="text-gray-600"> — {e.reason}</span>
                {e.value !== undefined && (
                  <span className="block text-xs text-gray-400 mt-0.5">
                    Got: {JSON.stringify(e.value)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={handleResetToDefaults}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded transition-colors"
          >
            Reset to illustrative defaults
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-900 text-base">SPS Growth Model</span>
          {scenario && (
            <span className="text-xs text-gray-400 font-normal">{scenario.meta.name}</span>
          )}
        </div>
        <div className="text-xs text-gray-400">v{APP_VERSION} · MIT Global Lab 2026</div>
      </header>

      {/* Scenario banner — always visible, never dismissable */}
      {scenario && (
        <ScenarioBanner isIllustrative={isIllustrative} scenarioName={scenario.meta.name} />
      )}

      {/* Three-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/4 shrink-0">
          <InputsPane />
        </div>
        <div className="flex-1">
          <OutputsPane />
        </div>
        <div className="w-1/4 shrink-0">
          <MathPane />
        </div>
      </div>
    </div>
  )
}
