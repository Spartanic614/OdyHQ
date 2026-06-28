// ============================================================
// Inventory paste → parse → WOS calc → buyer message.
// Pure functions; no React, no network. Used by pages/Inventory.tsx.
// ============================================================
import { lookupDc, firstName } from '../config/dcBuyers'

export type FieldKey =
  | 'dc'
  | 'sku'
  | 'description'
  | 'onHand'
  | 'avgWeeklySales'
  | 'onPo'

// The fields we try to detect, in display order.
export const FIELD_LABELS: Record<FieldKey, string> = {
  dc: 'DC',
  sku: 'SKU / Item',
  description: 'Description',
  onHand: 'On Hand',
  avgWeeklySales: 'Avg Weekly Sales',
  onPo: 'Qty On PO',
}

// Header aliases (compared after normalization). Order matters: first match wins.
const ALIASES: Record<FieldKey, string[]> = {
  dc: [
    'dc', 'dc_code', 'dccode', 'dc_id', 'distribution_center', 'distributioncenter',
    'warehouse', 'whse', 'wh', 'facility', 'site', 'branch', 'dc_name',
  ],
  sku: [
    'sku', 'sku_code', 'item', 'item_number', 'item_no', 'item_code', 'item_id',
    'product', 'product_code', 'upc', 'kehe', 'kehe_number', 'unfi', 'unfi_number',
    'dpi', 'vendor_item',
  ],
  description: [
    'description', 'desc', 'item_description', 'product_description', 'name',
    'product_name', 'flavor', 'long_description',
  ],
  onHand: [
    'on_hand', 'onhand', 'qty_on_hand', 'quantity_on_hand', 'units_on_hand',
    'available', 'available_qty', 'inventory', 'inventory_on_hand', 'stock',
    'stock_on_hand', 'oh', 'soh', 'current_inventory', 'units_available',
  ],
  avgWeeklySales: [
    'avg_weekly_sales', 'average_weekly_sales', 'aws', 'weekly_sales',
    'avg_wkly_sales', 'avg_weekly_units', 'units_per_week', 'avg_units_week',
    'weekly_velocity', 'velocity', 'avg_weekly_movement', 'wkly_sales',
  ],
  onPo: [
    'on_po', 'qty_on_po', 'quantity_on_po', 'quantity_on_purchase_order',
    'on_purchase_order', 'po_qty', 'open_po', 'on_order', 'qty_on_order',
    'open_po_qty', 'po_quantity', 'incoming',
  ],
}

const norm = (s: string) =>
  s.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t'
  if (line.includes(',')) return ','
  // Fall back to 2+ spaces (fixed-width-ish pastes).
  if (/\s{2,}/.test(line)) return 'MULTISPACE'
  return ','
}

function splitLine(line: string, delim: string): string[] {
  if (delim === 'MULTISPACE') return line.split(/\s{2,}/).map((c) => c.trim())
  if (delim === ',') {
    // Minimal CSV: handle simple quoted cells.
    const out: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q
      } else if (ch === ',' && !q) { out.push(cur); cur = '' } else cur += ch
    }
    out.push(cur)
    return out.map((c) => c.trim())
  }
  return line.split(delim).map((c) => c.trim())
}

