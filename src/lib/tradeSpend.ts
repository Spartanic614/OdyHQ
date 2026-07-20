// ============================================================
// Trade spend calculator model. Pure functions.
// Volume is entered in 12-pack cases; revenue = cases × sell price/case,
// COGS = cases × cost/case. Promo allowances (O/I, MCB, TPR) are % of
// revenue applied to the months selected.
// ============================================================
import { COGS_PER_CASE, TRADE_PROFIT_MARGIN } from '../config/methodology'
import { UNITS_PER_CASE } from './margin'

// A promo allowance: a % rate that runs only in the chosen months (1–12).
export interface PromoAllowance {
  ratePct: number
  months: number[]
}

export type BrokerUnit = 'usd' | 'pct'

export interface TradeSpendInputs {
  dealName: string
  annualCases: number // forecasted annual volume in 12-pack cases
  pricePerCase: number // $ sell price per case (revenue per case)
  cogsPerCase: number // $ cost of goods per 12-pack case
  outlets: number // number of outlets this deal covers
  oi: PromoAllowance
  mcb: PromoAllowance
  tpr: PromoAllowance
  oneTimeMarketing: number
  slotting: number
  demoMerch: number
  broker: number
  brokerUnit: BrokerUnit
  digitalMedia: number
  other: number
}

export const emptyPromo = (): PromoAllowance => ({ ratePct: 0, months: [] })

export const DEFAULT_TRADE_INPUTS: TradeSpendInputs = {
  dealName: '',
  annualCases: 0,
  pricePerCase: 0,
  cogsPerCase: COGS_PER_CASE,
  outlets: 0,
  oi: emptyPromo(),
  mcb: emptyPromo(),
  tpr: emptyPromo(),
  oneTimeMarketing: 0,
  slotting: 0,
  demoMerch: 0,
  broker: 0,
  brokerUnit: 'pct',
  digitalMedia: 0,
  other: 0,
}

export type Verdict = 'Profitable' | 'Breakeven' | 'In the Red'

export interface LineItem {
  key: string
  label: string
  amount: number
  detail?: string
}

export interface TradeSpendResult {
  sales: number // derived revenue ($) = cases × price/case
  cogs: number // derived COGS ($) = cases × cost/case
  monthlySales: number
  oiCost: number
  mcbCost: number
  tprCost: number
  promoTotal: number
  brokerCost: number
  oneTimeTotal: number
  totalTradeSpend: number
  grossProfit: number
  netProfit: number
  netMargin: number // net profit ÷ sales (0 when sales = 0)
  tradeSpendRate: number // trade spend ÷ sales
  spendPerOutlet: number // total trade spend ÷ outlets (0 when outlets = 0)
  unitsPerStorePerWeek: number // annual units (cases × units/case) ÷ outlets ÷ 52 (0 when outlets = 0)
  lineItems: LineItem[]
  verdict: Verdict | null // null when sales = 0 (nothing to judge yet)
}

const promoCost = (p: PromoAllowance, monthlySales: number) =>
  (p.ratePct / 100) * monthlySales * p.months.length

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

export function calcTradeSpend(input: TradeSpendInputs): TradeSpendResult {
  const sales = (input.annualCases || 0) * (input.pricePerCase || 0)
  const cogs = (input.annualCases || 0) * (input.cogsPerCase || 0)
  const monthlySales = sales / 12

  const oiCost = promoCost(input.oi, monthlySales)
  const mcbCost = promoCost(input.mcb, monthlySales)
  const tprCost = promoCost(input.tpr, monthlySales)
  const promoTotal = oiCost + mcbCost + tprCost

  const brokerCost =
    input.brokerUnit === 'pct' ? (input.broker / 100) * sales : input.broker

  const oneTimeTotal =
    input.oneTimeMarketing +
    input.slotting +
    input.demoMerch +
    input.digitalMedia +
    input.other

  const totalTradeSpend = promoTotal + brokerCost + oneTimeTotal
  const grossProfit = sales - cogs
  const netProfit = grossProfit - totalTradeSpend
  const netMargin = sales > 0 ? netProfit / sales : 0
  const tradeSpendRate = sales > 0 ? totalTradeSpend / sales : 0
  const spendPerOutlet = input.outlets > 0 ? totalTradeSpend / input.outlets : 0
  const annualUnits = (input.annualCases || 0) * UNITS_PER_CASE
  const unitsPerStorePerWeek = input.outlets > 0 ? annualUnits / input.outlets / 52 : 0

  const lineItems: LineItem[] = [
    { key: 'oi', label: 'O/I', amount: oiCost, detail: `${input.oi.ratePct}% × ${input.oi.months.length} mo` },
    { key: 'mcb', label: 'MCB', amount: mcbCost, detail: `${input.mcb.ratePct}% × ${input.mcb.months.length} mo` },
    { key: 'tpr', label: 'TPR', amount: tprCost, detail: `${input.tpr.ratePct}% × ${input.tpr.months.length} mo` },
    { key: 'broker', label: 'Broker fees', amount: brokerCost, detail: input.brokerUnit === 'pct' ? `${input.broker}% of sales` : 'flat' },
    { key: 'marketing', label: 'One-time marketing', amount: input.oneTimeMarketing },
    { key: 'slotting', label: 'Slotting fees', amount: input.slotting },
    { key: 'demo', label: 'Demo / merchandising', amount: input.demoMerch },
    { key: 'digital', label: 'Digital / retail media', amount: input.digitalMedia },
    { key: 'other', label: 'Other (one-time)', amount: input.other },
  ]

  return {
    sales,
    cogs,
    monthlySales,
    oiCost,
    mcbCost,
    tprCost,
    promoTotal,
    brokerCost,
    oneTimeTotal,
    totalTradeSpend,
    grossProfit,
    netProfit,
    netMargin,
    tradeSpendRate,
    spendPerOutlet,
    unitsPerStorePerWeek,
    lineItems,
    verdict: classify(netProfit, netMargin, sales > 0),
  }
}
