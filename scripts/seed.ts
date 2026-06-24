/* eslint-disable no-console */
// ============================================================
// Seed / refresh loader for "Odyssey Mothership Local.xlsx".
//   npm run seed
//
// The workbook is built around a few WIDE operational sheets, not one tidy
// table per sheet. This loader reshapes them into the normalized Supabase
// schema:
//
//   Sku Specs          -> dim_sku            (enriches the canonical SKU list)
//   Distribution       -> dim_dc + fact_dc_sku_auth + bridge_dc_anchor
//   Account Management -> dim_chain + fact_category_review + fact_chain_sku_auth
//   Calendar (matrix)  -> fact_calendar
//
// SKUs are resolved through an explicit canonical registry (CANON_SKUS): the
// three sheets disagree on item numbers and UPCs, so the only reliable join
// key is the flavor name, matched via alias lists.
//
// Uses the SERVICE ROLE key (local only). Idempotent: every target table is
// fully cleared (reverse-FK order) then re-inserted (FK order).
// ============================================================
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

config({ path: '.env.local' })

// --dry: reshape the workbook and print counts only — no DB connection.
const DRY = process.argv.includes('--dry')

const URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DRY && (!URL || !SERVICE_KEY || SERVICE_KEY.startsWith('PASTE_'))) {
  console.error(
    '✗ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n' +
      '  Get the service_role secret from Supabase → Project Settings → API.',
  )
  process.exit(1)
}

// Pick the first .xlsx in ./data_import (filename-agnostic).
const IMPORT_DIR = resolve('./data_import')
function findWorkbook(): string {
  if (!existsSync(IMPORT_DIR)) {
    console.error(`✗ data_import folder not found: ${IMPORT_DIR}`)
    process.exit(1)
  }
  const xlsx = readdirSync(IMPORT_DIR).filter(
    (f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'),
  )
  if (!xlsx.length) {
    console.error(`✗ No .xlsx file found in ${IMPORT_DIR}`)
    process.exit(1)
  }
  return join(IMPORT_DIR, xlsx[0])
}

const supabase = DRY
  ? (null as unknown as ReturnType<typeof createClient>)
  : createClient(URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

// ---------------- helpers ----------------
const txt = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
const slug = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
// normalize a label to alnum-only lowercase for SKU matching
const alnum = (v: unknown): string =>
  String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/[$,%\s]/g, ''))
  return Number.isFinite(n) ? n : null
}
const int = (v: unknown): number | null => {
  const n = num(v)
  return n == null ? null : Math.round(n)
}
function dateStr(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim() || null
}

// ---------------- canonical SKU registry ----------------
interface Canon {
  code: string
  flavor: string
  mg: string
  pack: string
  aliases: string[] // alnum substrings found in any sheet's column/desc
}
// Variety packs are matched separately (by "variety" + 222/85), so they carry
// no flavor aliases here.
const CANON_SKUS: Canon[] = [
  { code: 'pineapple_mango', flavor: 'Pineapple Mango', mg: '222mg', pack: '12pk', aliases: ['pineapplemango'] },
  { code: 'blue_raspberry', flavor: 'Blue Raspberry', mg: '222mg', pack: '12pk', aliases: ['blueraspberry'] },
  { code: 'strawberry_watermelon', flavor: 'Strawberry Watermelon', mg: '222mg', pack: '12pk', aliases: ['strawberrywatermelon'] },
  { code: 'pink_lemonade', flavor: 'Pink Lemonade', mg: '222mg', pack: '12pk', aliases: ['pinklemonade'] },
  { code: 'cherry_lime', flavor: 'Cherry Lime', mg: '222mg', pack: '12pk', aliases: ['cherrylime'] },
  { code: 'dragon_fruit_lemonade', flavor: 'Dragon Fruit Lemonade', mg: '85mg', pack: '12pk', aliases: ['dragonfruitlemonade', 'dragionfruitlemonade', 'dragonfruit', 'dragionfruit'] },
  { code: 'blackberry_lemonade', flavor: 'Blackberry Lemonade', mg: '85mg', pack: '12pk', aliases: ['blackberrylemonade', 'blackberrylemonde'] },
  { code: 'passion_fruit_guava', flavor: 'Passion Fruit Guava', mg: '85mg', pack: '12pk', aliases: ['passionfruitorangeguava', 'passionfruitguava'] },
  { code: 'tropical_breeze', flavor: 'Tropical Breeze', mg: '85mg', pack: '12pk', aliases: ['tropicalbreeze', 'tropical'] },
  { code: 'classic_cola', flavor: 'Classic Cola', mg: '85mg', pack: '12pk', aliases: ['classiccola', 'cola'] },
  { code: 'mandarin_orange', flavor: 'Mandarin Orange', mg: '85mg', pack: '12pk', aliases: ['mandarinorange'] },
  { code: 'variety_222', flavor: '222 Variety Pack', mg: '222mg', pack: '12pk', aliases: [] },
  { code: 'variety_85', flavor: '85 Variety Pack', mg: '85mg', pack: '12pk', aliases: [] },
]
const CANON_BY_CODE = new Map(CANON_SKUS.map((c) => [c.code, c]))

