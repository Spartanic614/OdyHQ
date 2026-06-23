// ============================================================
// Margin calculator model. Pure functions.
// Canonical values are per-unit; per-case is derived.
// Case = 12 singles (we primarily deal in 12-packs → singles at retail),
// so units-per-case is fixed.
// ============================================================

// Fixed pack size: 12 singles per case.
export const UNITS_PER_CASE = 12

export interface MarginInput {
  costUnit: number
  priceUnit: number
}

export const DEFAULT_MARGIN_INPUT: MarginInput = {
  costUnit: 0,
  priceUnit: 0,
}

export interface MarginResult {
  costUnit: number
  costCase: number
  priceUnit: number
  priceCase: number
  profitUnit: number
  profitCase: number
  marginPct: number | null // (price − cost) ÷ price; null when price ≤ 0
  markupPct: number | null // (price − cost) ÷ cost; null when cost ≤ 0
}

export function calcMargin(input: MarginInput): MarginResult {
  const u = UNITS_PER_CASE
  const { costUnit, priceUnit } = input
  return {
    costUnit,
    costCase: costUnit * u,
    priceUnit,
    priceCase: priceUnit * u,
    profitUnit: priceUnit - costUnit,
    profitCase: (priceUnit - costUnit) * u,
    marginPct: priceUnit > 0 ? (priceUnit - costUnit) / priceUnit : null,
    markupPct: costUnit > 0 ? (priceUnit - costUnit) / costUnit : null,
  }
}
