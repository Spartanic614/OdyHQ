// ============================================================
// Address → county resolution for retailer data that only has a street
// address (no county/state columns). Two parts:
//   1. Parse a raw address string into street/city/state/zip.
//   2. Batch-resolve those parts to county FIPS via our serverless proxy
//      (api/geocode.ts), which forwards to the Census Bureau's free batch
//      geocoder — the Census API has no CORS headers, so it can't be called
//      directly from the browser.
// Results are cached in localStorage so re-pasting the same monthly store
// list doesn't re-geocode addresses we've already resolved.
// ============================================================

export interface AddressParts {
  street: string
  city: string
  state: string
  zip: string
}

// "12 - Stop & Shop | 155 Harvard St, Brookline, MA 02446-6433" -> strip the
// leading "N - Name |" store label, keep the mailing address after the pipe.
function stripStoreLabel(raw: string): string {
  const parts = raw.split('|')
  return parts.length >= 2 ? parts.slice(1).join('|').trim() : raw.trim()
}

// Parse "155 Harvard St, Brookline, MA 02446-6433" (or "...MA, 02446") into parts.
// Returns null when the string doesn't look like a full mailing address (no
// state/ZIP found) — those rows are left unresolved rather than guessed at.
export function parseAddressParts(raw: string): AddressParts | null {
  const addr = stripStoreLabel(raw)
  if (!addr) return null
  // Split on commas first; the last segment usually holds "ST ZIP" or "ST, ZIP".
  const segments = addr.split(',').map((s) => s.trim()).filter(Boolean)
  if (segments.length < 2) return null

  // State + ZIP live in the last segment (or last two, if state/zip were comma-split).
  let tail = segments[segments.length - 1]
  let cityIdx = segments.length - 2
  const stateZip = tail.match(/^([A-Za-z]{2})\.?\s+(\d{5})(?:-\d{4})?$/)
  let state = ''
  let zip = ''
  if (stateZip) {
    state = stateZip[1].toUpperCase()
    zip = stateZip[2]
  } else {
    // "...,  MA, 02446-6433" — state and zip landed in separate segments.
    const zipOnly = tail.match(/^(\d{5})(?:-\d{4})?$/)
    const stateOnly = segments[segments.length - 2]?.match(/^([A-Za-z]{2})\.?$/)
    if (zipOnly && stateOnly) {
      zip = zipOnly[1]
      state = stateOnly[1].toUpperCase()
      cityIdx = segments.length - 3
      tail = ''
    } else {
      return null
    }
  }
  if (!state || cityIdx < 0) return null

  const city = segments[cityIdx] ?? ''
  const street = segments.slice(0, cityIdx).join(', ')
  if (!street || !city) return null
  return { street, city, state, zip }
}

export interface GeocodeMatch {
  matched: boolean
  matchType: string
  stateFips: string
  countyFips: string
  fips: string // 5-digit state+county GEOID
}

interface CacheEntry extends GeocodeMatch {
  ts: number
}

const CACHE_KEY = 'geocode_cache_v1'

function loadCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {}
  } catch {
    return {}
  }
}
function saveCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore quota errors */
  }
}
const cacheKey = (p: AddressParts) =>
  `${p.street}|${p.city}|${p.state}|${p.zip}`.toLowerCase().replace(/\s+/g, ' ').trim()

const CHUNK_SIZE = 150 // keeps each serverless invocation comfortably within its time limit

export interface GeocodeProgress {
  done: number
  total: number
}

/**
 * Resolve a set of {id, address} rows to county FIPS. Returns a Map keyed by
 * the same id. Previously-matched addresses are served from cache; only new
 * or previously-unmatched ones hit the network.
 */
export async function geocodeAddresses(
  rows: { id: string; address: string }[],
  onProgress?: (p: GeocodeProgress) => void,
): Promise<Map<string, GeocodeMatch | null>> {
  const cache = loadCache()
  const out = new Map<string, GeocodeMatch | null>()
  const toFetch: { id: string; parts: AddressParts; key: string }[] = []

  for (const r of rows) {
    const parts = parseAddressParts(r.address)
    if (!parts) {
      out.set(r.id, null)
      continue
    }
    const key = cacheKey(parts)
    const hit = cache[key]
    if (hit?.matched) {
      out.set(r.id, hit)
    } else {
      toFetch.push({ id: r.id, parts, key })
    }
  }

  const total = toFetch.length
  let done = 0
  onProgress?.({ done, total })
  if (!total) return out

  for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) {
    const chunk = toFetch.slice(i, i + CHUNK_SIZE)
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: chunk.map((c) => ({ id: c.id, ...c.parts })),
      }),
    })
    if (!res.ok) {
      // Leave this chunk unresolved rather than failing the whole batch.
      for (const c of chunk) out.set(c.id, null)
      done += chunk.length
      onProgress?.({ done, total })
      continue
    }
    const body = (await res.json()) as {
      results: { id: string; matched: boolean; matchType: string; stateFips: string; countyFips: string; fips: string }[]
    }
    const byId = new Map(body.results.map((r) => [r.id, r]))
    for (const c of chunk) {
      const r = byId.get(c.id)
      if (r) {
        out.set(c.id, r)
        if (r.matched) cache[c.key] = { ...r, ts: Date.now() }
      } else {
        out.set(c.id, null)
      }
    }
    done += chunk.length
    onProgress?.({ done, total })
  }

  saveCache(cache)
  return out
}