/** Resolve any flavor label (column header or product description) → sku_code. */
function resolveSku(label: string): string | null {
  const n = alnum(label)
  if (!n) return null
  if (n.includes('variety')) {
    if (n.includes('222')) return 'variety_222'
    if (n.includes('85')) return 'variety_85'
    return null // e.g. Revive Variety — not tracked in the auth matrices
  }
  // longest-matching alias wins (so "classiccola" beats "cola")
  let best: { code: string; len: number } | null = null
  for (const c of CANON_SKUS) {
    for (const a of c.aliases) {
      if (a && n.includes(a) && (!best || a.length > best.len)) {
        best = { code: c.code, len: a.length }
      }
    }
  }
  return best?.code ?? null
}

// ---------------- value mappers ----------------
function mapDcAuth(v: unknown): string | null {
  const s = txt(v)
  if (!s) return null
  return /not\s*auth/i.test(s) ? 'Not Authorized' : 'Authorized'
}
function mapChainAuth(v: unknown): string | null {
  const s = txt(v)
  if (!s) return null
  const n = s.toLowerCase()
  // present / placed / authorized → Authorized; everything else → Not Authorized
  if (n === 'authorized' || n === 'planogram' || n === 'x') return 'Authorized'
  return 'Not Authorized'
}
function mapMeeting(v: unknown): string | null {
  const s = txt(v)
  if (!s) return null
  const n = s.toLowerCase()
  if (n.includes('execut')) return 'Executed'
  if (n.includes('declin')) return 'Declined'
  if (n.includes('not') && n.includes('sched')) return 'Not Scheduled'
  if (n.includes('sched')) return 'Scheduled'
  if (n.includes('not') && n.includes('contact')) return 'Not Contacted'
  return null // unknown / freeform → leave blank, editable in-app
}
function mapCalType(label: string): string {
  const n = label.toLowerCase()
  if (n.includes('trade show')) return 'Trade Show'
  if (n.includes('kehe')) return 'KeHE Roadmap'
  if (n.includes('unfi')) return 'UNFI Roadmap'
  return 'Distributor Promo'
}

// row helper: 2-D array sheet read
type Grid = unknown[][]
function grid(wb: XLSX.WorkBook, sheet: string): Grid {
  const ws = wb.Sheets[sheet]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  })
}
function headerIndex(header: unknown[], label: string): number {
  const want = alnum(label)
  return header.findIndex((h) => alnum(h) === want)
}

// ============================================================
//  Reshapers — each returns the rows for one or more tables.
// ============================================================

function buildSkus(wb: XLSX.WorkBook) {
  // Enrich canonical SKUs from Sku Specs (prefer the 12-unit base row).
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets['Sku Specs'],
    { defval: null },
  )
  const enrich = new Map<string, Record<string, unknown>>()
  for (const r of rows) {
    const desc = txt(r['PRODUCT DESCRIPTION'])
    if (!desc) continue
    const code = resolveSku(desc)
    if (!code) continue
    const isBase = num(r['SIZE']) === 12 // 12-pack base row preferred
    if (!enrich.has(code) || isBase) {
      enrich.set(code, {
        retail_upc: txt(r['RETAIL UPC (GTIN)']) === 'NA' ? null : txt(r['RETAIL UPC (GTIN)']),
        srp: num(r['SRP']),
        dist_case_cost: num(r['DISTRIBUTOR PRICE PER CASE']),
      })
    }
  }
  return CANON_SKUS.map((c) => {
    const e = enrich.get(c.code) ?? {}
    return {
      sku_code: c.code,
      flavor: c.flavor,
      mg: c.mg,
      pack: c.pack,
      retail_upc: (e.retail_upc as string | null) ?? null,
      srp: (e.srp as number | null) ?? null,
      dist_case_cost: (e.dist_case_cost as number | null) ?? null,
    }
  })
}

