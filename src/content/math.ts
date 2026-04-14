/**
 * Math drawer content — KaTeX equation strings and prose explanations.
 *
 * OWNERSHIP: This file is owned by the MIT team.
 * Any change requires MIT team review before merging.
 * See AGENTS.md for the content ownership policy.
 *
 * Prose will be supplied by the MIT team before Phase 5 begins.
 * Equation strings must match Section 3 of the requirements document exactly.
 */

export interface MathSection {
  id: string
  title: string
  equations: MathEquation[]
}

export interface MathEquation {
  id: string
  latex: string
  prose: string
}

/**
 * All math sections from §3.6 of the requirements document.
 * Prose placeholders will be replaced with MIT-supplied content in Phase 5.
 */
export const MATH_SECTIONS: MathSection[] = [
  {
    id: 'capacity',
    title: 'Capacity Accumulation',
    equations: [
      {
        id: 'capacity-update',
        latex:
          'K_{i,\\,t+1} = (1 - \\delta_i) \\cdot K_{i,\\,t} + \\frac{I_{i,\\,t - \\tau_i}}{\\kappa_i}',
        prose: '[MIT team to supply prose — §3.6.1]',
      },
    ],
  },
  {
    id: 'production',
    title: 'Production',
    equations: [
      {
        id: 'production',
        latex: 'Q_{i,\\,t} = \\min(K_{i,\\,t},\\; \\eta_i \\cdot r_{i,\\,t})',
        prose: '[MIT team to supply prose — §3.6.2]',
      },
    ],
  },
  {
    id: 'learning',
    title: 'Cumulative Volume and Learning Curve',
    equations: [
      {
        id: 'cumulative-volume',
        latex: 'V_{i,\\,t+1} = V_{i,\\,t} + Q_{i,\\,t}',
        prose: '[MIT team to supply prose — §3.6.3]',
      },
      {
        id: 'unit-cost',
        latex:
          'c_{i,\\,t} = c_{i,\\,0} \\cdot \\left( \\frac{V_{i,\\,t}}{V_{i,\\,0}} \\right)^{-\\beta_i}',
        prose: '[MIT team to supply prose — §3.6.3]',
      },
    ],
  },
  {
    id: 'pipeline',
    title: 'Product Development Pipeline',
    equations: [
      {
        id: 'pipeline-update',
        latex:
          'P_{i,\\,t+1} = P_{i,\\,t} + \\mu_i \\cdot R_{i,\\,t} - \\phi_i \\cdot P_{i,\\,t - \\lambda_i}',
        prose: '[MIT team to supply prose — §3.6.4]',
      },
      {
        id: 'launched-revenue',
        latex: '\\Delta\\text{Rev}_{i,\\,t} = \\phi_i \\cdot P_{i,\\,t - \\lambda_i}',
        prose: '[MIT team to supply prose — §3.6.4]',
      },
    ],
  },
  {
    id: 'price',
    title: 'Price Dynamics',
    equations: [
      {
        id: 'price-update',
        latex:
          'p_{i,\\,t+1} = p_{i,\\,t} \\cdot (1 - \\pi_i) + \\frac{\\Delta\\text{Rev}_{i,\\,t}}{\\max(Q_{i,\\,t},\\, Q_{\\min})}',
        prose: '[MIT team to supply prose — §3.6.5]',
      },
    ],
  },
  {
    id: 'revenue-cost',
    title: 'Revenue and Cost',
    equations: [
      {
        id: 'revenue',
        latex: '\\text{Rev}_{i,\\,t} = p_{i,\\,t} \\cdot Q_{i,\\,t}',
        prose: '[MIT team to supply prose — §3.6.6]',
      },
      {
        id: 'cogs',
        latex: '\\text{COGS}_{i,\\,t} = c_{i,\\,t} \\cdot Q_{i,\\,t}',
        prose: '[MIT team to supply prose — §3.6.6]',
      },
      {
        id: 'ebitda-line',
        latex:
          '\\text{EBITDA}_{i,\\,t} = \\text{Rev}_{i,\\,t} - \\text{COGS}_{i,\\,t} - \\text{OpEx}_{i,\\,t} - R_{i,\\,t}',
        prose: '[MIT team to supply prose — §3.6.6]',
      },
      {
        id: 'ebitda-total',
        latex: '\\text{EBITDA}_t = \\sum_i \\text{EBITDA}_{i,\\,t}',
        prose: '[MIT team to supply prose — §3.6.6]',
      },
    ],
  },
  {
    id: 'fcf',
    title: 'Free Cash Flow',
    equations: [
      {
        id: 'fcf',
        latex:
          '\\text{FCF}_t = \\text{EBITDA}_t \\cdot (1 - T_c) + T_c \\cdot \\text{Dep}_t - \\sum_i I_{i,\\,t}',
        prose: '[MIT team to supply prose — §3.6.7]',
      },
    ],
  },
  {
    id: 'wacc',
    title: 'Cost of Capital',
    equations: [
      {
        id: 'wacc',
        latex:
          '\\text{WACC} = \\frac{E_0}{V_0} \\cdot r_E + \\frac{D_0}{V_0} \\cdot r_D \\cdot (1 - T_c)',
        prose: '[MIT team to supply prose — §3.6.8]',
      },
    ],
  },
  {
    id: 'npv',
    title: 'Net Present Value and Terminal Value',
    equations: [
      {
        id: 'terminal-value',
        latex: '\\text{TV}_T = \\frac{\\text{FCF}_{T+1}}{\\text{WACC} - g_T}',
        prose: '[MIT team to supply prose — §3.6.9]',
      },
      {
        id: 'npv',
        latex:
          '\\text{NPV} = \\sum_{t=1}^{T} \\frac{\\text{FCF}_t}{(1 + \\text{WACC})^t} + \\frac{\\text{TV}_T}{(1 + \\text{WACC})^T}',
        prose: '[MIT team to supply prose — §3.6.9]',
      },
    ],
  },
  {
    id: 'objective',
    title: 'Objective Function',
    equations: [
      {
        id: 'objective',
        latex:
          '\\text{maximize } \\text{NPV} \\quad \\text{over } \\{r_{i,t},\\, I_{i,t},\\, R_{i,t}\\} \\text{ for } i = 1 \\ldots 6,\\; t = 0 \\ldots T',
        prose: '[MIT team to supply prose — §3.7]',
      },
    ],
  },
]
