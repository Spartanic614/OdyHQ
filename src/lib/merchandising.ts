// ============================================================
// Merchandising ROI model. Return is driven by corrections the 3rd-party
// merch company makes per touch (out-of-stocks + voids corrected),
// valued at Odyssey's per-case margin; cost is touches × cost per touch.
// Pure functions; inputs supplied by the page.
// ============================================================
import { detectColumns, parseNumber, type ParsedTable } from './parseTable'

export type MerchField =
  | 'retailer'
  | 'distributor'
  | 'oosCorrected'
  | 'voidsCorrected'
  | 'touches'

export const MERCH_FIELD_LABELS: Record<MerchField, string> = {
  retailer: 'Retailer / Account',
  distributor: 'Distributor',
  oosCorrected: 'Out-of-Stocks Corrected',
  voidsCorrected: 'Voids Corrected',
  touches: 'Touches / Visits',
}

export const MERCH_REQUIRED: MerchField[] = [
  'retailer',
  'oosCorrected',
  'voidsCorrected',
  'touches',
]

const ALIASES: Record<MerchField, string[]> = {
  retailer: [
    'retailer', 'account', 'account_name', 'retailer_name', 'chain', 'banner',
    'customer', 'store_group', 'name',
  ],
  distributor: ['distributor', 'dist', 'wholesaler', 'rtm', 'kehe_unfi', 'source'],
  oosCorrected: [
    'oos_corrected', 'out_of_stocks_corrected', 'out_of_stock_corrected',
    'oos_fixed', 'oos', 'out_of_stocks', 'outs_corrected', 'oos_count',
    'stock_corrections', 'oos_resolved',
  ],
  voidsCorrected: [
    'voids_corrected', 'void_corrected', 'voids_fixed', 'voids', 'void',
    'voids_resolved', 'void_count', 'distribution_voids', 'voids_filled',
  ],
  touches: [
    'touches', 'touch', 'visits', 'visit', 'service_calls', 'calls',
    'store_visits', 'stops', 'service_visits', 'number_of_touches', 'touch_count',
  ],
}

export function detectMerchColumns(table: ParsedTable) {
  return detectColumns<MerchField>(table.headers, ALIASES)
}

export type MerchColumnMap = Partial<Record<MerchField, number>>

export interface MerchInputs {
  cogsPerCase: number // Odyssey cost of goods, per case
  sellPerCase: number // price to KeHE/UNFI, per case
  costPerTouch: number // 3rd-party merch cost per touch
  casesPerOos: number // cases recovered per out-of-stock corrected
  casesPerVoid: number // cases gained per void corrected
}

export const DEFAULT_MERCH_INPUTS: MerchInputs = {
  cogsPerCase: 0,
  sellPerCase: 0,
  costPerTouch: 0,
  casesPerOos: 1,
  casesPerVoid: 1,
}

export const marginPerCase = (i: MerchInputs) => i.sellPerCase - i.cogsPerCase

export interface RetailerRoi {
  retailer: string
  distributor: string
  oosCorrected: number
  voidsCorrected: number
  touches: number
  incrementalCases: number
  incrementalProfit: number
  merchCost: number
  netProfit: number
  roi: number | null // net ÷ cost (fraction; ×100 for %)
}

// Aggregate rows to one record per retailer (+distributor) and compute ROI.
export function buildRetailerRoi(
  table: ParsedTable,
  map: MerchColumnMap,
  inputs: MerchInputs,
): RetailerRoi[] {
  const get = (row: string[], f: MerchField): string | null => {
    const idx = map[f]
    return idx == null ? null : (row[idx] ?? null)
  }
  const margin = marginPerCase(inputs)

  const agg = new Map<
    string,
    { retailer: string; distributor: string; oos: number; voids: number; touches: number }
  >()
  for (const row of table.rows) {
    const retailer = (get(row, 'retailer') ?? '').trim()
    const distributor = (get(row, 'distributor') ?? '').trim()
    const oos = parseNumber(get(row, 'oosCorrected')) ?? 0
    const voids = parseNumber(get(row, 'voidsCorrected')) ?? 0
    const touches = parseNumber(get(row, 'touches')) ?? 0
    if (!retailer && oos === 0 && voids === 0 && touches === 0) continue

    const key = `${retailer}||${distributor}`
    const e = agg.get(key) ?? { retailer, distributor, oos: 0, voids: 0, touches: 0 }
    e.oos += oos
    e.voids += voids
    e.touches += touches
    agg.set(key, e)
  }

  const out: RetailerRoi[] = []
  for (const e of agg.values()) {
    const incrementalCases = e.oos * inputs.casesPerOos + e.voids * inputs.casesPerVoid
    const incrementalProfit = incrementalCases * margin
    const merchCost = e.touches * inputs.costPerTouch
    const netProfit = incrementalProfit - merchCost
    const roi = merchCost > 0 ? netProfit / merchCost : null
    out.push({
      retailer: e.retailer || '—',
      distributor: e.distributor,
      oosCorrected: e.oos,
      voidsCorrected: e.voids,
      touches: e.touches,
      incrementalCases,
      incrementalProfit,
      merchCost,
      netProfit,
      roi,
    })
  }
  return out.sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))
}

export interface MerchSummary {
  retailers: number
  touches: number
  incrementalCases: number
  incrementalProfit: number
  merchCost: number
  netProfit: number
  roi: number | null
}

export function summarize(rows: RetailerRoi[]): MerchSummary {
  const s = rows.reduce(
    (acc, r) => {
      acc.touches += r.touches
      acc.incrementalCases += r.incrementalCases
      acc.incrementalProfit += r.incrementalProfit
      acc.merchCost += r.merchCost
      acc.netProfit += r.netProfit
      return acc
    },
    { touches: 0, incrementalCases: 0, incrementalProfit: 0, merchCost: 0, netProfit: 0 },
  )
  return {
    retailers: rows.length,
    ...s,
    roi: s.merchCost > 0 ? s.netProfit / s.merchCost : null,
  }
}
