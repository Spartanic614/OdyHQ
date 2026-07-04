// ============================================================
// Coverage comparison: retailer outlets vs. distributor county coverage.
// For each county where the retailer has outlets, is there DSD coverage?
//   served       — retailer outlets AND distributor coverage
//   gap          — retailer outlets but NO distributor coverage (opportunity)
//   coverageOnly — distributor coverage but no retailer outlets (map context)
// Pure functions; no React. Joins on county FIPS (resolved from county+state
// when the retailer file has no FIPS column).
// ============================================================
import { parsePaste } from './inventory'

export interface Table {
  headers: string[]
  rows: string[][]
}

export function parseTable(text: string): Table {
  const { headers, rows } = parsePaste(text)
  return { headers, rows }
}

export type Field = 'fips' | 'county' | 'state' | 'address' | 'outlets' | 'distributor'

export const FIELD_LABELS: Record<Field, string> = {
  fips: 'County FIPS',
  county: 'County',
  state: 'State',
  address: 'Street Address',
  outlets: 'Outlets (count)',
  distributor: 'Distributor',
}

const ALIASES: Record<Field, string[]> = {
  fips: ['fips', 'county_fips', 'fips_code', 'county_fips_code', 'geoid', 'geo_id', 'fips5'],
  county: ['county', 'county_name', 'official_name_county', 'county_text', 'parish', 'borough'],
  state: ['state', 'state_name', 'official_name_state', 'st', 'state_abbr', 'state_abbreviation', 'state_code', 'province'],
  address: [
    'address', 'street_address', 'full_address', 'store_address', 'location',
    'store_info', 'store', 'addr', 'site_address', 'mailing_address',
  ],
  outlets: ['outlets', 'stores', 'store_count', 'storecount', 'count', 'outlet_count', 'locations', 'doors', 'num_stores', 'number_of_stores', 'tdp', 'acv'],
  distributor: ['distributor', 'dsd', 'dsd_distributor', 'coverage', 'distributor_name', 'supplier', 'wholesaler'],
}

