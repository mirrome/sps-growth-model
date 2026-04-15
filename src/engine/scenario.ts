/**
 * Scenario file loading, validation, and defaults.
 *
 * The loader accepts a raw JSON object and returns a validated Scenario,
 * or throws a ScenarioValidationError listing every field that failed.
 */

import type { Scenario, BusinessLineParams, CorporateParams } from './types'
import { CURRENT_SCHEMA_VERSION } from './types'

export class ScenarioValidationError extends Error {
  readonly fieldErrors: FieldError[]

  constructor(fieldErrors: FieldError[]) {
    super(
      `Scenario validation failed with ${fieldErrors.length} error(s):\n` +
        fieldErrors
          .map((e) => `  [${e.field}] ${e.reason} (got: ${JSON.stringify(e.value)})`)
          .join('\n'),
    )
    this.name = 'ScenarioValidationError'
    this.fieldErrors = fieldErrors
  }
}

export interface FieldError {
  field: string
  reason: string
  value: unknown
}

/** Validate and parse a raw JSON object as a Scenario. Throws ScenarioValidationError on failure. */
export function parseScenario(raw: unknown): Scenario {
  const errors: FieldError[] = []

  if (typeof raw !== 'object' || raw === null) {
    throw new ScenarioValidationError([
      { field: 'root', reason: 'must be a JSON object', value: raw },
    ])
  }

  const obj = raw as Record<string, unknown>

  // schemaVersion
  if (obj.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push({
      field: 'schemaVersion',
      reason: `must be ${CURRENT_SCHEMA_VERSION}`,
      value: obj.schemaVersion,
    })
  }

  // meta
  const meta = validateMeta(obj.meta, errors)

  // corporate
  const corporate = validateCorporate(obj.corporate, meta?.horizonYears ?? 10, errors)

  // rockSupply
  const rockSupply = validateNumberArray(
    obj.rockSupply,
    'rockSupply',
    (meta?.horizonYears ?? 10) + 1,
    errors,
  )

  // businessLines
  const businessLines = validateBusinessLines(obj.businessLines, meta?.horizonYears ?? 10, errors)

  if (errors.length > 0) {
    throw new ScenarioValidationError(errors)
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: meta!,
    corporate: corporate!,
    rockSupply: rockSupply!,
    businessLines: businessLines!,
  }
}

function validateMeta(raw: unknown, errors: FieldError[]): Scenario['meta'] | null {
  if (typeof raw !== 'object' || raw === null) {
    errors.push({ field: 'meta', reason: 'must be an object', value: raw })
    return null
  }
  const m = raw as Record<string, unknown>
  const result: Scenario['meta'] = {
    name: typeof m.name === 'string' ? m.name : 'Unnamed',
    description: typeof m.description === 'string' ? m.description : undefined,
    horizonYears: 10,
    // Default to 2026 for backward compatibility with scenario files that
    // pre-date the baseYear field being promoted to the typed interface.
    baseYear: 2026,
    isIllustrative: false,
  }

  if (
    typeof m.horizonYears !== 'number' ||
    !Number.isInteger(m.horizonYears) ||
    m.horizonYears < 1
  ) {
    errors.push({
      field: 'meta.horizonYears',
      reason: 'must be a positive integer',
      value: m.horizonYears,
    })
  } else {
    result.horizonYears = m.horizonYears
  }

  // baseYear is optional; default 2026 covers all pre-typed scenario files.
  if (typeof m.baseYear === 'number' && Number.isFinite(m.baseYear) && m.baseYear > 1900) {
    result.baseYear = Math.round(m.baseYear)
  }

  // isIllustrative is optional; default false so confidential files are never accidentally shown as illustrative
  if (typeof m.isIllustrative === 'boolean') {
    result.isIllustrative = m.isIllustrative
  }

  return result
}

