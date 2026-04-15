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

  // Prefer the Recharts surface SVG; fall back to first SVG in the container.
  const svgEl =
    containerRef.querySelector<SVGSVGElement>('svg.recharts-surface') ??
    containerRef.querySelector<SVGSVGElement>('svg')
  if (!svgEl) return

  // getBoundingClientRect gives the actual rendered size.
  // clientWidth/clientHeight returns 0 when the SVG uses width="100%".
  const rect = svgEl.getBoundingClientRect()
  const width = rect.width || svgEl.clientWidth
  const height = rect.height || svgEl.clientHeight
  if (width === 0 || height === 0) return

  // Clone and stamp explicit pixel dimensions so the <img> loads at full size.
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  // Ensure the SVG xmlns declaration is present (required by some browsers).
  let svgData = new XMLSerializer().serializeToString(clone)
  if (!svgData.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgData = svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  img.onload = () => {
    const scale = 2 // 2× for retina-quality output
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(url)
      return
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)

    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${filename}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
}
