// ============================================================
// Merchandising field-execution analysis.
// Raw data is long-format: one row per store-visit *question*, with the answer
// in "Response". We group rows into store visits and classify execution:
//   - Authorized (in system) vs Not Authorized / Not in System
//   - Pack-out / shelf status (Shelf Full, Out of Stock, Packed N)
//   - Secondary display (Display Up, Not Up, Refused)
// Pure functions; no React. Used by pages/Merchandising.tsx.
// ============================================================
import { parseTable, detectColumns, type ParsedTable } from './parseTable'

export type MerchField =
  | 'storeInfo'
  | 'storeId'
  | 'chain'
  | 'masterChain'
  | 'question'
  | 'response'
  | 'visitDate'
  | 'weekStart'
  | 'survey'

export const MERCH_FIELD_LABELS: Record<MerchField, string> = {
  storeInfo: 'Store Info',
  storeId: 'Store ID',
  chain: 'Chain',
  masterChain: 'Master Chain',
  question: 'Question',
  response: 'Response',
  visitDate: 'Visit Date',
  weekStart: 'Week Start',
  survey: 'Survey Name',
}

// Question + Response are the minimum; a store identifier is also needed.
export const MERCH_REQUIRED: MerchField[] = ['question', 'response']

const ALIASES: Record<MerchField, string[]> = {
  storeInfo: ['store_info', 'store', 'store_name', 'location', 'store_address'],
  storeId: ['store_id', 'storeid', 'store_number', 'store_no', 'store_num', 'tdlinx', 'account_id'],
  chain: ['chain', 'banner', 'account', 'retailer'],
  masterChain: ['master_chain', 'masterchain', 'parent_chain', 'master', 'parent'],
  question: ['question', 'survey_question', 'q'],
  response: ['response', 'answer', 'result', 'value', 'reply'],
  visitDate: ['visit_date', 'visited', 'date_visited', 'visitdate', 'date'],
  weekStart: ['week_start_date', 'week_start', 'weekstart', 'week'],
  survey: ['survey_name', 'survey', 'project', 'program', 'campaign'],
}

export type MerchColumnMap = Partial<Record<MerchField, number>>

export function detectMerchColumns(table: ParsedTable): MerchColumnMap {
  return detectColumns<MerchField>(table.headers, ALIASES)
}

export type Display = 'Display Up' | 'Not Up' | 'Refused' | '—'

export interface StoreVisit {
  key: string
  store: string
  address: string
  storeId: string
  chain: string
  masterChain: string
  survey: string
  visitDate: string
  authorized: boolean
  packOut: string
  display: Display
  notes: string
}

const NOT_AUTH_RE = /not authorized|not in system|not on planogram|item\(s\) not|no authorization/i
const NOISE_RE = /^(na|n\/a|none|nop|no|-|\.)?$/i

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const titleCase = (s: string) => clean(s).replace(/\b\w/g, (c) => c.toUpperCase())

function splitStore(info: string): { label: string; address: string } {
  const parts = info.split('|')
  if (parts.length >= 2) return { label: clean(parts[0]), address: clean(parts.slice(1).join('|')) }
  return { label: clean(info), address: '' }
}

function classifyPackOut(resp: string, authorized: boolean): string {
  if (!authorized) return 'Not Authorized'
  const r = resp.toLowerCase()
  if (!r) return '—'
  if (/shelf is full|shelf full|display-shelf|is full|\bfull\b/.test(r)) return 'Shelf Full'
  if (/out of stock|\boos\b|empty|no stock/.test(r)) return 'Out of Stock'
  const num = r.match(/\d+/)
  if (num) return `Packed ${num[0]}`
  return titleCase(resp)
}

function classifyDisplay(resp: string): Display {
  const r = resp.toLowerCase()
  if (!r) return '—'
  if (/refused/.test(r)) return 'Refused'
  if (/not up|no product|no display|no location|no unit|no secondary/.test(r)) return 'Not Up'
  if (/\bup\b|built|present|\byes\b|installed/.test(r)) return 'Display Up'
  return 'Not Up'
}

