/**
 * Financial computations: WACC, FCF, NPV, terminal value.
 *
 * All functions are pure. Notation follows Section 3 of the requirements document.
 * All monetary values in USD millions.
 */

import type { CorporateParams } from './types'

/**
 * Compute WACC using the standard formulation (§3.6.8).
 *
 * WACC = (E₀/V₀)·r_E + (D₀/V₀)·r_D·(1 − T_c)
 */
export function computeWACC(corp: CorporateParams): number {
  const v0 = corp.equity0 + corp.debt0
  if (v0 <= 0) return corp.rE
  return (corp.equity0 / v0) * corp.rE + (corp.debt0 / v0) * corp.rD * (1 - corp.taxRate)
}

/**
 * Compute free cash flow for year t (§3.6.7).
 *
 * FCF_t = EBITDA_t·(1 − T_c) + T_c·Dep_t − ΣI_{i,t}
 */
export function computeFCF(
  ebitda: number,
  taxRate: number,
  depreciation: number,
  totalCapex: number,
): number {
  return ebitda * (1 - taxRate) + taxRate * depreciation - totalCapex
}

/**
 * Compute terminal value using the growing perpetuity formula (§3.6.9).
 *
 * TV_T = FCF_{T+1} / (WACC − g_T)
 * where FCF_{T+1} = FCF_T · (1 + g_T)
 */
export function computeTerminalValue(
  fcfTerminal: number,
  wacc: number,
  terminalGrowth: number,
): number {
  const denominator = wacc - terminalGrowth
  if (denominator <= 0) {
    return 0
  }
  return (fcfTerminal * (1 + terminalGrowth)) / denominator
}

/**
 * Compute NPV over the horizon plus discounted terminal value (§3.6.9).
 *
 * NPV = Σ_{t=1}^{T} FCF_t/(1+WACC)^t + TV_T/(1+WACC)^T
 *
 * Returns both npvExTV (excluding terminal value) and npv (including).
 * Year 0 FCF is not discounted (base year).
 */
export function computeNPV(
  fcf: number[],
  wacc: number,
  terminalValue: number,
): { npv: number; npvExTV: number } {
  const T = fcf.length - 1
  let npvExTV = 0
  for (let t = 1; t <= T; t++) {
    npvExTV += fcf[t] / Math.pow(1 + wacc, t)
  }
  const discountedTV = terminalValue / Math.pow(1 + wacc, T)
  return { npvExTV, npv: npvExTV + discountedTV }
}