function buildDistribution(wb: XLSX.WorkBook) {
  const g = grid(wb, 'Distribution')
  const header = g[0] ?? []
  const data = g.slice(1)

  // Locate the SKU matrix: columns whose header carries a flavor we recognize.
  // Each SKU column may be followed by a "MOQ …" column.
  const cols = header.map((h) => String(h ?? ''))
  const skuCols: { idx: number; code: string; moqIdx: number | null }[] = []
  for (let i = 0; i < cols.length; i++) {
    const h = cols[i]
    if (/^\s*moq/i.test(h)) continue
    const code = resolveSku(h)
    if (!code) continue
    const next = cols[i + 1] ?? ''
    skuCols.push({ idx: i, code, moqIdx: /^\s*moq/i.test(next) ? i + 1 : null })
  }

  const ix = {
    territory: headerIndex(header, 'Odyssey Territory'),
    type: headerIndex(header, 'Distributor Type'),
    contact: headerIndex(header, 'Odyssey Contact'),
    distributor: headerIndex(header, 'Distributor'),
    dcCode: headerIndex(header, 'DC Code'),
    gocrisp: headerIndex(header, 'GoCrisp Name'),
    city: headerIndex(header, 'City'),
    state: headerIndex(header, 'State'),
    zip: headerIndex(header, 'Zip'),
    buyer: headerIndex(header, 'Buyer'),
    dpCost: headerIndex(header, 'DP Case Cost'),
    dpMargin: headerIndex(header, 'DP Margin'),
    didBuys: 14, // "L52W Did Buys (Sep 2025)" — multiline header, fixed position
    volume: 15, // "L52W Volume (Sept 2025)"
    newKehe: headerIndex(header, 'New@Kehe'),
    anchor: headerIndex(header, 'Anchor Accounts / Notes'),
  }

  const dcs: Record<string, unknown>[] = []
  const dcAuth: Record<string, unknown>[] = []
  const anchors: Record<string, unknown>[] = []
  const seen = new Set<string>()

  data.forEach((row, n) => {
    const distributor = txt(row[ix.distributor])
    if (!distributor) return
    // Synthesize a UNIQUE dc_code per warehouse row (sheet's DC Code repeats).
    const base =
      slug([txt(row[ix.dcCode]), txt(row[ix.city]), txt(row[ix.state])].filter(Boolean).join('_')) ||
      slug(distributor)
    let code = base || `dc_${n}`
    while (seen.has(code)) code = `${base}_${n}`
    seen.add(code)

    dcs.push({
      dc_code: code,
      dc_name: distributor,
      territory: txt(row[ix.territory]),
      type: txt(row[ix.type]),
      odyssey_contact: txt(row[ix.contact]),
      gocrisp_name: txt(row[ix.gocrisp]),
      city: txt(row[ix.city]),
      state: txt(row[ix.state]),
      zip: txt(row[ix.zip]),
      buyer: txt(row[ix.buyer]),
      dp_case_cost: num(row[ix.dpCost]),
      dp_margin: num(row[ix.dpMargin]),
      l52w_did_buys: int(row[ix.didBuys]),
      l52w_volume: int(row[ix.volume]),
      new_at_kehe: txt(row[ix.newKehe]),
    })

    // SKU auth (dedupe per dc_code+sku_code; e.g. OLD/NEW variety collapse).
    const byCode = new Map<string, { status: string; moq: number | null }>()
    for (const sc of skuCols) {
      const status = mapDcAuth(row[sc.idx])
      if (!status) continue
      const moq = sc.moqIdx != null ? int(row[sc.moqIdx]) : null
      const prev = byCode.get(sc.code)
      if (!prev) byCode.set(sc.code, { status, moq })
      else {
        if (status === 'Authorized') prev.status = 'Authorized'
        if (prev.moq == null) prev.moq = moq
      }
    }
    for (const [skuCode, v] of byCode) {
      dcAuth.push({ dc_code: code, sku_code: skuCode, auth_status: v.status, moq: v.moq })
    }

    // Anchor accounts → bridge rows (split freeform list).
    const anchorText = ix.anchor >= 0 ? txt(row[ix.anchor]) : null
    if (anchorText) {
      for (const name of anchorText.split(/[,;\n/]+/).map((s) => s.trim()).filter(Boolean)) {
        anchors.push({
          dc_code: code,
          anchor_chain_name: name,
          anchor_chain_id: null as string | null, // resolved against dim_chain later
        })
      }
    }
  })

  return { dcs, dcAuth, anchors }
}

