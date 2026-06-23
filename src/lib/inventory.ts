// ============================================================
// Inventory paste → parse → WOS calc → buyer message.
// Pure functions; no React, no network. Used by pages/Inventory.tsx.
// ============================================================

export type FieldKey =
  | 'sku'
  | 'description'
  | 'onHand'
  | 'avgWeeklySales'
  | 'onPo'

// The fields we try to detect, in display order.
export const FIELD_LABELS: Record<FieldKey, string> = {
  sku: 'SKU / Item',
  description: 'Description',
  onHand: 'On Hand',
  avgWeeklySales: 'Avg Weekly Sales',
  onPo: 'Qty On PO',
}

// Header aliases (compared after normalization). Order matters: first match wins.
const ALIASES: Record<FieldKey, string[]> = {
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

export interface InventoryItem {
  distributor: string
  sku: string
  description: string
  onHand: number | null
  avgWeeklySales: number | null
  onPo: number | null
  wos: number | null // null when AWS missing/zero
  flagged: boolean
  suggestedOrder: number
}

export interface CalcOptions {
  targetWos: number
  includeOnPo: boolean
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
    const sku = (get(row, 'sku') ?? '').trim()
    const description = (get(row, 'description') ?? '').trim()
    const onHand = parseNumber(get(row, 'onHand'))
    const avgWeeklySales = parseNumber(get(row, 'avgWeeklySales'))
    const onPo = parseNumber(get(row, 'onPo'))

    // Skip fully empty rows.
    if (!sku && onHand == null && avgWeeklySales == null) continue

    let wos: number | null = null
    if (avgWeeklySales != null && avgWeeklySales > 0) {
      const supply = (onHand ?? 0) + (opts.includeOnPo ? (onPo ?? 0) : 0)
      wos = supply / avgWeeklySales
    }

    const flagged = wos != null && wos < opts.targetWos
    let suggestedOrder = 0
    if (flagged && avgWeeklySales != null) {
      const targetUnits = opts.targetWos * avgWeeklySales
      const have = (onHand ?? 0) + (opts.includeOnPo ? (onPo ?? 0) : 0)
      suggestedOrder = Math.max(0, Math.ceil(targetUnits - have))
    }

    items.push({
      distributor,
      sku,
      description,
      onHand,
      avgWeeklySales,
      onPo,
      wos,
      flagged,
      suggestedOrder,
    })
  }
  return items
}

const fmtWos = (w: number | null) => (w == null ? '—' : w.toFixed(1))
const fmtN = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))

// Build the copyable buyer message (bulleted reorder list, grouped by distributor).
export function buildMessage(
  items: InventoryItem[],
  opts: CalcOptions,
  greeting = 'Hi,',
): string {
  const flagged = items.filter((i) => i.flagged && i.suggestedOrder > 0)
  if (flagged.length === 0) {
    return `${greeting}\n\nInventory looks healthy — no SKUs are below ${opts.targetWos} weeks of supply at this time. Thank you!`
  }

  const byDist = new Map<string, InventoryItem[]>()
  for (const it of flagged) {
    const list = byDist.get(it.distributor) ?? []
    list.push(it)
    byDist.set(it.distributor, list)
  }

  const sections: string[] = []
  for (const [dist, list] of byDist) {
    list.sort((a, b) => (a.wos ?? 0) - (b.wos ?? 0))
    const bullets = list
      .map((i) => {
        const name = [i.sku, i.description].filter(Boolean).join(' — ')
        const po = i.onPo != null && i.onPo > 0 ? `, ${fmtN(i.onPo)} on PO` : ''
        return `• ${name}: ${fmtWos(i.wos)} WOS (on hand ${fmtN(i.onHand)}, ~${fmtN(
          i.avgWeeklySales,
        )}/wk${po}). Suggest ordering ${fmtN(i.suggestedOrder)}.`
      })
      .join('\n')
    sections.push(`${dist}:\n${bullets}`)
  }

  return (
    `${greeting}\n\n` +
    `A few items are running below ${opts.targetWos} weeks of supply and could use a replenishment PO:\n\n` +
    sections.join('\n\n') +
    `\n\nLet me know if you'd like me to adjust quantities. Thank you!`
  )
}
