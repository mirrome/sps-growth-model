/**
 * Unit tests for finance.ts — WACC, FCF, NPV, terminal value.
 *
 * Test cases 6 and 7 from §8.1 of the requirements document are here.
 */

import { describe, it, expect } from 'vitest'
import { computeWACC, computeFCF, computeTerminalValue, computeNPV } from './finance'
import type { CorporateParams } from './types'

const BASIS_POINT = 0.0001

describe('computeWACC', () => {
  it('test 7 — matches textbook WACC to within one basis point', () => {
    // Example: E=600, D=400, V=1000, rE=12%, rD=6%, Tc=30%
    // WACC = (600/1000)*0.12 + (400/1000)*0.06*(1-0.30)
    //      = 0.072 + 0.0168 = 0.0888
    const corp: CorporateParams = {
      taxRate: 0.3,
      rD: 0.06,
      rE: 0.12,
      equity0: 600,
      debt0: 400,
      leverageMax: 3,
      terminalGrowth: 0.02,
      depreciation: [],
    }
    const wacc = computeWACC(corp)
    expect(Math.abs(wacc - 0.0888)).toBeLessThan(BASIS_POINT)
  })

  it('returns rE when there is no debt', () => {
    const corp: CorporateParams = {
      taxRate: 0.3,
      rD: 0.06,
      rE: 0.12,
      equity0: 1000,
      debt0: 0,
      leverageMax: 3,
      terminalGrowth: 0.02,
      depreciation: [],
    }
    expect(computeWACC(corp)).toBeCloseTo(0.12, 6)
  })

  it('correctly applies the debt tax shield', () => {
    // All debt: WACC = rD * (1 - Tc)
    const corp: CorporateParams = {
      taxRate: 0.25,
      rD: 0.08,
      rE: 0.15,
      equity0: 0,
      debt0: 1000,
      leverageMax: 3,
      terminalGrowth: 0.02,
      depreciation: [],
    }
    // WACC = rD*(1-Tc) = 0.08*0.75 = 0.06
    expect(computeWACC(corp)).toBeCloseTo(0.06, 6)
  })
})

describe('computeFCF', () => {
  it('computes FCF correctly with all components', () => {
    // FCF = EBITDA*(1-Tc) + Tc*Dep - Capex
    // = 100*(1-0.3) + 0.3*20 - 30 = 70 + 6 - 30 = 46
    const fcf = computeFCF(100, 0.3, 20, 30)
    expect(fcf).toBeCloseTo(46, 6)
  })

  it('returns zero when EBITDA and capex balance with no depreciation', () => {
    // FCF = 0*(1-0.3) + 0.3*0 - 0 = 0
    expect(computeFCF(0, 0.3, 0, 0)).toBe(0)
  })
})

describe('computeTerminalValue', () => {
  it('test 6 — perpetuity: TV/WACC + discounted stream = FCF/WACC for zero growth', () => {
    // For g=0: TV = FCF/WACC
    // NPV of perpetuity = TV/(1+WACC)^T + Σ FCF/(1+WACC)^t
    // As T→∞ this equals FCF/WACC. For finite T, verify the TV formula is correct.
    const fcf = 100
    const wacc = 0.1
    const g = 0

    const tv = computeTerminalValue(fcf, wacc, g)
    // TV = FCF*(1+g)/(WACC-g) = 100*1/0.1 = 1000
    expect(tv).toBeCloseTo(1000, 4)

    // Now verify: NPV_ex_TV + TV/(1+WACC)^T = FCF/WACC for any T
    // For T=10: Σ_{t=1}^{10} FCF/(1.1)^t + 1000/(1.1)^10
    const T = 10
    const fcfArray = new Array<number>(T + 1).fill(0)
    for (let t = 1; t <= T; t++) fcfArray[t] = fcf
    const { npv } = computeNPV(fcfArray, wacc, tv)
    const perpetuityValue = fcf / wacc
    expect(Math.abs(npv - perpetuityValue)).toBeLessThan(0.01)
  })

  it('returns zero when WACC equals terminal growth (undefined)', () => {
    expect(computeTerminalValue(100, 0.05, 0.05)).toBe(0)
  })

  it('returns zero when WACC is less than terminal growth (unstable)', () => {
    expect(computeTerminalValue(100, 0.03, 0.05)).toBe(0)
  })
})

describe('computeNPV', () => {
  it('correctly discounts cash flows and adds terminal value', () => {
    // FCF = [0, 100, 100], WACC=10%, TV=500 discounted from t=2
    const fcf = [0, 100, 100]
    const wacc = 0.1
    const tv = 500
    const { npv, npvExTV } = computeNPV(fcf, wacc, tv)
    const expected = 100 / 1.1 + 100 / 1.21 + 500 / 1.21
    expect(npvExTV).toBeCloseTo(100 / 1.1 + 100 / 1.21, 6)
    expect(npv).toBeCloseTo(expected, 6)
  })

  it('does not include year 0 FCF in discounting', () => {
    // Year 0 is base year — not discounted
    const fcf = [999, 0, 0]
    const { npvExTV } = computeNPV(fcf, 0.1, 0)
    expect(npvExTV).toBeCloseTo(0, 6)
  })
})