function buildAccounts(wb: XLSX.WorkBook) {
  const g = grid(wb, 'Account Management')
  const header = g[2] ?? [] // real field headers live on the 3rd row
  const data = g.slice(3)

  const ix = {
    chain: headerIndex(header, 'Chain'),
    active: headerIndex(header, 'Active/Not Active'),
    region: headerIndex(header, 'Region'),
    state: headerIndex(header, 'State'),
    universe: headerIndex(header, 'Total Universe'),
    am: headerIndex(header, 'Account Manager'),
    channel: headerIndex(header, 'Channel'),
    infra: headerIndex(header, 'INFRA/NCG Chain'),
    greenspoon: headerIndex(header, 'Green Spoon Manager'),
    distributor: headerIndex(header, 'Distributor'),
    transitional: headerIndex(header, 'Transitional To DSD? (Y/N)'),
    srp: headerIndex(header, 'Current SRP'),
    edlp: headerIndex(header, 'EDLP'),
    caseCost: headerIndex(header, 'Case Cost'),
    period: 9, // "2026 Category Review Period"
    meeting: 10, // "Meeting Progress …"
    dateSched: 11, // "Date Scheduled"
    ody25: 15, // "Is Odyssey … 2025 …"
    ody26: 16, // "Is Odyssey … 2026 …"
  }

  // SKU columns: everything from "Case Cost"+1 onward that resolves to a SKU.
  const firstSkuCol = (ix.caseCost >= 0 ? ix.caseCost : 20) + 1
  const skuCols: { idx: number; code: string }[] = []
  for (let i = firstSkuCol; i < header.length; i++) {
    const code = resolveSku(String(header[i] ?? ''))
    if (code) skuCols.push({ idx: i, code })
  }

  const chains: Record<string, unknown>[] = []
  const reviews: Record<string, unknown>[] = []
  const chainAuth: Record<string, unknown>[] = []
  const ids = new Set<string>()

  for (const row of data) {
    const name = txt(row[ix.chain])
    if (!name) continue
    let id = slug(name)
    if (!id) continue
    while (ids.has(id)) id = `${id}_x`
    ids.add(id)

    chains.push({
      chain_id: id,
      chain_name: name,
      active: txt(row[ix.active]),
      region: txt(row[ix.region]),
      state: txt(row[ix.state]),
      total_universe: int(row[ix.universe]),
      account_manager: txt(row[ix.am]),
      channel: txt(row[ix.channel]),
      infra_ncg: txt(row[ix.infra]),
      green_spoon_manager: txt(row[ix.greenspoon]),
      distributor: txt(row[ix.distributor]),
      transitional_to_dsd: ix.transitional >= 0 ? txt(row[ix.transitional]) : null,
      current_srp: num(row[ix.srp]),
      edlp: txt(row[ix.edlp]),
      case_cost: num(row[ix.caseCost]),
    })

    reviews.push({
      chain_id: id,
      review_period_2026: txt(row[ix.period]),
      meeting_progress: mapMeeting(row[ix.meeting]),
      date_scheduled: dateStr(row[ix.dateSched]),
      odyssey_in_2025: txt(row[ix.ody25]),
      odyssey_in_2026: txt(row[ix.ody26]),
      comments: null,
    })

    // SKU auth (dedupe per chain+sku; 12pk + 4pk collapse to the flavor).
    const byCode = new Map<string, string>()
    for (const sc of skuCols) {
      const status = mapChainAuth(row[sc.idx])
      if (!status) continue
      const prev = byCode.get(sc.code)
      if (prev !== 'Authorized') byCode.set(sc.code, status)
    }
    for (const [skuCode, status] of byCode) {
      chainAuth.push({ chain_id: id, sku_code: skuCode, auth_status: status })
    }
  }

  return { chains, reviews, chainAuth }
}

function buildCalendar(wb: XLSX.WorkBook) {
  const g = grid(wb, 'Calendar')
  // row0 = title, row1 = month names (cols 1..12 = Jan..Dec), row2+ = data.
  const out: Record<string, unknown>[] = []
  for (let r = 2; r < g.length; r++) {
    const row = g[r]
    const label = txt(row?.[0])
    if (!label) continue
    for (let m = 1; m <= 12; m++) {
      const detail = txt(row?.[m])
      if (!detail) continue
      out.push({
        event_type: mapCalType(label),
        entity: label,
        month: m,
        year: 2026,
        title: detail.split(/[\r\n]+/)[0]?.slice(0, 120) ?? null,
        detail,
      })
    }
  }
  return out
}

