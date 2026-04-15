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

When the tool first loads, every line is set to a **steady-state baseline**: rock is
allocated at each line's initial run-rate (exactly enough to run at initial installed
capacity), with zero new capex and zero R&D. This is the same baseline the PM
reference spreadsheet uses, and the calibration test verifies it to 10 ppm against
the spreadsheet.

This view is intentional, not a recommended policy. It shows what happens if SPS
does nothing — revenue erodes through price decay, opex grows, and free cash flow
eventually turns negative. The strategic message is that investment is necessary to
maintain value, not optional.

**On the leverage constraint:** the initial debt-to-EBITDA ratio may exceed the
2.5× ceiling in the first few years of the horizon. This reflects the starting
capital structure (D₀ is fixed) and is not a model error. As FCF accumulates and
debt is paid down, the leverage ratio improves and the constraint clears in later
years. Any investment scenario that grows EBITDA will bring leverage into compliance
faster. The constraint strip is working correctly; the early-year red flags are
telling you the business is starting from a leveraged position, which is precisely
the context leadership needs to see.

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
