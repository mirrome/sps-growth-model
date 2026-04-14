# AGENTS.md — SPS Growth Model

This file governs how every AI coding tool (Cursor, Claude, Copilot, Aider, or any future tool)
must behave when working in this repository. Rules here are not suggestions — they are enforced
constraints that keep the codebase maintainable, auditable, and safe for use with confidential
client data.

---

## Project overview

The SPS Growth Model is a web-based decision-support tool for OCP Specialty Plant Solutions (SPS).
It simulates the SPS business across six product lines over a ten-year horizon and computes the
net present value of the firm under any chosen allocation policy. The mathematical specification
lives in `SPS_Growth_Model_Requirements.md` (parent directory). This tool is used by OCP SPS
executives and reviewed by MIT faculty and the OCP CFO.

---

## Stack

| Layer          | Technology                       |
| -------------- | -------------------------------- |
| Language       | TypeScript (strict mode)         |
| Framework      | React 18 + Vite                  |
| State          | Zustand                          |
| Charts         | Recharts (standard), D3 (custom) |
| Math rendering | KaTeX                            |
| Styling        | Tailwind CSS v4                  |
| Testing        | Vitest + React Testing Library   |
| Linting        | ESLint + Prettier                |
| Git hooks      | Husky + lint-staged              |
| CI             | GitHub Actions                   |

---

## Module structure

```
src/
  engine/          Pure TypeScript — no React imports allowed here
    types.ts       Shared interfaces: Scenario, Policy, SimResult, ConstraintStatus
    scenario.ts    Scenario file loading, validation, schemaVersion enforcement
    simulate.ts    Core forward simulator — pure function, no side effects
    finance.ts     WACC, FCF, NPV, terminal value computations
    constraints.ts Constraint evaluator — returns slack/violation per year per constraint
  ui/
    App.tsx        Shell: three-pane layout, top bar, ScenarioBanner
    InputsPane.tsx Left pane: all parameter controls
    OutputsPane.tsx Center pane: KPI tiles, charts, constraint strip
    MathPane.tsx   Right pane: math drawer with KaTeX equations
    ScenarioBanner.tsx Persistent scenario type indicator (never dismissable)
  content/
    math.ts        KaTeX equation strings + prose — OWNED BY MIT TEAM (see below)
  store/
    useSimStore.ts Zustand store: scenario, policy, SimResult
  test/
    setup.ts       Vitest + Testing Library configuration
reference/
  sps_reference_model.xlsx  Independent Excel reference model built by PM
  calibration/
    calibration.test.ts     Cross-verification: TypeScript vs spreadsheet
scenario.illustrative.json  Default scenario with illustrative placeholder values
scenario.ocp_v1.json        Real OCP seed values (added in data tranches; confidential)
AGENTS.md                   This file
README.md                   Local setup and contribution guide
docs/
  user_guide.pdf            Two-page OCP-audience user guide
```

---

## Scenario and data rules

1. **No hardcoded business values.** Every parameter lives in the active scenario file.
   Zero business numbers in TypeScript source. This includes prices, costs, yields, WACC
   inputs, tax rates, and all other model parameters.

2. **No hardcoded business line names.** Business line names, short codes (`shortCode`),
   and legacy flags (`isLegacy`) are read from the scenario file at runtime. They must
   never appear as string literals or constants in TypeScript source.

3. **Schema version enforcement.** Every scenario file must carry `"schemaVersion": 1`
   at the top level. The loader (`engine/scenario.ts`) must reject files with an
   unrecognized or missing version with a clear error message that names the field and
   lists the accepted values. Incrementing `schemaVersion` requires a migration plan.

4. **Scenario selection.** The loader accepts a filename argument. The URL query param
   `?scenario=<name>` selects the file (e.g., `?scenario=ocp_v1` loads
   `scenario.ocp_v1.json`). The default is `scenario.illustrative.json`.

5. **Adding a new scenario file.** Create a file named `scenario.<identifier>.json`
   following the schema in `SPS_Growth_Model_Requirements.md` Section 4.1, extended with
   `schemaVersion`, `meta.isIllustrative`, and per-line `shortCode`. Run
   `npm test` before committing.

---

## Data confidentiality policy

`scenario.ocp_v1.json` contains confidential OCP commercial data.

**Agreed policy:** This file is committed to the private GitHub repository. Every committer
must be an EMBA team member operating under the MIT Sloan Global Lab course NDA.

**Before sharing repo access with anyone outside the NDA boundary:**

- Remove `scenario.ocp_v1.json` from the branch being shared, or
- Use a separate fork that contains only `scenario.illustrative.json`.

**Escalation path:** If the team composition changes and the in-repo policy is no longer
appropriate, move `scenario.ocp_v1.json` to an external path and supply it via the
environment variable `SPS_SCENARIO_DIR`. Update the loader accordingly and document the
change in this file.

**Never commit to a public repository** — the GitHub repo must remain private for the
lifetime of the project.

---

## UI rules

1. **ScenarioBanner is always visible and never dismissable.**
   - When `scenario.illustrative.json` is active: amber background,
     text "Illustrative data — not OCP actuals".
   - When `scenario.ocp_v1.json` (or any file with `isIllustrative: false`) is active:
     dark-gray background, text "OCP confidential — not for external distribution".
   - The banner must not have a close button or any mechanism for the user to hide it.

