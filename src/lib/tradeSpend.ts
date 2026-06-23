// ============================================================
// Trade spend calculator model. Pure functions.
// Promotional allowances (O/I, MCB, TPR) are % of sales applied to the
// sales falling in the selected months; COGS is a total dollar amount.
// ============================================================
import { TRADE_PROFIT_MARGIN } from '../config/methodology'

// A promo allowance: a % rate that runs only in the chosen months (1–12).
export interface PromoAllowance {
  ratePct: number
  months: number[]
}

export type BrokerUnit = 'usd' | 'pct'

export interface TradeSpendInputs {
  annualSales: number
  cogs: number // total dollars
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
  annualSales: 0,
  cogs: 0,
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
  const sales = input.annualSales || 0
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
  const grossProfit = sales - input.cogs
  const netProfit = grossProfit - totalTradeSpend
  const netMargin = sales > 0 ? netProfit / sales : 0
  const tradeSpendRate = sales > 0 ? totalTradeSpend / sales : 0

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
    lineItems,
    verdict: classify(netProfit, netMargin, sales > 0),
  }
}
