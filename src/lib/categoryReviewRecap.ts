// ============================================================
// Parser + aggregations for the "paste raw data" Category Review
// Recap tool. Pure functions — no React, no Supabase. Input is a
// tab-separated block (e.g. pasted straight out of Excel/Sheets),
// with quoted fields for cells containing tabs/newlines.
// ============================================================

export interface ChainRecord {
  chain: string
  activeStatus: 'Active' | 'Not Active' | 'Unknown'
  region: string
  state: string
  totalUniverse: number | null
  accountManager: string
  channel: string
  infraNcg: string
  broker: string
  brokerName: string
  reviewPeriod: string
  reviewStatus: string // normalized bucket
  reviewStatusRaw: string
  dateScheduled: string
  distributor: string
  distributorWarehouse: string
  transitionalToDsd: string
  anchoredAccounts: string
  notes: string
  energySet2025: string
  energySet2026: string
  skuAuth: Record<string, string> // column label -> raw status
}

export interface ParsedCategoryReviewData {
  chains: ChainRecord[]
  skuColumns: string[]
}

// ---------- low-level tab-separated parsing (quote-aware, lenient) ----------
function parseDelimited(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const n = text.length
  let i = 0
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"' && field === '') {
      inQuotes = true
      i++
      continue
    }
    if (c === '\t') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

function findCol(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map(norm)
  for (const cand of candidates) {
    const target = norm(cand)
    const exact = normalized.findIndex((h) => h === target)
    if (exact >= 0) return exact
  }
  for (const cand of candidates) {
    const target = norm(cand)
    const partial = normalized.findIndex((h) => h.includes(target))
    if (partial >= 0) return partial
  }
  return -1
}

