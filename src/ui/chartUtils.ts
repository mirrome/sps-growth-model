/**
 * Shared chart utilities: color palette, PNG export, axis formatters.
 */

/** Six distinct colors — one per business line. Accessible, print-friendly. */
export const LINE_COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#dc2626', // red-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
]

/** Format a USD millions value for chart axis labels. */
export function fmtMillions(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`
  return `$${v.toFixed(0)}M`
}

/** Format a kilotons value for chart axis labels. */
export function fmtKt(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}Mt`
  return `${v.toFixed(0)} kt`
}

/** Format a ratio/fraction for chart axis labels. */
export function fmtRatio(v: number): string {
  return `${v.toFixed(2)}×`
}

/** Format a price (USD millions per kt) for axis labels. */
export function fmtPrice(v: number): string {
  return `$${v.toFixed(3)}/kt`
}

/**
 * Export a chart container element as a PNG file download.
 * Uses html2canvas if available; falls back to SVG serialization.
 */
export async function exportChartAsPng(
  containerRef: HTMLElement | null,
  filename: string,
): Promise<void> {
  if (!containerRef) return

  const svgEl = containerRef.querySelector('svg')
  if (!svgEl) return

  const svgData = new XMLSerializer().serializeToString(svgEl)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const scale = 2 // 2× for retina quality
    canvas.width = svgEl.clientWidth * scale
    canvas.height = svgEl.clientHeight * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)

    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${filename}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
    URL.revokeObjectURL(url)
  }
  img.src = url
}
