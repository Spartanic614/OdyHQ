/* eslint-disable no-console */
// ============================================================
// Seed / refresh loader.
//   npm run seed
// Reads the serving tabs of ./data_import/Odyssey_Mothership_Export.xlsx
// and loads them into Supabase using the SERVICE ROLE key (local only).
//
// Re-runnable: natural-PK tables upsert; identity-PK tables are reloaded
// (delete-all then insert) so weekly refreshes never duplicate.
// ============================================================
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

config({ path: '.env.local' })

const EXCEL_PATH = resolve('./data_import/Odyssey_Mothership_Export.xlsx')
const URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !SERVICE_KEY || SERVICE_KEY.startsWith('PASTE_')) {
  console.error(
    '✗ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n' +
      '  Get the service_role secret from Supabase → Project Settings → API.',
  )
  process.exit(1)
}
if (!existsSync(EXCEL_PATH)) {
  console.error(`✗ Data file not found: ${EXCEL_PATH}`)
  console.error('  Export the workbook serving tabs to that path and re-run.')
  process.exit(1)
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Normalize a header/sheet name to a snake_case key for matching.
const norm = (s: string) =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

type Mode = 'upsert' | 'reload'

interface TableSpec {
  table: string
  /** Candidate sheet names (normalized match). First found wins. */
  sheets: string[]
  mode: Mode
  conflict?: string // for upsert
  columns: string[] // DB columns to keep
  intCols?: string[]
  numCols?: string[]
  /** header alias → db column (both compared normalized). */
  aliases?: Record<string, string>
}

// Load order respects FKs: dims (no FK) → contact → facts/bridges.
const SPECS: TableSpec[] = [
  {
    table: 'dim_sku',
    sheets: ['dim_sku', 'sku', 'skus', 'portfolio'],
    mode: 'upsert',
    conflict: 'sku_code',
    columns: ['sku_code', 'flavor', 'mg', 'pack', 'retail_upc', 'srp', 'dist_case_cost'],
    numCols: ['srp', 'dist_case_cost'],
  },
  {
    table: 'dim_dc',
    sheets: ['dim_dc', 'dc', 'dcs', 'distribution_centers'],
    mode: 'upsert',
    conflict: 'dc_code',
    columns: [
      'dc_code', 'dc_name', 'type', 'territory', 'odyssey_contact', 'gocrisp_name',
      'city', 'state', 'zip', 'buyer', 'dp_case_cost', 'dp_margin',
      'l52w_did_buys', 'l52w_volume', 'new_at_kehe',
    ],
    intCols: ['l52w_did_buys', 'l52w_volume'],
    numCols: ['dp_case_cost', 'dp_margin'],
  },
  {
    table: 'dim_chain',
    sheets: ['dim_chain', 'chain', 'chains'],
    mode: 'upsert',
    conflict: 'chain_id',
    columns: [
      'chain_id', 'chain_name', 'active', 'region', 'state', 'total_universe',
      'account_manager', 'channel', 'infra_ncg', 'green_spoon_manager',
      'distributor', 'transitional_to_dsd', 'current_srp', 'edlp', 'case_cost',
    ],
    intCols: ['total_universe'],
    numCols: ['current_srp', 'case_cost'],
  },
  {
    table: 'dim_prospect',
    sheets: ['dim_prospect', 'prospect', 'prospects', 'spins'],
    mode: 'reload',
    columns: ['prospect_name', 'channel', 'rtm', 'hq_state', 'region', 'units', 'contacted', 'notes'],
    intCols: ['units'],
  },
  {
    table: 'dim_contact',
    sheets: ['dim_contact', 'contact', 'contacts'],
    mode: 'reload',
    columns: ['contact_name', 'email', 'phone', 'role', 'chain_id', 'dc_code', 'notes'],
  },
  {
    table: 'fact_dc_sku_auth',
    sheets: ['fact_dc_sku_auth', 'dc_sku_auth', 'dc_sku'],
    mode: 'upsert',
    conflict: 'dc_code,sku_code',
    columns: ['dc_code', 'sku_code', 'auth_status', 'moq'],
    intCols: ['moq'],
  },
  {
    table: 'fact_chain_sku_auth',
    sheets: ['fact_chain_sku_auth', 'chain_sku_auth', 'chain_sku'],
    mode: 'upsert',
    conflict: 'chain_id,sku_code',
    columns: ['chain_id', 'sku_code', 'auth_status'],
  },
  {
    table: 'fact_category_review',
    sheets: ['fact_category_review', 'category_review', 'review'],
    mode: 'upsert',
    conflict: 'chain_id',
    columns: [
      'chain_id', 'review_period_2026', 'meeting_progress', 'date_scheduled',
      'odyssey_in_2025', 'odyssey_in_2026', 'comments',
    ],
  },
  {
    table: 'bridge_dc_anchor',
    sheets: ['bridge_dc_anchor', 'dc_anchor', 'anchor'],
    mode: 'reload',
    columns: ['dc_code', 'anchor_chain_name', 'anchor_chain_id'],
  },
  {
    table: 'fact_calendar',
    sheets: ['fact_calendar', 'calendar', 'events'],
    mode: 'reload',
    columns: ['event_type', 'entity', 'month', 'year', 'title', 'detail'],
    intCols: ['month', 'year'],
  },
  {
    table: 'ref_fees',
    sheets: ['ref_fees', 'fees', 'fee'],
    mode: 'reload',
    columns: ['distributor', 'fee', 'cost', 'definition'],
  },
]

function coerceNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const cleaned = String(v).replace(/[$,%\s]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function findSheet(wb: XLSX.WorkBook, candidates: string[]): string | null {
  const map = new Map(wb.SheetNames.map((n) => [norm(n), n]))
  for (const c of candidates) {
    const hit = map.get(norm(c))
    if (hit) return hit
  }
  return null
}

function buildRows(
  raw: Record<string, unknown>[],
  spec: TableSpec,
): Record<string, unknown>[] {
  const colSet = new Set(spec.columns)
  const intSet = new Set(spec.intCols ?? [])
  const numSet = new Set(spec.numCols ?? [])
  const aliasMap = new Map(
    Object.entries(spec.aliases ?? {}).map(([k, v]) => [norm(k), v]),
  )
  const out: Record<string, unknown>[] = []

  for (const r of raw) {
    const row: Record<string, unknown> = {}
    let hasValue = false
    for (const [header, value] of Object.entries(r)) {
      const key = aliasMap.get(norm(header)) ?? norm(header)
      if (!colSet.has(key)) continue
      let v: unknown = value
      if (typeof v === 'string') v = v.trim()
      if (v === '') v = null
      if (v != null && (intSet.has(key) || numSet.has(key))) {
        const n = coerceNumber(v)
        v = intSet.has(key) && n != null ? Math.round(n) : n
      }
      if (v != null) hasValue = true
      row[key] = v
    }
    if (hasValue) out.push(row)
  }
  return out
}

async function loadTable(wb: XLSX.WorkBook, spec: TableSpec) {
  const sheetName = findSheet(wb, spec.sheets)
  if (!sheetName) {
    console.warn(`⚠ ${spec.table}: no matching sheet (${spec.sheets.join(', ')}) — skipped`)
    return
  }
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[sheetName],
    { defval: null },
  )
  const rows = buildRows(raw, spec)
  if (!rows.length) {
    console.warn(`⚠ ${spec.table}: sheet "${sheetName}" produced 0 rows`)
    return
  }

  if (spec.mode === 'reload') {
    const { error: delErr } = await supabase
      .from(spec.table)
      .delete()
      .gte('id', -2147483648) // delete all (identity id always present)
    if (delErr) {
      console.error(`✗ ${spec.table}: clear failed — ${delErr.message}`)
      return
    }
    const { error } = await supabase.from(spec.table).insert(rows)
    if (error) {
      console.error(`✗ ${spec.table}: insert failed — ${error.message}`)
      return
    }
  } else {
    const { error } = await supabase
      .from(spec.table)
      .upsert(rows, { onConflict: spec.conflict })
    if (error) {
      console.error(`✗ ${spec.table}: upsert failed — ${error.message}`)
      return
    }
  }
  console.log(`✓ ${spec.table.padEnd(22)} ${String(rows.length).padStart(4)} rows  (from "${sheetName}")`)
}

async function main() {
  console.log(`Reading ${EXCEL_PATH}`)
  const wb = XLSX.read(readFileSync(EXCEL_PATH), { type: 'buffer' })
  console.log(`Sheets: ${wb.SheetNames.join(', ')}\n`)
  for (const spec of SPECS) {
    // Sequential to respect FK ordering.
    // eslint-disable-next-line no-await-in-loop
    await loadTable(wb, spec)
  }
  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
