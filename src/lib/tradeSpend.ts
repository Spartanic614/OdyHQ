// ============================================================
// Trade spend calculator model. Pure functions.
// Annual case volume comes from one of two forecast modes:
//  - 'sku': built bottom-up from per-SKU units/store/week × outlets ×
//    52 weeks, converted from units to 12-pack cases
//  - 'manual': a single directly-entered total of annual 12-pack cases
// Revenue = cases × sell price/case, COGS = cases × cost/case.
// Slotting fees are a per-SKU cost applied across whichever SKUs are
// selected.
// ============================================================
import { COGS_PER_CASE, TRADE_PROFIT_MARGIN } from '../config/methodology'
import { UNITS_PER_CASE } from './margin'

export type ForecastMode = 'sku' | 'manual'

export interface TradeSpendInputs {
  dealName: string
  retailer: string // retailer/account this deal is for — shown on the PDF export
  forecastMode: ForecastMode
  skuForecast: Record<string, number> // flavor -> units per store per week ('sku' mode)
  manualAnnualCases: number // directly-entered annual 12-pack cases ('manual' mode)
  pricePerCase: number // $ sell price per case (revenue per case)
  cogsPerCase: number // $ cost of goods per 12-pack case
  outlets: number // number of outlets this deal covers
  slottingFeePerSku: number // $ slotting fee charged per SKU
  slottingSkus: string[] // flavors this slotting fee applies to
  oneTimeMarketing: number
}

export const DEFAULT_TRADE_INPUTS: TradeSpendInputs = {
  dealName: '',
  retailer: '',
  forecastMode: 'sku',
  skuForecast: {},
  manualAnnualCases: 0,
  pricePerCase: 0,
  cogsPerCase: COGS_PER_CASE,
  outlets: 0,
  slottingFeePerSku: 0,
  slottingSkus: [],
  oneTimeMarketing: 0,
}

export type Verdict = 'Profitable' | 'Breakeven' | 'In the Red'

export interface LineItem {
  key: string
  label: string
  amount: number
  detail?: string
}

export interface TradeSpendResult {
  annualCases: number // 'sku' mode: sum over SKUs of (units/store/week × outlets × 52) ÷ units/case; 'manual' mode: entered directly
  sales: number // derived revenue ($) = cases × price/case
  cogs: number // derived COGS ($) = cases × cost/case
  slottingTotal: number // slotting fee/SKU × number of SKUs selected
  oneTimeTotal: number
  totalTradeSpend: number
  grossProfit: number
  netProfit: number
  netMargin: number // net profit ÷ sales (0 when sales = 0)
  tradeSpendRate: number // trade spend ÷ sales
  spendPerOutlet: number // total trade spend ÷ outlets (0 when outlets = 0)
  lineItems: LineItem[]
  verdict: Verdict | null // null when sales = 0 (nothing to judge yet)
}

export function classify(
  netProfit: number,
  netMargin: number,
  hasSales: boolean,
): Verdict | null {
  if (!hasSales) return null
  if (netProfit < 0) return 'In the Red'
  if (netMargin < TRADE_PROFIT_MARGIN) return 'Breakeven'
  return 'Profitable'
}

// Annual cases for a single SKU, given its units/store/week and the
// deal's outlet count.
export function skuAnnualCases(unitsPerStoreWeek: number, outlets: number): number {
  return ((unitsPerStoreWeek || 0) * (outlets || 0) * 52) / UNITS_PER_CASE
}

export function calcTradeSpend(input: TradeSpendInputs): TradeSpendResult {
  const annualCases =
    input.forecastMode === 'manual'
      ? input.manualAnnualCases || 0
      : Object.values(input.skuForecast).reduce(
          (sum, unitsPerWeek) => sum + skuAnnualCases(unitsPerWeek, input.outlets),
          0,
        )

  const sales = annualCases * (input.pricePerCase || 0)
  const cogs = annualCases * (input.cogsPerCase || 0)

  const slottingTotal = (input.slottingFeePerSku || 0) * input.slottingSkus.length

  const oneTimeTotal = input.oneTimeMarketing + slottingTotal

  const totalTradeSpend = oneTimeTotal
  const grossProfit = sales - cogs
  const netProfit = grossProfit - totalTradeSpend
  const netMargin = sales > 0 ? netProfit / sales : 0
  const tradeSpendRate = sales > 0 ? totalTradeSpend / sales : 0
  const spendPerOutlet = input.outlets > 0 ? totalTradeSpend / input.outlets : 0

  const lineItems: LineItem[] = [
    { key: 'marketing', label: 'One-time marketing', amount: input.oneTimeMarketing },
    {
      key: 'slotting',
      label: 'Slotting fees',
      amount: slottingTotal,
      detail: input.slottingSkus.length > 0 ? `${input.slottingSkus.length} SKUs × ${input.slottingFeePerSku}` : undefined,
    },
  ]

  return {
    annualCases,
    sales,
    cogs,
    slottingTotal,
    oneTimeTotal,
    totalTradeSpend,
    grossProfit,
    netProfit,
    netMargin,
    tradeSpendRate,
    spendPerOutlet,
    lineItems,
    verdict: classify(netProfit, netMargin, sales > 0),
  }
}