2. **Invalid input never triggers a silent simulation run.**
   - Slider or table values outside their valid range must show an inline field-level
     error message next to the control.
   - The simulation must not re-run while any field is in an invalid state.
   - Invalid fields must be highlighted so the user knows exactly what to fix.

3. **Bad scenario file shows a blocking error modal.**
   - If `engine/scenario.ts` throws a validation error on load, the app must render a
     full-screen modal listing every invalid field, its current value, and the reason
     it is invalid.
   - The app must not partially render with a bad scenario. The user must either fix the
     file and reload, or click "Reset to defaults" which loads `scenario.illustrative.json`.

4. **Negative accumulators surface a named diagnostic warning.**
   - If the simulator produces a negative capacity or negative pipeline value, it clamps
     the value to zero and emits a named warning (identifying the line, the year, and the
     quantity) that appears in the diagnostics panel.
   - These warnings must never be silently swallowed.

5. **Constraint violations are non-blocking.**
   - A constraint violation shows as a red indicator in the constraint status strip.
   - The app continues to run and display charts even when constraints are violated.
   - Catastrophic results (e.g., NaN or Infinity in simulation output) must be caught,
     clamped, and reported as a diagnostic error rather than rendering broken charts.

---

## Engine rules

1. **Pure functions only.** Every function in `src/engine/` must be a pure function:
   no side effects, no global state, no React imports, no DOM access. This is required
   for v2 Monte Carlo (many concurrent runs) and the numerical optimizer (thousands of
   calls per run).

2. **Co-located tests.** Every engine module ships with a test file in the same directory:
   `engine/types.test.ts`, `engine/scenario.test.ts`, etc.

3. **Explicit return types.** All exported functions in `src/engine/` must have explicit
   TypeScript return type annotations.

4. **Equation notation.** Any equation referenced in a comment or variable name must use
   the exact notation from Section 3 of `SPS_Growth_Model_Requirements.md`. Do not invent
   new symbols or rename variables for readability.

5. **No silent propagation of bad values.** Division by zero must be guarded (use
   `Math.max(value, EPSILON)` where appropriate). NaN and Infinity must be detected after
   each simulation step and replaced with a clamped value plus a diagnostic warning.

---

## Content ownership — `content/math.ts`

`src/content/math.ts` is **owned by the MIT team**.

- The KaTeX strings must match the equations in Section 3 of the requirements document
  exactly, including notation and subscripts.
- The prose explanations must match the writing style of Section 3: business language,
  no systems dynamics terminology, prose sentences not bullet lists, no academic citations.
- **Any change to `src/content/math.ts` requires MIT team review before merging.**
  Engineering may not reword, reorder, or add content without MIT sign-off.
  Open a PR and tag an MIT team member as required reviewer.

---

## Testing rules

1. The 7 unit tests specified in Section 8.1 of the requirements document are mandatory
   and must always pass. They are the minimum bar, not the ceiling.

2. The calibration test in `reference/calibration/calibration.test.ts` is a permanent CI
   gate. It reads the reference spreadsheet CSV export and verifies that the TypeScript
   simulator produces identical numbers to the cent. Any discrepancy is a bug.

3. Tests must not use `console.log` for assertions. Use Vitest `expect` matchers.

4. Do not mock the simulation engine in integration tests. Use the real engine with
   controlled scenario inputs.

---

## Git conventions

- **Commit style:** Conventional Commits — `feat:`, `fix:`, `test:`, `chore:`, `docs:`
- **Branch naming:** `phase/0-scaffold`, `phase/1-engine`, `phase/2-skeleton`, etc.
  Feature branches off a phase branch: `phase/1-engine/finance-module`
- **PRs:** CI must be green (lint + format check + type check + tests + build) before merge
- **No force-push to `main`.**
- **Tag format:** `v1.0.0`, `v1.1.0` — semantic versioning, tags only on `main`

---

## Review gates (blocking)

Three review gates are defined in the project plan. The next phase does not begin until
the gate is signed off.

| Gate | Timing         | Reviewers                  | Focus                                                  |
| ---- | -------------- | -------------------------- | ------------------------------------------------------ |
| A    | End of Phase 1 | MIT team                   | Engine outputs vs. spreadsheet, unit test walk-through |
| B    | End of Phase 3 | MIT team                   | Chart labels, magnitudes, client readiness             |
| C    | End of Phase 5 | MIT team + OCP stakeholder | Math drawer prose accuracy and tone                    |

---

## Parallel deliverables required from PM/MIT team

The following items are on the critical path and must be delivered before the engineering
phase that depends on them begins:

| Deliverable                                              | Required by             | Owner    |
| -------------------------------------------------------- | ----------------------- | -------- |
| Canonical business line names, short codes, legacy flags | End of Day 2 (Phase 0)  | PM       |
| `reference/sps_reference_model.xlsx` + CSV export        | End of Phase 1 (Day 7)  | PM       |
| First OCP data tranche: corporate params + rock supply   | As available            | PM       |
| Math drawer prose for all §3 sections                    | Before Phase 5 (Day 18) | MIT team |
| User guide content                                       | Before Phase 6 (Day 22) | MIT team |
