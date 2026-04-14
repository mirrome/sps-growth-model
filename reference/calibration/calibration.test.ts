/**
 * Calibration test — cross-verifies TypeScript simulator against the reference spreadsheet.
 *
 * The PM builds reference/sps_reference_model.xlsx and exports the output tab as
 * reference/sps_reference_model_output.csv. This test reads that CSV and runs the
 * TypeScript simulator on the same inputs, asserting that every cash flow, every state
 * variable, and the final NPV match to the cent.
 *
 * This is a permanent CI gate. Any discrepancy is a bug, not floating-point rounding.
 * See AGENTS.md for the calibration policy.
 *
 * Status: pending spreadsheet delivery from PM (required by end of Phase 1 / Day 7).
 */

import { describe, it } from 'vitest'

describe('Calibration: TypeScript simulator vs reference spreadsheet', () => {
  it.todo(
    'matches reference spreadsheet NPV to the cent when PM delivers sps_reference_model_output.csv',
  )

  it.todo('matches reference spreadsheet FCF for every year t = 0..T')

  it.todo('matches reference spreadsheet revenue by line for every year')

  it.todo('matches reference spreadsheet unit cost learning curve by line')

  it.todo('matches reference spreadsheet pipeline and launched revenue by line')
})
