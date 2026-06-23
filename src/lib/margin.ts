// ============================================================
// Margin calculator model. Pure functions.
// Canonical values are per-unit; per-case is derived via unitsPerCase.
// Editing either basis keeps both in sync (case = unit × unitsPerCase).
// ============================================================

export interface MarginInput {
  costUnit: number
  priceUnit: number
  unitsPerCase: number
}

export const DEFAULT_MARGIN_INPUT: MarginInput = {
  costUnit: 0,
  priceUnit: 0,
  unitsPerCase: 12,
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
  const u = input.unitsPerCase > 0 ? input.unitsPerCase : 1
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