function validateCorporate(
  raw: unknown,
  horizonYears: number,
  errors: FieldError[],
): CorporateParams | null {
  if (typeof raw !== 'object' || raw === null) {
    errors.push({ field: 'corporate', reason: 'must be an object', value: raw })
    return null
  }
  const c = raw as Record<string, unknown>

  const taxRate = requireFraction(c.taxRate, 'corporate.taxRate', errors)
  const rD = requirePositiveNumber(c.rD, 'corporate.rD', errors)
  const rE = requirePositiveNumber(c.rE, 'corporate.rE', errors)
  const equity0 = requirePositiveNumber(c.equity0, 'corporate.equity0', errors)
  const debt0 = requireNonNegativeNumber(c.debt0, 'corporate.debt0', errors)
  const leverageMax = requirePositiveNumber(c.leverageMax, 'corporate.leverageMax', errors)
  const terminalGrowth = requireNumber(c.terminalGrowth, 'corporate.terminalGrowth', errors)
  const depreciation = validateNumberArray(
    c.depreciation,
    'corporate.depreciation',
    horizonYears + 1,
    errors,
  )

  // canRaiseDebt is optional; parse it only when present and well-formed
  let canRaiseDebt: boolean[] | undefined
  if (c.canRaiseDebt !== undefined) {
    if (!Array.isArray(c.canRaiseDebt)) {
      errors.push({
        field: 'corporate.canRaiseDebt',
        reason: 'must be an array of booleans',
        value: c.canRaiseDebt,
      })
    } else if ((c.canRaiseDebt as unknown[]).length !== horizonYears + 1) {
      errors.push({
        field: 'corporate.canRaiseDebt',
        reason: `must have exactly ${horizonYears + 1} elements (got ${(c.canRaiseDebt as unknown[]).length})`,
        value: `array of length ${(c.canRaiseDebt as unknown[]).length}`,
      })
    } else if (!(c.canRaiseDebt as unknown[]).every((v) => typeof v === 'boolean')) {
      errors.push({
        field: 'corporate.canRaiseDebt',
        reason: 'every element must be a boolean',
        value: c.canRaiseDebt,
      })
    } else {
      canRaiseDebt = c.canRaiseDebt as boolean[]
    }
  }

  if (errors.some((e) => e.field.startsWith('corporate'))) return null

  return {
    taxRate: taxRate!,
    rD: rD!,
    rE: rE!,
    equity0: equity0!,
    debt0: debt0!,
    leverageMax: leverageMax!,
    terminalGrowth: terminalGrowth!,
    depreciation: depreciation!,
    ...(canRaiseDebt !== undefined ? { canRaiseDebt } : {}),
  }
}

function validateBusinessLines(
  raw: unknown,
  horizonYears: number,
  errors: FieldError[],
): BusinessLineParams[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push({ field: 'businessLines', reason: 'must be a non-empty array', value: raw })
    return null
  }

  const lines: BusinessLineParams[] = []
  for (let i = 0; i < raw.length; i++) {
    const prefix = `businessLines[${i}]`
    const line = validateBusinessLine(raw[i], prefix, horizonYears, errors)
    if (line) lines.push(line)
  }

  return lines.length === raw.length ? lines : null
}