// ============================================================
//  Load orchestration
// ============================================================
async function clearAll(table: string, pkCol: string) {
  const { error } = await supabase.from(table as never).delete().not(pkCol, 'is', null)
  if (error) throw new Error(`clear ${table}: ${error.message}`)
}
async function insertAll(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase.from(table as never).insert(chunk as never)
    if (error) throw new Error(`insert ${table}: ${error.message}`)
  }
  console.log(`✓ ${table.padEnd(22)} ${String(rows.length).padStart(4)} rows`)
}

async function main() {
  const path = findWorkbook()
  console.log(`Reading ${path}`)
  const wb = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true })
  console.log(`Sheets: ${wb.SheetNames.join(', ')}\n`)

  const skus = buildSkus(wb)
  const { dcs, dcAuth, anchors } = buildDistribution(wb)
  const { chains, reviews, chainAuth } = buildAccounts(wb)
  const calendar = buildCalendar(wb)

  // Resolve anchor names → chain_id where a chain matches.
  const chainIds = new Set(chains.map((c) => c.chain_id as string))
  for (const a of anchors) {
    const id = slug(a.anchor_chain_name)
    if (chainIds.has(id)) a.anchor_chain_id = id
  }

  // Drop auth rows whose FK targets weren't produced (keeps inserts clean).
  const skuSet = new Set(skus.map((s) => s.sku_code as string))
  const dcSet = new Set(dcs.map((d) => d.dc_code as string))
  const dcAuthClean = dcAuth.filter((r) => dcSet.has(r.dc_code as string) && skuSet.has(r.sku_code as string))
  const chainAuthClean = chainAuth.filter((r) => chainIds.has(r.chain_id as string) && skuSet.has(r.sku_code as string))

  if (DRY) {
    const anchorsResolved = anchors.filter((a) => a.anchor_chain_id != null).length
    const reviewsWithProgress = reviews.filter((r) => r.meeting_progress != null).length
    console.log('DRY RUN — reshape preview (no DB writes):\n')
    console.log(`  dim_sku                ${skus.length}`)
    console.log(`  dim_dc                 ${dcs.length}`)
    console.log(`  dim_chain              ${chains.length}`)
    console.log(`  fact_dc_sku_auth       ${dcAuthClean.length}  (dropped ${dcAuth.length - dcAuthClean.length} unmatched)`)
    console.log(`  fact_chain_sku_auth    ${chainAuthClean.length}  (dropped ${chainAuth.length - chainAuthClean.length} unmatched)`)
    console.log(`  fact_category_review   ${reviews.length}  (${reviewsWithProgress} with a meeting_progress)`)
    console.log(`  bridge_dc_anchor       ${anchors.length}  (${anchorsResolved} resolved to a chain_id)`)
    console.log(`  fact_calendar          ${calendar.length}`)
    const calTypes = new Set(calendar.map((c) => c.event_type))
    const dcAuthNot = dcAuthClean.filter((r) => r.auth_status === 'Not Authorized').length
    console.log(`\n  calendar event types:  ${[...calTypes].join(', ')}`)
    console.log(`  dc_sku_auth: ${dcAuthNot} Not Authorized / ${dcAuthClean.length} tracked`)
    console.log('\nDone (dry).')
    return
  }

  console.log('Clearing existing rows (reverse-FK order)…')
  await clearAll('fact_calendar', 'id')
  await clearAll('bridge_dc_anchor', 'dc_code')
  await clearAll('fact_category_review', 'chain_id')
  await clearAll('fact_chain_sku_auth', 'chain_id')
  await clearAll('fact_dc_sku_auth', 'dc_code')
  await clearAll('dim_chain', 'chain_id')
  await clearAll('dim_dc', 'dc_code')
  await clearAll('dim_sku', 'sku_code')

  console.log('\nInserting (FK order)…')
  await insertAll('dim_sku', skus)
  await insertAll('dim_dc', dcs)
  await insertAll('dim_chain', chains)
  await insertAll('fact_dc_sku_auth', dcAuthClean)
  await insertAll('fact_chain_sku_auth', chainAuthClean)
  await insertAll('fact_category_review', reviews)
  await insertAll('bridge_dc_anchor', anchors)
  await insertAll('fact_calendar', calendar)

  console.log('\nDone.')
}

main().catch((e) => {
  console.error('\n✗', e instanceof Error ? e.message : e)
  process.exit(1)
})