export function buildVisits(table: ParsedTable, map: MerchColumnMap): StoreVisit[] {
  const get = (row: string[], f: MerchField) => {
    const i = map[f]
    return i == null ? '' : clean(row[i] ?? '')
  }

  // Group rows into visits: store identity + visit date.
  const groups = new Map<string, string[][]>()
  const order: string[] = []
  for (const row of table.rows) {
    const id = get(row, 'storeId') || get(row, 'storeInfo')
    if (!id) continue
    const when = get(row, 'visitDate') || get(row, 'weekStart')
    const key = `${id}|${when}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(row)
  }

  const firstOf = (rows: string[][], f: MerchField) => {
    for (const r of rows) {
      const v = get(r, f)
      if (v) return v
    }
    return ''
  }
  const responseFor = (rows: string[][], re: RegExp) => {
    for (const r of rows) {
      if (re.test(get(r, 'question'))) return get(r, 'response')
    }
    return ''
  }

  const visits: StoreVisit[] = []
  for (const key of order) {
    const rows = groups.get(key)!
    const { label, address } = splitStore(firstOf(rows, 'storeInfo'))
    const authorized = !rows.some((r) => NOT_AUTH_RE.test(get(r, 'response')))
    const packResp = responseFor(rows, /pack ?out|did you pack/i)
    const displayResp = responseFor(rows, /secondary display|display of odyssey/i)
    const issueResp = responseFor(rows, /issue with product|stock level|pricing|describe any/i)

    visits.push({
      key,
      store: label || firstOf(rows, 'storeId'),
      address,
      storeId: firstOf(rows, 'storeId'),
      chain: firstOf(rows, 'chain'),
      masterChain: firstOf(rows, 'masterChain'),
      survey: firstOf(rows, 'survey'),
      visitDate: firstOf(rows, 'visitDate') || firstOf(rows, 'weekStart'),
      authorized,
      packOut: classifyPackOut(packResp, authorized),
      display: displayResp ? classifyDisplay(displayResp) : '—',
      notes: NOISE_RE.test(issueResp) ? '' : issueResp,
    })
  }
  return visits
}

export interface MerchSummary {
  visits: number
  authorized: number
  notAuthorized: number
  shelfFull: number
  outOfStock: number
  displayUp: number
  refused: number
  authRate: number // authorized / visits
  shelfFullRate: number // shelfFull / authorized
  displayUpRate: number // displayUp / visits
}

export function summarize(visits: StoreVisit[]): MerchSummary {
  const n = visits.length
  const authorized = visits.filter((v) => v.authorized).length
  const shelfFull = visits.filter((v) => v.packOut === 'Shelf Full').length
  const outOfStock = visits.filter((v) => v.packOut === 'Out of Stock').length
  const displayUp = visits.filter((v) => v.display === 'Display Up').length
  const refused = visits.filter((v) => v.display === 'Refused').length
  return {
    visits: n,
    authorized,
    notAuthorized: n - authorized,
    shelfFull,
    outOfStock,
    displayUp,
    refused,
    authRate: n ? authorized / n : 0,
    shelfFullRate: authorized ? shelfFull / authorized : 0,
    displayUpRate: n ? displayUp / n : 0,
  }
}

export interface ChainRollup {
  chain: string
  visits: number
  authorized: number
  notAuthorized: number
  shelfFull: number
  displayUp: number
  refused: number
  authRate: number
}

export function byChain(visits: StoreVisit[]): ChainRollup[] {
  const m = new Map<string, StoreVisit[]>()
  for (const v of visits) {
    const c = v.chain || v.masterChain || '—'
    const list = m.get(c) ?? []
    list.push(v)
    m.set(c, list)
  }
  return [...m.entries()]
    .map(([chain, list]) => {
      const authorized = list.filter((v) => v.authorized).length
      return {
        chain,
        visits: list.length,
        authorized,
        notAuthorized: list.length - authorized,
        shelfFull: list.filter((v) => v.packOut === 'Shelf Full').length,
        displayUp: list.filter((v) => v.display === 'Display Up').length,
        refused: list.filter((v) => v.display === 'Refused').length,
        authRate: list.length ? authorized / list.length : 0,
      }
    })
    .sort((a, b) => b.visits - a.visits)
}

// Convenience for tests / direct use.
export function analyze(text: string) {
  const table = parseTable(text)
  const map = detectMerchColumns(table)
  const visits = buildVisits(table, map)
  return { table, map, visits, summary: summarize(visits), chains: byChain(visits) }
}
