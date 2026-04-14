/**
 * Persistent scenario type banner — always visible, never dismissable.
 *
 * Amber for illustrative data. Dark gray for OCP confidential data.
 * See AGENTS.md for the policy governing this component.
 */

interface ScenarioBannerProps {
  isIllustrative: boolean
  scenarioName: string
}

export function ScenarioBanner({ isIllustrative, scenarioName }: ScenarioBannerProps) {
  if (isIllustrative) {
    return (
      <div className="w-full bg-amber-400 text-amber-900 text-sm font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
        <span>⚠</span>
        <span>Illustrative data — not OCP actuals</span>
        <span className="font-normal opacity-70">({scenarioName})</span>
      </div>
    )
  }

  return (
    <div className="w-full bg-gray-700 text-gray-200 text-xs font-medium text-center py-1 px-4 flex items-center justify-center gap-2">
      <span>🔒</span>
      <span>OCP confidential — not for external distribution</span>
      <span className="opacity-60">({scenarioName})</span>
    </div>
  )
}