export function parseNumber(v: string | null | undefined): number | null {
  if (v == null) return null
  const cleaned = String(v).replace(/[$,%\s]/g, '').replace(/[()]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export type ColumnMap = Partial<Record<FieldKey, number>>

export interface ParseResult {
  headers: string[]
  rows: string[][]
  /** auto-detected field → column index */
  detected: ColumnMap
}

// Parse pasted text into headers + rows + an auto-detected column mapping.
export function parsePaste(text: string): ParseResult {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [], detected: {} }

  const delim = detectDelimiter(lines[0])
  const headers = splitLine(lines[0], delim)
  const rows = lines.slice(1).map((l) => splitLine(l, delim))

  const normHeaders = headers.map(norm)
  const detected: ColumnMap = {}
  const used = new Set<number>()
  for (const field of Object.keys(ALIASES) as FieldKey[]) {
    for (const alias of ALIASES[field]) {
      const idx = normHeaders.findIndex((h, i) => h === alias && !used.has(i))
      if (idx >= 0) {
        detected[field] = idx
        used.add(idx)
        break
      }
    }
    // Looser contains-match if no exact alias hit.
    if (detected[field] == null) {
      for (const alias of ALIASES[field]) {
        const idx = normHeaders.findIndex(
          (h, i) => h.includes(alias) && !used.has(i),
        )
        if (idx >= 0) {
          detected[field] = idx
          used.add(idx)
          break
        }
      }
    }
  }
  return { headers, rows, detected }
}

// Risk is lead-time aware:
//   At Risk  — WOS ≤ lead time: stocks out before a PO placed today can arrive
//   Reorder  — lead time < WOS ≤ target: below target, order now to stay ahead
//   OK       — WOS > target
//   No Sales — AWS missing/zero, can't compute
export type RiskLevel = 'At Risk' | 'Reorder' | 'OK' | 'No Sales'

export interface InventoryItem {
  distributor: string
  dc: string // DC code from the leftmost column (upper-cased)
  buyer: string // resolved buyer first name ('' if DC not in reference)
  sku: string
  description: string
  onHand: number | null
  avgWeeklySales: number | null
  onPo: number | null
  wos: number | null // null when AWS missing/zero
  risk: RiskLevel
  flagged: boolean // risk is At Risk or Reorder
  suggestedOrder: number // units of demand to cover (precise need)
  suggestedCases: number // need rounded up to whole cases
  suggestedLayers: number // need rounded up to whole layers (buyer's order unit)
}

export interface CalcOptions {
  targetWos: number
  includeOnPo: boolean
  leadTimeWeeks: number
  unitsPerCase: number
  casesPerLayer: number
}

export function buildItems(
  rows: string[][],
  map: ColumnMap,
  distributor: string,
  opts: CalcOptions,
): InventoryItem[] {
  const get = (row: string[], field: FieldKey): string | null => {
    const idx = map[field]
    return idx == null ? null : (row[idx] ?? null)
  }

  const items: InventoryItem[] = []
  for (const row of rows) {
    const dc = (get(row, 'dc') ?? '').trim().toUpperCase()
    const sku = (get(row, 'sku') ?? '').trim()
    const description = (get(row, 'description') ?? '').trim()
    const onHand = parseNumber(get(row, 'onHand'))
    const avgWeeklySales = parseNumber(get(row, 'avgWeeklySales'))
    const onPo = parseNumber(get(row, 'onPo'))

    // Skip fully empty rows.
    if (!sku && onHand == null && avgWeeklySales == null) continue

    // Resolve the DC → owning buyer + distributor. The DC mapping wins over the
    // dropdown default; unmapped DCs fall back to it with no buyer name.
    const ref = lookupDc(dc)
    const rowDistributor = ref?.distributor ?? distributor
    const buyer = ref ? firstName(ref.buyer) : ''

    let wos: number | null = null
    if (avgWeeklySales != null && avgWeeklySales > 0) {
      const supply = (onHand ?? 0) + (opts.includeOnPo ? (onPo ?? 0) : 0)
      wos = supply / avgWeeklySales
    }

    // Lead-time-aware risk classification.
    let risk: RiskLevel
    if (wos == null) risk = 'No Sales'
    else if (wos <= opts.leadTimeWeeks) risk = 'At Risk'
    else if (wos <= opts.targetWos) risk = 'Reorder'
    else risk = 'OK'

    const flagged = risk === 'At Risk' || risk === 'Reorder'

    // Order enough to cover demand during the lead time AND land back at
    // target WOS when it arrives: (target + leadTime) × AWS − what we have.
    // Need is in units; buyers order in layers, so also express in cases/layers.
    let suggestedOrder = 0
    if (flagged && avgWeeklySales != null) {
      const targetUnits = (opts.targetWos + opts.leadTimeWeeks) * avgWeeklySales
      const have = (onHand ?? 0) + (opts.includeOnPo ? (onPo ?? 0) : 0)
      suggestedOrder = Math.max(0, Math.ceil(targetUnits - have))
    }
    const unitsPerCase = opts.unitsPerCase > 0 ? opts.unitsPerCase : 1
    const unitsPerLayer = unitsPerCase * (opts.casesPerLayer > 0 ? opts.casesPerLayer : 1)
    const suggestedCases = suggestedOrder > 0 ? Math.ceil(suggestedOrder / unitsPerCase) : 0
    const suggestedLayers = suggestedOrder > 0 ? Math.ceil(suggestedOrder / unitsPerLayer) : 0

    items.push({
      distributor: rowDistributor,
      dc,
      buyer,
      sku,
      description,
      onHand,
      avgWeeklySales,
      onPo,
      wos,
      risk,
      flagged,
      suggestedOrder,
      suggestedCases,
      suggestedLayers,
    })
  }
  return items
}

const fmtWos = (w: number | null) => (w == null ? '—' : w.toFixed(1))
const fmtN = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))

