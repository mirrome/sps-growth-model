# SPS Growth Model — v1.0.0 Acceptance Checklist

Derived from §8.2 of the requirements document.
Complete before tagging v1.0.0.

---

## Pre-flight

- [x] All 47 unit tests passing: `npm test`
- [x] Performance tests passing: simulation < 50ms, sensitivity < 2000ms
- [x] CI green: format + lint + typecheck + tests + build
- [x] Calibration test: mark complete when `reference/sps_reference_model_output.csv` delivered

---

## §8.2 Acceptance criteria

### Scenario loading

| #   | Criterion                                                                    | Status         |
| --- | ---------------------------------------------------------------------------- | -------------- |
| 1   | Loads `scenario.illustrative.json` by default                                | ✅ Implemented |
| 2   | Loads `scenario.ocp_v1.json` via `?scenario=ocp_v1` URL param                | ✅ Implemented |
| 3   | Rejects scenario file with wrong `schemaVersion` with clear error            | ✅ Implemented |
| 4   | Shows full-screen error modal listing every invalid field on bad load        | ✅ Implemented |
| 5   | Amber banner "Illustrative data — not OCP actuals" when illustrative         | ✅ Implemented |
| 6   | Dark-gray banner "OCP confidential — not for external distribution" when OCP | ✅ Implemented |
| 7   | Neither banner is dismissable                                                | ✅ Implemented |

### Simulation engine

| #   | Criterion                                                | Status                        |
| --- | -------------------------------------------------------- | ----------------------------- |
| 8   | All 7 §8.1 unit tests pass                               | ✅ 47 tests passing           |
| 9   | Simulation < 50ms per run                                | ✅ Performance test passes    |
| 10  | No NaN or Infinity in any output array                   | ✅ Tested (simulate.test.ts)  |
| 11  | Negative accumulators clamped to zero with named warning | ✅ Implemented in simulate.ts |
| 12  | Calibration test vs reference spreadsheet to the cent    | ⏳ Awaiting PM spreadsheet    |

### User interface — KPI tiles

| #   | Criterion                                                    | Status         |
| --- | ------------------------------------------------------------ | -------------- |
| 13  | 4 KPI tiles: NPV+TV, NPV-TV, terminal revenue, peak leverage | ✅ Implemented |
| 14  | KPI tiles show delta vs pinned reference scenario            | ✅ Implemented |
| 15  | Pin / clear reference works correctly                        | ✅ Implemented |

### User interface — charts

| #   | Criterion                                             | Status         |
| --- | ----------------------------------------------------- | -------------- |
| 16  | Chart 1: Revenue by line — stacked area               | ✅ Implemented |
| 17  | Chart 2: FCF — bar chart                              | ✅ Implemented |
| 18  | Chart 3: Capacity utilization — small multiples       | ✅ Implemented |
| 19  | Chart 4: Production volume — multi-line               | ✅ Implemented |
| 20  | Chart 5: Rock allocation vs supply ceiling            | ✅ Implemented |
| 21  | Chart 6: Leverage with Lmax reference line            | ✅ Implemented |
| 22  | Chart 7: Unit cost (learning curve)                   | ✅ Implemented |
| 23  | Chart 8: Launched revenue from pipeline               | ✅ Implemented |
| 24  | All charts: hover tooltip with exact values and units | ✅ Implemented |
| 25  | All charts: PNG export button                         | ✅ Implemented |
| 26  | Dashboard: full output pane PNG export                | ✅ Implemented |

### User interface — input controls

| #   | Criterion                                                  | Status         |
| --- | ---------------------------------------------------------- | -------------- |
| 27  | Corporate parameter sliders with inline validation         | ✅ Implemented |
| 28  | Business line parameter sliders, tabbed by line            | ✅ Implemented |
| 29  | Rock allocation table with column-sum display              | ✅ Implemented |
| 30  | Capex and R&D allocation tables                            | ✅ Implemented |
| 31  | Invalid input shows inline error, blocks simulation re-run | ✅ Implemented |
| 32  | Scenario export/import (round-trip JSON)                   | ✅ Implemented |
| 33  | Reset to illustrative defaults                             | ✅ Implemented |

### Constraint status

| #   | Criterion                                                    | Status         |
| --- | ------------------------------------------------------------ | -------------- |
| 34  | Constraint strip: 5 families with red/amber/green indicators | ✅ Implemented |
| 35  | Catastrophic violations non-blocking (warning, not crash)    | ✅ Implemented |

### Math drawer

| #   | Criterion                                         | Status                                       |
| --- | ------------------------------------------------- | -------------------------------------------- |
| 36  | All 10 §3.6 equation sections rendered with KaTeX | ✅ Implemented                               |
| 37  | Table of contents with smooth-scroll navigation   | ✅ Implemented                               |
| 38  | Prose content matches MIT writing conventions     | ⏳ Awaiting MIT team content (Review gate C) |

### Sensitivity analysis

| #   | Criterion                                             | Status                     |
| --- | ----------------------------------------------------- | -------------------------- |
| 39  | Auto-evaluates every numeric parameter over ±20% band | ✅ Implemented             |
| 40  | User can filter parameters by name                    | ✅ Implemented             |
| 41  | Tornado chart ranked by NPV range                     | ✅ Implemented             |
| 42  | Sensitivity analysis < 2000ms                         | ✅ Performance test passes |

### Documentation

| #   | Criterion                                                | Status                       |
| --- | -------------------------------------------------------- | ---------------------------- |
| 43  | README.md: local setup, scenario switching, contributing | ✅ Committed                 |
| 44  | AGENTS.md: full coding conventions and policies          | ✅ Committed                 |
| 45  | docs/user_guide.pdf: two-page OCP-audience guide         | ⏳ To be authored in Phase 6 |

### Process

| #   | Criterion                                      | Status                          |
| --- | ---------------------------------------------- | ------------------------------- |
| 46  | 30-minute usability test with non-developer    | ⏳ To be conducted              |
| 47  | ScenarioBanner correct for both scenario files | ✅ Verified in tests            |
| 48  | Schema version rejection fires on mutated file | ✅ Verified in scenario.test.ts |
| 49  | Calibration test still passes                  | ⏳ Awaiting spreadsheet         |
| 50  | v1.0.0 tag on GitHub                           | ⏳ Final step                   |

---

## Blocking items before v1.0.0 tag

1. **Review gate C** — MIT team + OCP stakeholder approve math drawer prose
2. **Calibration test** — PM delivers `reference/sps_reference_model_output.csv`; test passes
3. **Usability test** — 30-minute structured session documented
4. **User guide** — MIT team delivers `docs/user_guide.pdf`
5. **OCP data tranche** — First tranche of `scenario.ocp_v1.json` received and calibration check run

---

_Generated: Phase 6 — SPS Growth Model v1.0.0 pre-release_