function validateBusinessLine(
  raw: unknown,
  prefix: string,
  horizonYears: number,
  errors: FieldError[],
): BusinessLineParams | null {
  if (typeof raw !== 'object' || raw === null) {
    errors.push({ field: prefix, reason: 'must be an object', value: raw })
    return null
  }
  const b = raw as Record<string, unknown>
  const prevErrorCount = errors.length

  const name = requireString(b.name, `${prefix}.name`, errors)
  const shortCode = requireString(b.shortCode, `${prefix}.shortCode`, errors)

  if (typeof b.isLegacy !== 'boolean') {
    errors.push({ field: `${prefix}.isLegacy`, reason: 'must be a boolean', value: b.isLegacy })
  }

  const yieldVal = requireFraction(b.yield, `${prefix}.yield`, errors)
  const capexUnitCost = requirePositiveNumber(b.capexUnitCost, `${prefix}.capexUnitCost`, errors)
  const buildLeadTime = requireNonNegativeInteger(
    b.buildLeadTime,
    `${prefix}.buildLeadTime`,
    errors,
  )
  const capacityDepreciation = requireFraction(
    b.capacityDepreciation,
    `${prefix}.capacityDepreciation`,
    errors,
  )
  const baseUnitCost = requirePositiveNumber(b.baseUnitCost, `${prefix}.baseUnitCost`, errors)
  const learningExponent = requireFraction(b.learningExponent, `${prefix}.learningExponent`, errors)
  const baseCumulativeVolume = requirePositiveNumber(
    b.baseCumulativeVolume,
    `${prefix}.baseCumulativeVolume`,
    errors,
  )
  const basePrice = requirePositiveNumber(b.basePrice, `${prefix}.basePrice`, errors)
  const priceErosion = requireFraction(b.priceErosion, `${prefix}.priceErosion`, errors)
  const rdProductivity = requireNonNegativeNumber(
    b.rdProductivity,
    `${prefix}.rdProductivity`,
    errors,
  )
  const rdLag = requireNonNegativeInteger(b.rdLag, `${prefix}.rdLag`, errors)
  const rdConversion = requireFraction(b.rdConversion, `${prefix}.rdConversion`, errors)
  const legacyFloor = requireNonNegativeNumber(b.legacyFloor, `${prefix}.legacyFloor`, errors)
  const opex = validateNumberArray(b.opex, `${prefix}.opex`, horizonYears + 1, errors)
  const initialCapacity = requireNonNegativeNumber(
    b.initialCapacity,
    `${prefix}.initialCapacity`,
    errors,
  )
  const initialPipeline = requireNonNegativeNumber(
    b.initialPipeline,
    `${prefix}.initialPipeline`,
    errors,
  )

  if (errors.length > prevErrorCount) return null

  return {
    name: name!,
    shortCode: shortCode!,
    isLegacy: b.isLegacy as boolean,
    yield: yieldVal!,
    capexUnitCost: capexUnitCost!,
    buildLeadTime: buildLeadTime!,
    capacityDepreciation: capacityDepreciation!,
    baseUnitCost: baseUnitCost!,
    learningExponent: learningExponent!,
    baseCumulativeVolume: baseCumulativeVolume!,
    basePrice: basePrice!,
    priceErosion: priceErosion!,
    rdProductivity: rdProductivity!,
    rdLag: rdLag!,
    rdConversion: rdConversion!,
    legacyFloor: legacyFloor!,
    opex: opex!,
    initialCapacity: initialCapacity!,
    initialPipeline: initialPipeline!,
  }
}

// --- Validation helpers ---

function requireString(v: unknown, field: string, errors: FieldError[]): string | null {
  if (typeof v !== 'string' || v.trim() === '') {
    errors.push({ field, reason: 'must be a non-empty string', value: v })
    return null
  }
  return v
}

function requireNumber(v: unknown, field: string, errors: FieldError[]): number | null {
  if (typeof v !== 'number' || !isFinite(v)) {
    errors.push({ field, reason: 'must be a finite number', value: v })
    return null
  }
  return v
}

function requirePositiveNumber(v: unknown, field: string, errors: FieldError[]): number | null {
  const n = requireNumber(v, field, errors)
  if (n !== null && n <= 0) {
    errors.push({ field, reason: 'must be greater than zero', value: v })
    return null
  }
  return n
}

function requireNonNegativeNumber(v: unknown, field: string, errors: FieldError[]): number | null {
  const n = requireNumber(v, field, errors)
  if (n !== null && n < 0) {
    errors.push({ field, reason: 'must be >= 0', value: v })
    return null
  }
  return n
}

function requireFraction(v: unknown, field: string, errors: FieldError[]): number | null {
  const n = requireNumber(v, field, errors)
  if (n !== null && (n < 0 || n > 1)) {
    errors.push({ field, reason: 'must be between 0 and 1', value: v })
    return null
  }
  return n
}

function requireNonNegativeInteger(v: unknown, field: string, errors: FieldError[]): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    errors.push({ field, reason: 'must be a non-negative integer', value: v })
    return null
  }
  return v
}

function validateNumberArray(
  v: unknown,
  field: string,
  expectedLength: number,
  errors: FieldError[],
): number[] | null {
  if (!Array.isArray(v)) {
    errors.push({ field, reason: `must be an array of ${expectedLength} numbers`, value: v })
    return null
  }
  if (v.length !== expectedLength) {
    errors.push({
      field,
      reason: `must have exactly ${expectedLength} elements (got ${v.length})`,
      value: `array of length ${v.length}`,
    })
    return null
  }
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== 'number' || !isFinite(v[i])) {
      errors.push({ field: `${field}[${i}]`, reason: 'must be a finite number', value: v[i] })
      return null
    }
  }
  return v as number[]
}