function parseUniverse(raw: string): number | null {
  const s = raw.trim()
  if (!s || /^[x?]$/i.test(s)) return null
  const cleaned = s.replace(/,/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const STATUS_ALIASES: [RegExp, string][] = [
  [/^complete/, 'Complete'],
  [/^declined/, 'Declined'],
  [/^not\s*scheduled/, 'Not Scheduled'],
  [/^scheduled/, 'Scheduled'],
  [/^open/, 'Open Review'],
]

function normalizeStatus(raw: string): string {
  const s = norm(raw)
  if (!s) return 'Not Started'
  for (const [re, label] of STATUS_ALIASES) {
    if (re.test(s)) return label
  }
  return raw.trim().replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase())
}

function normalizeDistributor(raw: string): string {
  const s = raw.trim()
  if (!s) return 'Unknown'
  if (/^kehe$/i.test(s)) return 'KeHE'
  if (/^unfi$/i.test(s)) return 'UNFI'
  return s
}

function normalizeSkuLabel(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim().replace(/\.+$/, '')
  const fixes: [RegExp, string][] = [
    [/^Dragion Fruit Lemonade$/i, 'Dragon Fruit Lemonade'],
    [/^Blackberry Lemonde$/i, 'Blackberry Lemonade'],
    [/^Tropical$/i, 'Tropical Breeze'],
  ]
  for (const [re, fix] of fixes) {
    if (re.test(s)) return fix
  }
  return s
}

export function parseCategoryReviewData(raw: string): ParsedCategoryReviewData {
  const rows = parseDelimited(raw)
  if (rows.length < 2) return { chains: [], skuColumns: [] }

  const headers = rows[0]
  const idx = {
    chain: findCol(headers, 'Chain'),
    active: findCol(headers, 'Active/Not Active', 'Active'),
    region: findCol(headers, 'Region'),
    state: findCol(headers, 'State'),
    universe: findCol(headers, 'Total Universe'),
    am: findCol(headers, 'Account Manager'),
    channel: findCol(headers, 'Channel'),
    infra: findCol(headers, 'INFRA/NCG Chain', 'INFRA'),
    broker: findCol(headers, 'Broker'),
    brokerName: findCol(headers, 'Broker Name'),
    reviewPeriod: findCol(headers, 'Category Review Period'),
    reviewStatus: findCol(headers, 'Category Review Status'),
    dateScheduled: findCol(headers, 'Date Scheduled'),
    distributor: findCol(headers, 'Distributor'),
    distributorWarehouse: findCol(headers, 'Distributor Warehouse'),
    transitional: findCol(headers, 'Transitional To DSD'),
    anchored: findCol(headers, 'Anchored Accounts'),
    notes: findCol(headers, 'Notes'),
    energy2025: findCol(headers, '2025 Energy Set'),
    energy2026: findCol(headers, '2026 Energy Set'),
  }

  // Everything after the last "known" column is treated as a SKU
  // authorization column, in header order. Some real exports have two raw
  // header columns whose text normalizes to the same SKU name (e.g.
  // "Tropical" and "Tropical.") but that hold genuinely different,
  // sometimes-conflicting statuses per chain — not a formatting duplicate.
  // Rather than guess which column is authoritative and silently discard
  // the other, disambiguate collisions so every raw column stays distinct.
  const knownIdx = Object.values(idx).filter((i) => i >= 0)
  const lastKnown = Math.max(...knownIdx, -1)
  const skuStartIdx = lastKnown + 1
  const seenLabels = new Map<string, number>()
  const skuColumns = headers
    .slice(skuStartIdx)
    .map(normalizeSkuLabel)
    .filter(Boolean)
    .map((label) => {
      const count = seenLabels.get(label) ?? 0
      seenLabels.set(label, count + 1)
      return count === 0 ? label : `${label} (${count + 1})`
    })

  const get = (row: string[], i: number) => (i >= 0 && i < row.length ? (row[i] ?? '').trim() : '')

  const chains: ChainRecord[] = rows
    .slice(1)
    .map((row) => {
      const activeRaw = get(row, idx.active)
      const activeStatus: ChainRecord['activeStatus'] = /^active$/i.test(activeRaw)
        ? 'Active'
        : /^not active$/i.test(activeRaw)
          ? 'Not Active'
          : 'Unknown'

      const skuAuth: Record<string, string> = {}
      skuColumns.forEach((label, i) => {
        skuAuth[label] = get(row, skuStartIdx + i)
      })

      const reviewStatusRaw = get(row, idx.reviewStatus)

      return {
        chain: get(row, idx.chain),
        activeStatus,
        region: get(row, idx.region),
        state: get(row, idx.state),
        totalUniverse: parseUniverse(get(row, idx.universe)),
        accountManager: get(row, idx.am) || 'Unassigned',
        channel: get(row, idx.channel) || 'Unknown',
        infraNcg: get(row, idx.infra),
        broker: get(row, idx.broker),
        brokerName: get(row, idx.brokerName),
        reviewPeriod: get(row, idx.reviewPeriod),
        reviewStatus: normalizeStatus(reviewStatusRaw),
        reviewStatusRaw,
        dateScheduled: get(row, idx.dateScheduled),
        distributor: normalizeDistributor(get(row, idx.distributor)),
        distributorWarehouse: get(row, idx.distributorWarehouse),
        transitionalToDsd: get(row, idx.transitional),
        anchoredAccounts: get(row, idx.anchored),
        notes: get(row, idx.notes),
        energySet2025: get(row, idx.energy2025),
        energySet2026: get(row, idx.energy2026),
        skuAuth,
      }
    })
    .filter((c) => c.chain)

  return { chains, skuColumns }
}

// ---------------- Aggregations ----------------
export interface StatusCount {
  status: string
  count: number
}

export interface GroupBreakdown {
  name: string
  total: number
  active: number
  scheduled: number
  complete: number
  notScheduled: number
}

export interface SkuStat {
  label: string
  authorized: number
  notAuthorized: number
  declined: number
  pending: number
  rate: number // authorized ÷ (authorized+notAuthorized+declined)
}

export interface CategoryReviewSummary {
  totalChains: number
  activeChains: number
  notActiveChains: number
  totalUniverseSum: number
  activeUniverseSum: number
  statusCounts: StatusCount[]
  byAccountManager: GroupBreakdown[]
  byChannel: GroupBreakdown[]
  byDistributor: GroupBreakdown[]
  needsAttention: ChainRecord[]
  upcoming: ChainRecord[]
  skuStats: SkuStat[]
  overallAuthRate: number
}

export function summarizeCategoryReviews(chains: ChainRecord[]): CategoryReviewSummary {
  const totalChains = chains.length
  const activeChains = chains.filter((c) => c.activeStatus === 'Active').length
  const notActiveChains = chains.filter((c) => c.activeStatus === 'Not Active').length
  const totalUniverseSum = chains.reduce((s, c) => s + (c.totalUniverse || 0), 0)
  const activeUniverseSum = chains
    .filter((c) => c.activeStatus === 'Active')
    .reduce((s, c) => s + (c.totalUniverse || 0), 0)

  const statusMap = new Map<string, number>()
  chains.forEach((c) => statusMap.set(c.reviewStatus, (statusMap.get(c.reviewStatus) || 0) + 1))
  const statusCounts = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  const groupBy = (keyFn: (c: ChainRecord) => string): GroupBreakdown[] => {
    const map = new Map<string, GroupBreakdown>()
    chains.forEach((c) => {
      const name = keyFn(c) || 'Unknown'
      const g = map.get(name) || { name, total: 0, active: 0, scheduled: 0, complete: 0, notScheduled: 0 }
      g.total++
      if (c.activeStatus === 'Active') g.active++
      if (c.reviewStatus === 'Scheduled') g.scheduled++
      if (c.reviewStatus === 'Complete') g.complete++
      if (c.reviewStatus === 'Not Scheduled') g.notScheduled++
      map.set(name, g)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const byAccountManager = groupBy((c) => c.accountManager)
  const byChannel = groupBy((c) => c.channel)
  const byDistributor = groupBy((c) => c.distributor)

  const needsAttention = chains
    .filter(
      (c) =>
        c.activeStatus === 'Active' &&
        (c.reviewStatus === 'Not Scheduled' || c.reviewStatus === 'Not Started' || c.reviewStatus === 'Open Review'),
    )
    .sort((a, b) => (b.totalUniverse || 0) - (a.totalUniverse || 0))
    .slice(0, 15)

  const upcoming = chains
    .filter((c) => c.reviewStatus === 'Scheduled')
    .sort((a, b) => (a.dateScheduled || '').localeCompare(b.dateScheduled || ''))

  const skuColumns = chains.length ? Object.keys(chains[0].skuAuth) : []
  const skuStats: SkuStat[] = skuColumns
    .map((label) => {
      let authorized = 0
      let notAuthorized = 0
      let declined = 0
      let pending = 0
      chains.forEach((c) => {
        const v = (c.skuAuth[label] || '').trim().toLowerCase()
        if (v === 'authorized') authorized++
        else if (v === 'declined') declined++
        else if (v === 'not authorized') notAuthorized++
        else if (v) pending++
      })
      const decided = authorized + notAuthorized + declined
      return { label, authorized, notAuthorized, declined, pending, rate: decided > 0 ? authorized / decided : 0 }
    })
    .sort((a, b) => b.authorized - a.authorized)

  const totalDecided = skuStats.reduce((s, x) => s + x.authorized + x.notAuthorized + x.declined, 0)
  const totalAuthorized = skuStats.reduce((s, x) => s + x.authorized, 0)
  const overallAuthRate = totalDecided > 0 ? totalAuthorized / totalDecided : 0

  return {
    totalChains,
    activeChains,
    notActiveChains,
    totalUniverseSum,
    activeUniverseSum,
    statusCounts,
    byAccountManager,
    byChannel,
    byDistributor,
    needsAttention,
    upcoming,
    skuStats,
    overallAuthRate,
  }
}
