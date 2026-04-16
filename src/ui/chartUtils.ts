/**
 * Shared chart utilities: color palette, PNG export, axis formatters.
 */

import { toPng } from 'html-to-image'

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
  try {
    const dataUrl = await toPng(containerRef, { backgroundColor: '#ffffff', pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${filename}.png`
    a.click()
  } catch (err) {
    console.error('PNG export failed:', err)
  }
}
