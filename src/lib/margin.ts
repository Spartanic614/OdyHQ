// ============================================================
// Margin calculator model. Pure functions.
// Cost & price are entered in the selected basis (unit or case);
// results are shown in both, with margin % / markup % / profit.
// ============================================================

export type Basis = 'unit' | 'case'

export interface MarginInput {
  basis: Basis
  cost: number // in selected basis
  price: number // in selected basis
  unitsPerCase: number
}

export const DEFAULT_MARGIN_INPUT: MarginInput = {
  basis: 'unit',
  cost: 0,
  price: 0,
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
  const perUnit = input.basis === 'unit'
  const costUnit = perUnit ? input.cost : input.cost / u
  const costCase = perUnit ? input.cost * u : input.cost
  const priceUnit = perUnit ? input.price : input.price / u
  const priceCase = perUnit ? input.price * u : input.price

  const cost = perUnit ? costUnit : costCase
  const price = perUnit ? priceUnit : priceCase

  return {
    costUnit,
    costCase,
    priceUnit,
    priceCase,
    profitUnit: priceUnit - costUnit,
    profitCase: priceCase - costCase,
    marginPct: price > 0 ? (price - cost) / price : null,
    markupPct: cost > 0 ? (price - cost) / cost : null,
  }
}