const bulletFor = (i: InventoryItem) => {
  const name = [i.sku, i.description].filter(Boolean).join(' — ')
  const po = i.onPo != null && i.onPo > 0 ? `, ${fmtN(i.onPo)} on PO` : ''
  const order = i.suggestedLayers > 0
    ? `${i.suggestedLayers} layer${i.suggestedLayers > 1 ? 's' : ''} (~${fmtN(i.suggestedOrder)} units)`
    : `${fmtN(i.suggestedOrder)} units`
  return `• ${name}: ${fmtWos(i.wos)} WOS (on hand ${fmtN(i.onHand)}, ~${fmtN(
    i.avgWeeklySales,
  )}/wk${po}). Suggest ordering ${order}.`
}

// Section label for a DC: "City (Distributor)" when known, else the raw code.
const dcLabel = (item: InventoryItem) => {
  const ref = lookupDc(item.dc)
  if (ref) return `${ref.city} (${ref.distributor})`
  return item.dc || item.distributor || 'Items'
}

// Group a set of items into "DC:\n• …" sections, most urgent first.
const sectionsByDc = (items: InventoryItem[]) => {
  const byDc = new Map<string, { label: string; list: InventoryItem[] }>()
  for (const it of items) {
    const key = it.dc || it.distributor || 'items'
    const entry = byDc.get(key) ?? { label: dcLabel(it), list: [] }
    entry.list.push(it)
    byDc.set(key, entry)
  }
  const out: string[] = []
  for (const { label, list } of byDc.values()) {
    list.sort((a, b) => (a.wos ?? 0) - (b.wos ?? 0))
    out.push(`${label}:\n${list.map(bulletFor).join('\n')}`)
  }
  return out
}

// Body of one buyer's email: lead-in + AT RISK / REORDER sections + closing.
function buyerBody(items: InventoryItem[], opts: CalcOptions): string {
  const atRisk = items.filter((i) => i.risk === 'At Risk')
  const reorder = items.filter((i) => i.risk === 'Reorder')

  const blocks: string[] = []
  if (atRisk.length) {
    blocks.push(
      `AT RISK — projected to stock out before a new PO can arrive (${opts.leadTimeWeeks}-week lead time):\n\n` +
        sectionsByDc(atRisk).join('\n\n'),
    )
  }
  if (reorder.length) {
    blocks.push(
      `REORDER — below our ${opts.targetWos}-week target; ordering now keeps us ahead:\n\n` +
        sectionsByDc(reorder).join('\n\n'),
    )
  }

  const atRiskPhrase = `${atRisk.length} SKU${atRisk.length > 1 ? 's' : ''} at risk of stocking out before replenishment arrives (our PO-to-warehouse lead time is ${opts.leadTimeWeeks} weeks)`
  let lead: string
  if (atRisk.length && reorder.length) {
    lead = `We have ${atRiskPhrase}, plus ${reorder.length} more below our ${opts.targetWos}-week target:`
  } else if (atRisk.length) {
    lead = `We have ${atRiskPhrase}:`
  } else {
    lead = `A few items are below our ${opts.targetWos}-week target and could use a replenishment PO:`
  }

  const unitsPerLayer =
    (opts.unitsPerCase > 0 ? opts.unitsPerCase : 1) *
    (opts.casesPerLayer > 0 ? opts.casesPerLayer : 1)

  return (
    `${lead}\n\n` +
    blocks.join('\n\n') +
    `\n\nQuantities are in layers (1 layer = ${opts.casesPerLayer} cases / ${fmtN(unitsPerLayer)} units) and cover the ${opts.leadTimeWeeks}-week lead time plus our target. Happy to adjust. Thank you!`
  )
}

// Build the copyable buyer message(s). Items are grouped by their resolved
// buyer (via the DC reference) and each buyer is greeted by first name. When
// a paste spans multiple buyers, one email per buyer is produced. Rows whose
// DC isn't in the reference fall back to the manual greeting.
export function buildMessage(
  items: InventoryItem[],
  opts: CalcOptions,
  greeting = 'Hi,',
): string {
  const actionable = items.filter((i) => i.flagged && i.suggestedOrder > 0)
  if (actionable.length === 0) {
    return `${greeting}\n\nInventory looks healthy — every SKU has more than ${opts.targetWos} weeks of supply, comfortably above our ${opts.leadTimeWeeks}-week replenishment lead time. Thank you!`
  }

  // Group by buyer first name; '' = unresolved DC (uses the manual greeting).
  const byBuyer = new Map<string, InventoryItem[]>()
  for (const it of actionable) {
    const key = it.buyer || ''
    const list = byBuyer.get(key) ?? []
    list.push(it)
    byBuyer.set(key, list)
  }

  const emails: string[] = []
  for (const [buyer, list] of byBuyer) {
    const greet = buyer ? `Hi ${buyer},` : greeting
    emails.push(`${greet}\n\n${buyerBody(list, opts)}`)
  }
  // Multiple buyers → separate emails, clearly delimited.
  return emails.join('\n\n' + '—'.repeat(20) + '\n\n')
}
