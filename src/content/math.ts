/**
 * Math drawer content — KaTeX equation strings and prose explanations.
 *
 * OWNERSHIP: This file is owned by the MIT team.
 * Any change requires MIT team review before merging.
 * See AGENTS.md for the content ownership policy.
 *
 * Prose is final client-facing copy from Math_Drawer_Prose_v1.md.
 * Equation strings match Section 3 of the requirements document.
 */

export interface MathSection {
  id: string
  title: string
  equations: MathEquation[]
  /** Section-level prose supplied by the MIT team. Rendered after all equations. */
  prose: string
}

export interface MathEquation {
  id: string
  latex: string
}

/**
 * All 15 math sections from §3.6–§3.8 of the requirements document.
 * Prose is MIT-team-authored (Math_Drawer_Prose_v1.md, Gate C approved).
 * Do not paraphrase without MIT review. See AGENTS.md.
 */
export const MATH_SECTIONS: MathSection[] = [
  {
    id: 'capacity',
    title: 'How Production Capacity Grows',
    equations: [
      {
        id: 'capacity-update',
        latex:
          'K_{i,\\,t+1} = (1 - \\delta_i) \\cdot K_{i,\\,t} + \\frac{I_{i,\\,t - \\tau_i}}{\\kappa_i}',
      },
    ],
    prose:
      'Each business line has a physical production capacity that the tool tracks over time, measured in kilotons of output per year. Capacity grows when new plants and equipment come online, and it shrinks gradually as existing assets wear out. The depreciation rate represents the annual portion of capacity lost to natural asset aging, which for specialty chemicals plants typically corresponds to an asset life of twelve to twenty years.\n\nNew capacity arrives with a delay. A capital investment made in one year only becomes productive capacity after the build lead time for that line, which ranges from one year for simple blending operations to four years for complex specialized extraction. The tool converts each dollar of capital expenditure into physical capacity by dividing by the capex unit cost, which represents the capital required to install one kiloton per year of new capacity. This delay is the reason that investments in growth today do not show up in revenue until several years later.',
  },
  {
    id: 'production',
    title: 'How Much the Line Produces Each Year',
    equations: [
      {
        id: 'production',
        latex: 'Q_{i,\\,t} = \\min(K_{i,\\,t},\\; \\eta_i \\cdot r_{i,\\,t})',
      },
    ],
    prose:
      "The output of each business line in any given year is limited by whichever binds first: the installed physical capacity, or the amount of phosphate rock allocated to the line converted to finished product by that line's yield. The yield reflects the chemistry of each product. High yield lines such as Animal Nutrition Solutions convert nearly all of their rock input into finished product, while low yield lines such as Non-P Products Solutions extract only a small fraction of the rock stream, because the target compounds are present at trace concentrations.\n\nThe tool surfaces the binding constraint for each line and year in the diagnostics view. A line whose production is limited by rock allocation is operating below its installed capacity, which erodes unit economics because fixed costs are spread across fewer kilotons. A line whose production is limited by capacity is underserved by the rock allocation, which may indicate that additional capex is warranted or that rock should be redirected from less productive lines.",
  },
  {
    id: 'learning',
    title: 'How Unit Costs Fall as Volume Grows',
    equations: [
      {
        id: 'cumulative-volume',
        latex: 'V_{i,\\,t+1} = V_{i,\\,t} + Q_{i,\\,t}',
      },
      {
        id: 'unit-cost',
        latex:
          'c_{i,\\,t} = c_{i,\\,0} \\cdot \\left( \\frac{V_{i,\\,t}}{V_{i,\\,0}} \\right)^{-\\beta_i}',
      },
    ],
    prose:
      'As a business line produces more product over time, its operating teams become more efficient, its processes become tighter, and its unit costs fall. The tool captures this effect through a classical learning curve. Cumulative volume is the running total of every kiloton ever produced by the line, and unit cost declines as a power function of cumulative volume relative to a starting reference volume.\n\nThe learning exponent sets how steeply costs fall. A value of 0.10 implies roughly a seven percent reduction in unit cost for each doubling of cumulative volume, a value of 0.15 implies roughly a ten percent reduction, and a value of 0.20 implies roughly a thirteen percent reduction. Mature lines such as Animal Nutrition Solutions typically exhibit shallow learning curves because most of the easy efficiency gains have already been captured, while exploratory lines such as Energy Materials Solutions show steeper declines because they are early in their operational experience.',
  },
  {
    id: 'pipeline',
    title: 'How R&D Spending Converts into Future Revenue',
    equations: [
      {
        id: 'pipeline-update',
        latex:
          'P_{i,\\,t+1} = P_{i,\\,t} + \\mu_i \\cdot R_{i,\\,t} - \\phi_i \\cdot P_{i,\\,t - \\lambda_i}',
      },
      {
        id: 'launched-revenue',
        latex: '\\Delta\\text{Rev}_{i,\\,t} = \\phi_i \\cdot P_{i,\\,t - \\lambda_i}',
      },
    ],
    prose:
      "Each dollar spent on research and development builds up a pipeline of products in development, measured in units of the annual revenue those products will generate once launched and fully ramped. The productivity parameter translates research dollars into latent revenue, with typical specialty chemicals values in the range of two to four dollars of eventual annual revenue per dollar of research spending.\n\nThe pipeline does not convert instantly. Products require a maturation period before they can be commercialized, typically two years for line extensions in established categories and up to four years for genuinely new chemistry. Once mature, the pipeline converts to launched revenue at a steady annual rate, reflecting the typical pace at which a product rolls out across customers and geographies. The conversion adds to the line's revenue without inflating physical volume, because new products expand the value captured per kiloton rather than the kilotons produced.",
  },
  {
    id: 'price',
    title: 'How Prices Evolve Under Competition and Innovation',
    equations: [
      {
        id: 'price-update',
        latex:
          'p_{i,\\,t+1} = p_{i,\\,t} \\cdot (1 - \\pi_i) + \\frac{\\Delta\\text{Rev}_{i,\\,t}}{\\max(Q_{i,\\,t},\\, Q_{\\min})}',
      },
    ],
    prose:
      "Left alone, selling prices in most specialty chemicals markets erode each year under competitive pressure and gradual commoditization. The price erosion rate captures this effect, running between half a percent for pioneering markets with strong pricing power and two and a half percent for more mature categories facing active competition.\n\nNew product launches from the R&D pipeline offset this erosion. As products launch, they add revenue that the tool expresses as an effective uplift in the average selling price, calculated by dividing the incremental revenue from launches by the line's physical output. A line that combines active innovation with a strong pipeline can hold or even grow its effective price over time, while a line with no new product development will see its price drift downward year after year.",
  },
  {
    id: 'ebitda',
    title: "How Each Line's Profitability is Calculated",
    equations: [
      {
        id: 'revenue',
        latex: '\\text{Rev}_{i,\\,t} = p_{i,\\,t} \\cdot Q_{i,\\,t}',
      },
      {
        id: 'cogs',
        latex: '\\text{COGS}_{i,\\,t} = c_{i,\\,t} \\cdot Q_{i,\\,t}',
      },
      {
        id: 'ebitda-line',
        latex:
          '\\text{EBITDA}_{i,\\,t} = \\text{Rev}_{i,\\,t} - \\text{COGS}_{i,\\,t} - \\text{OpEx}_{i,\\,t} - R_{i,\\,t}',
      },
      {
        id: 'ebitda-total',
        latex: '\\text{EBITDA}_t = \\sum_i \\text{EBITDA}_{i,\\,t}',
      },
    ],
    prose:
      "Revenue for each line is simply volume times price. The cost of goods sold is volume times unit cost, where unit cost reflects the learning curve. Subtracting cost of goods sold, operating expenses (which cover fixed costs such as sales, marketing, administration, and plant overhead), and research and development spending from revenue gives each line's contribution to consolidated EBITDA.\n\nResearch and development is treated as an expense in the year it is incurred, which matches standard accounting practice and means that a line investing heavily in future growth will report lower current EBITDA than a line harvesting from its established product base. Capital expenditure is not reflected in EBITDA because it is a flow of capital rather than an operating cost, and is handled separately in the free cash flow calculation.",
  },
  {
    id: 'fcf',
    title: 'The Cash the Business Actually Generates',
    equations: [
      {
        id: 'fcf',
        latex:
          '\\text{FCF}_t = \\text{EBITDA}_t \\cdot (1 - T_c) + T_c \\cdot \\text{Dep}_t - \\sum_i I_{i,\\,t}',
      },
    ],
    prose:
      'Free cash flow is the cash the business generates after paying taxes and funding capital investment. The tool computes it by taking consolidated EBITDA, applying the corporate tax rate to get after-tax operating cash flow, adding back the tax benefit of depreciation (because depreciation is a non-cash expense that reduces taxable income), and subtracting capital expenditure.\n\nThis free cash flow is the quantity that ultimately determines shareholder value. It is what can be returned to investors, used to pay down debt, or reinvested in further growth. In the simulation, every capital decision the user makes affects free cash flow twice: capex reduces cash today, and the capacity it builds generates additional EBITDA and therefore cash in future years. The tradeoff between these two effects is at the heart of the growth model.',
  },
  {
    id: 'wacc',
    title: 'The Discount Rate the Firm Uses to Value Future Cash Flows',
    equations: [
      {
        id: 'wacc',
        latex:
          '\\text{WACC} = \\frac{E_0}{V_0} \\cdot r_E + \\frac{D_0}{V_0} \\cdot r_D \\cdot (1 - T_c)',
      },
      {
        id: 'enterprise-value',
        latex: 'V_0 = E_0 + D_0',
      },
    ],
    prose:
      "The weighted average cost of capital, or WACC, is the blended return required by the firm's investors given its mix of equity and debt financing. Equity investors require a higher return because they bear more risk, while debt holders accept a lower return because their claim on cash flows is senior and their interest payments are tax deductible. The tool weights the two by the firm's capital structure and applies the corporate tax shield to the cost of debt.\n\nWACC serves as the discount rate throughout the model. A dollar of free cash flow received in a future year is worth less than a dollar received today, because today's dollar can be invested at the WACC and grow over the intervening years. The tool applies this discount factor to every future year's free cash flow when computing present value, which is why the timing of investments and returns matters so much for the final result.",
  },
  {
    id: 'npv',
    title: 'The Total Value of the Plan',
    equations: [
      {
        id: 'terminal-value',
        latex: '\\text{TV}_T = \\frac{\\text{FCF}_{T+1}}{\\text{WACC} - g_T}',
      },
      {
        id: 'npv',
        latex:
          '\\text{NPV} = \\sum_{t=1}^{T} \\frac{\\text{FCF}_t}{(1 + \\text{WACC})^t} + \\frac{\\text{TV}_T}{(1 + \\text{WACC})^T}',
      },
    ],
    prose:
      'Net present value is the central number the tool reports. It sums the discounted free cash flows expected over the explicit ten-year planning horizon and adds a discounted terminal value that captures cash flows beyond the horizon. The terminal value is computed as a perpetuity, assuming free cash flow in the year after the horizon grows forever at a steady terminal rate typical of the mature specialty chemicals industry.\n\nThe split between the ten-year NPV and the terminal value matters for interpretation. If most of the value sits in the terminal portion, the plan is back-loaded and depends on assumptions about the distant future that carry real uncertainty. If most of the value is in the explicit horizon, the plan is front-loaded and more defensible on the basis of near-term execution. The tool displays both numbers so leadership can judge where value is coming from, not just how much there is.',
  },
  {
    id: 'objective',
    title: 'What the Tool Maximizes',
    equations: [
      {
        id: 'objective',
        latex:
          '\\text{maximize } \\text{NPV} \\quad \\text{over } \\{r_{i,t},\\, I_{i,t},\\, R_{i,t}\\} \\text{ for } i = 1 \\ldots 6,\\; t = 0 \\ldots T',
      },
    ],
    prose:
      'The tool is designed to help leadership find the allocation of rock, capital, and research spending across the six business lines and the ten years of the plan that generates the highest net present value. In this first version of the tool, the user explores this decision space by hand, adjusting sliders and tables and watching the consequences in the output charts. The approach builds intuition about which levers matter most and where tradeoffs are steep.\n\nA second version of the tool will add a numerical solver that searches the space automatically and reports the allocation that maximizes NPV subject to all the constraints. Even with a solver, the interactive version one remains valuable because it lets leadership test specific strategic beliefs and explore what-if scenarios that the optimizer would not volunteer.',
  },
  {
    id: 'constraint_rock',
    title: 'Total Rock Allocated Cannot Exceed What OCP Can Supply',
    equations: [
      {
        id: 'rock-constraint',
        latex: '\\sum_i r_{i,\\,t} \\leq S_t \\quad \\forall\\, t',
      },
    ],
    prose:
      'The six SPS business lines share a single upstream input, phosphate rock mined and supplied by OCP. In any given year, the total rock allocated across the six lines cannot exceed what the upstream mining operation can deliver to SPS. The supply figure grows over the horizon as OCP expands its mining and processing capacity, but in any single year it is a hard ceiling. The tool flags any allocation that breaches the ceiling and shows the magnitude of the overage, because rock unavailability is a real physical constraint that no financing solution can relax in the short term.',
  },
  {
    id: 'constraint_capex',
    title: 'Capex Must be Funded by Available Cash and Debt',
    equations: [
      {
        id: 'capex-constraint',
        latex: '\\sum_i I_{i,\\,t} \\leq C_t + \\Delta D_t \\quad \\forall\\, t',
      },
    ],
    prose:
      'In any given year, the firm can only spend on capital projects up to the sum of cash available internally and new debt raised that year. Cash available depends on the free cash flow retained from the prior year, and new debt is constrained by the leverage ceiling described in the next module. Until 2027, SPS cannot raise new debt independently, so capex in the first two years of the plan is strictly limited to internally generated cash or contributions from the parent. This is a binding constraint in the early years of the plan and shapes how quickly growth investments can be deployed.',
  },
  {
    id: 'constraint_leverage',
    title: 'Debt Cannot Exceed a Multiple of EBITDA',
    equations: [
      {
        id: 'leverage-constraint',
        latex: '\\frac{D_t}{\\text{EBITDA}_t} \\leq L_{\\max} \\quad \\forall\\, t',
      },
    ],
    prose:
      "The firm's outstanding debt cannot exceed a fixed multiple of its EBITDA in any year. This reflects both internal financial policy and the practical reality that lenders and rating agencies impose leverage limits on corporate borrowers. A high leverage ceiling gives the firm more room to fund growth with debt, and a low ceiling forces more reliance on retained earnings. The tool highlights years in which leverage approaches or breaches the ceiling, so leadership can see where financing capacity is the binding constraint on growth ambitions.",
  },
  {
    id: 'constraint_legacy',
    title: 'Legacy Lines Must Meet Minimum Production Commitments',
    equations: [
      {
        id: 'legacy-constraint',
        latex:
          'Q_{i,\\,t} \\geq F_i \\quad \\forall\\, i \\in L_{\\text{legacy}},\\; \\forall\\, t',
      },
    ],
    prose:
      'Business lines designated as legacy carry contractual obligations to existing customers that require a minimum level of production each year. Animal Nutrition Solutions is currently the primary legacy line in the model, with a production floor that reflects its established customer book. The tool prevents any allocation that would fall below the floor for these lines, and flags the floor as a binding constraint whenever it would be violated. This constraint captures the commercial reality that harvesting a legacy business below a certain level would damage customer relationships and future optionality, regardless of short-term financial appeal.',
  },
  {
    id: 'constraint_capacity',
    title: 'Physical and Logical Limits on the Decision Variables',
    equations: [
      {
        id: 'capacity-constraint',
        latex: 'Q_{i,\\,t} \\leq K_{i,\\,t}',
      },
      {
        id: 'non-negativity',
        latex: 'r_{i,\\,t},\\; I_{i,\\,t},\\; R_{i,\\,t},\\; K_{i,\\,t},\\; P_{i,\\,t} \\geq 0',
      },
    ],
    prose:
      'Production in any line cannot exceed the installed capacity of that line in that year. This is a physical constraint and is embedded in the production equation in Module 2. In addition, all of the decision variables and state variables in the model must be non-negative, because negative rock, negative capex, negative capacity, or negative pipeline would have no physical meaning. The tool clamps any value that would turn negative to zero and surfaces a warning, because such an event typically indicates either a parameter error or a logical inconsistency in the inputs.',
  },
]