const norm = (s: unknown) =>
  (s ?? '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export type ColMap = Partial<Record<Field, number>>

export function detectColumns(t: Table): ColMap {
  const nh = t.headers.map(norm)
  const used = new Set<number>()
  const m: ColMap = {}
  for (const f of Object.keys(ALIASES) as Field[]) {
    for (const a of ALIASES[f]) {
      const i = nh.findIndex((h, idx) => h === a && !used.has(idx))
      if (i >= 0) { m[f] = i; used.add(i); break }
    }
    if (m[f] == null) {
      for (const a of ALIASES[f]) {
        const i = nh.findIndex((h, idx) => h.includes(a) && !used.has(idx))
        if (i >= 0) { m[f] = i; used.add(i); break }
      }
    }
  }
  return m
}

// ---- US state name <-> abbreviation (for joining mixed formats) ----
const STATE_PAIRS: [string, string][] = [
  ['alabama', 'al'], ['alaska', 'ak'], ['arizona', 'az'], ['arkansas', 'ar'],
  ['california', 'ca'], ['colorado', 'co'], ['connecticut', 'ct'], ['delaware', 'de'],
  ['district of columbia', 'dc'], ['florida', 'fl'], ['georgia', 'ga'], ['hawaii', 'hi'],
  ['idaho', 'id'], ['illinois', 'il'], ['indiana', 'in'], ['iowa', 'ia'],
  ['kansas', 'ks'], ['kentucky', 'ky'], ['louisiana', 'la'], ['maine', 'me'],
  ['maryland', 'md'], ['massachusetts', 'ma'], ['michigan', 'mi'], ['minnesota', 'mn'],
  ['mississippi', 'ms'], ['missouri', 'mo'], ['montana', 'mt'], ['nebraska', 'ne'],
  ['nevada', 'nv'], ['new hampshire', 'nh'], ['new jersey', 'nj'], ['new mexico', 'nm'],
  ['new york', 'ny'], ['north carolina', 'nc'], ['north dakota', 'nd'], ['ohio', 'oh'],
  ['oklahoma', 'ok'], ['oregon', 'or'], ['pennsylvania', 'pa'], ['rhode island', 'ri'],
  ['south carolina', 'sc'], ['south dakota', 'sd'], ['tennessee', 'tn'], ['texas', 'tx'],
  ['utah', 'ut'], ['vermont', 'vt'], ['virginia', 'va'], ['washington', 'wa'],
  ['west virginia', 'wv'], ['wisconsin', 'wi'], ['wyoming', 'wy'],
]
const NAME_TO_AB = new Map(STATE_PAIRS)
const AB_TO_NAME = new Map(STATE_PAIRS.map(([n, a]) => [a, n]))

// Canonical state key (full name) regardless of input being name or abbreviation.
function stateKey(s: string): string {
  const x = (s ?? '').trim().toLowerCase()
  if (NAME_TO_AB.has(x)) return x
  if (AB_TO_NAME.has(x)) return AB_TO_NAME.get(x)!
  return x
}
function countyKey(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\b(county|parish|borough|census area|city and borough|municipality)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}
const csKey = (county: string, state: string) => `${countyKey(county)}|${stateKey(state)}`
const fips5 = (s: string) => {
  const d = (s ?? '').replace(/[^0-9]/g, '')
  return d ? d.padStart(5, '0').slice(-5) : ''
}

const cell = (row: string[], m: ColMap, f: Field) => {
  const i = m[f]
  return i == null ? '' : (row[i] ?? '').toString().trim()
}

export type Status = 'served' | 'gap' | 'coverageOnly'

export interface CountyRow {
  fips: string
  county: string
  state: string
  outlets: number
  distributor?: string
}

export interface CompareResult {
  statusByFips: Map<string, Status>
  counts: {
    retailCounties: number
    servedCounties: number
    gapCounties: number
    coverageOnly: number
    outletsServed: number
    outletsGap: number
    unresolved: number // retailer rows that couldn't map to a county/FIPS
  }
  gaps: CountyRow[] // retailer present, no coverage — sorted by outlets desc
  served: CountyRow[]
}

export function compareCoverage(
  retailer: Table,
  retailMap: ColMap,
  distributor: Table,
  distMap: ColMap,
): CompareResult {
  // From the distributor DB (has FIPS + county + state for all counties):
  const cs2fips = new Map<string, string>()
  const meta = new Map<string, { county: string; state: string }>()
  const distByFips = new Map<string, string>()
  for (const r of distributor.rows) {
    const county = cell(r, distMap, 'county')
    const state = cell(r, distMap, 'state')
    const fips = fips5(cell(r, distMap, 'fips'))
    if (!fips) continue
    if (county || state) meta.set(fips, { county, state })
    if (county && state) cs2fips.set(csKey(county, state), fips)
    const d = cell(r, distMap, 'distributor')
    if (d) distByFips.set(fips, d)
  }

  // Retailer outlets → FIPS (direct, or resolved from county+state).
  const retailByFips = new Map<string, number>()
  let unresolved = 0
  for (const r of retailer.rows) {
    if (r.every((c) => (c ?? '').toString().trim() === '')) continue
    let fips = fips5(cell(r, retailMap, 'fips'))
    const county = cell(r, retailMap, 'county')
    const state = cell(r, retailMap, 'state')
    if (!fips && county && state) fips = cs2fips.get(csKey(county, state)) ?? ''
    if (!fips) { unresolved++; continue }
    const oc = cell(r, retailMap, 'outlets')
    const n = oc ? Number(oc.replace(/[^0-9.-]/g, '')) || 0 : 1
    retailByFips.set(fips, (retailByFips.get(fips) ?? 0) + (n || 1))
    if (!meta.has(fips) && (county || state)) meta.set(fips, { county, state })
  }

  const statusByFips = new Map<string, Status>()
  const gaps: CountyRow[] = []
  const served: CountyRow[] = []
  let outletsServed = 0
  let outletsGap = 0

  for (const [fips, outlets] of retailByFips) {
    const m = meta.get(fips) ?? { county: '', state: '' }
    if (distByFips.has(fips)) {
      statusByFips.set(fips, 'served')
      outletsServed += outlets
      served.push({ fips, ...m, outlets, distributor: distByFips.get(fips) })
    } else {
      statusByFips.set(fips, 'gap')
      outletsGap += outlets
      gaps.push({ fips, ...m, outlets })
    }
  }
  let coverageOnly = 0
  for (const fips of distByFips.keys()) {
    if (!retailByFips.has(fips)) {
      statusByFips.set(fips, 'coverageOnly')
      coverageOnly++
    }
  }

  gaps.sort((a, b) => b.outlets - a.outlets)
  served.sort((a, b) => b.outlets - a.outlets)

  return {
    statusByFips,
    counts: {
      retailCounties: retailByFips.size,
      servedCounties: served.length,
      gapCounties: gaps.length,
      coverageOnly,
      outletsServed,
      outletsGap,
      unresolved,
    },
    gaps,
    served,
  }
}
