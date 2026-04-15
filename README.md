# SPS Growth Model

A web-based decision-support tool for capital and raw material allocation across OCP SPS
business lines. Built for the MIT Global Lab 2026 OCP SPS capstone team.

> **Note:** This tool handles confidential OCP commercial data. The repository must remain
> private. See `AGENTS.md` for the data confidentiality policy.

---

## Local development

### Prerequisites

- Node.js 20 or later
- npm 10 or later

### Setup

```bash
git clone <repo-url>
cd sps-growth-model
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Switching scenarios

The active scenario is selected via a URL query parameter:

| URL                                      | Scenario loaded                        |
| ---------------------------------------- | -------------------------------------- |
| `http://localhost:5173/`                 | `scenario.illustrative.json` (default) |
| `http://localhost:5173/?scenario=ocp_v1` | `scenario.ocp_v1.json`                 |
| `http://localhost:5173/?scenario=<name>` | `scenario.<name>.json`                 |

When the illustrative scenario is active, an amber banner reads **"Illustrative data — not
OCP actuals"**. When the OCP scenario is active, a dark-gray banner reads **"OCP
confidential — not for external distribution"**.

### Adding a new scenario file

1. Create `scenario.<identifier>.json` in the project root following the schema in
   `SPS_Growth_Model_Requirements.md` Section 4.1 (plus `schemaVersion` and `shortCode`).
2. Set `"schemaVersion": 1` at the top level.
3. Set `"meta.isIllustrative": false` if the file contains real data.
4. Run `npm test` to verify schema validation passes.
5. Commit and push.

---

## Understanding the default view

When the tool first loads, every line is set to a **growth baseline policy** that
reflects the strategic direction communicated by OCP. Rock allocation ramps to cover
the growing upstream supply, capex builds new capacity in each line while respecting
the debt-raising restriction in 2026 and 2027, and research spending sustains a
product development pipeline across all six lines. The purpose of this default is to
show a plausible path to roughly doubling to tripling revenue over the horizon, as a
starting point users can modify.

The calibration test continues to run against the original steady-state policy
(`buildCalibrationPolicy`, formerly `buildSteadyStatePolicy`), which is the policy
implemented in the PM reference spreadsheet. That test verifies engine correctness
and is independent of the default policy shown in the UI.

**On the leverage constraint:** the starting debt-to-EBITDA ratio exceeds the 2.5×
ceiling in the first few years because the starting balance sheet carries debt that
is high relative to current EBITDA. The growth baseline brings leverage into
compliance by roughly year five as EBITDA expands. This is the core strategic point
of the model: growth investment is how the firm earns its way back inside its
leverage policy, not a luxury to defer.

---

## Development commands

```bash
npm run dev          # start development server
npm test             # run all tests once
npm run test:watch   # run tests in watch mode
npm run test:coverage # run tests with coverage report
npm run lint         # lint TypeScript files
npm run lint:fix     # lint and auto-fix
npm run format       # format all files with Prettier
npm run format:check # check formatting without writing
npm run build        # production build
```

---

## Project structure

```
src/
  engine/      Pure simulation logic — no UI dependencies
  ui/          React components
  content/     Math equations and prose (MIT team owned — see AGENTS.md)
  store/       Zustand state store
  test/        Test configuration
reference/     Independent Excel reference model and calibration tests
docs/          User guide and other documentation
```

See `AGENTS.md` for the full architectural rules, data confidentiality policy, and
contribution guidelines.

---

## Running tests

```bash
npm test                     # all tests
npm run test:coverage        # with coverage
npx vitest run src/engine/   # engine unit tests only
```

The test suite includes:

- 7 mandatory unit tests from §8.1 of the requirements document
- Engine module tests (types, scenario, finance, simulate, constraints)
- Calibration test verifying the TypeScript simulator matches the reference spreadsheet

---

## Contributing

1. Read `AGENTS.md` before making changes.
2. Branch from `main` using the naming convention `phase/<N>-<description>`.
3. CI must pass (lint + format + type check + tests + build) before merging.
4. Changes to `src/content/math.ts` require MIT team review — tag an MIT reviewer in
   your PR.

---

_MIT Global Lab 2026 · OCP SPS Capstone · Confidential_
