// ============================================================
// Serverless proxy: address -> county FIPS, via the US Census Bureau's free
// batch geocoder (https://geocoding.geo.census.gov/geocoder/geographies/addressbatch).
//
// Why this exists: the Census API has no CORS headers, so it can't be called
// directly from the browser (confirmed — a direct fetch() from the client is
// blocked). This function calls it server-to-server, where CORS doesn't
// apply, and returns just the fields the app needs.
//
// No API key required; this is a public, free, no-signup Census service.
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node'

const BATCH_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/addressbatch'
const MAX_ROWS = 250 // keep each invocation well within serverless time limits

interface InRow {
  id: string
  street: string
  city: string
  state: string
  zip: string
}

interface OutRow {
  id: string
  matched: boolean
  matchType: string
  stateFips: string
  countyFips: string
  fips: string
}

// Quote-aware CSV line split (Census's batch response quotes every field, and
// the coordinate field contains an internal comma inside its quotes).
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        q = !q
      }
    } else if (ch === ',' && !q) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

const csvField = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' })
    return
  }

  const rows = (req.body?.rows ?? []) as InRow[]
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'Body must include a non-empty "rows" array' })
    return
  }
  if (rows.length > MAX_ROWS) {
    res.status(400).json({ error: `Max ${MAX_ROWS} rows per request; chunk on the client` })
    return
  }

  const csv = rows
    .map((r) => [r.id, csvField(r.street), csvField(r.city), csvField(r.state), csvField(r.zip)].join(','))
    .join('\n')

  const form = new FormData()
  form.append('addressFile', new Blob([csv], { type: 'text/csv' }), 'addresses.csv')
  form.append('benchmark', 'Public_AR_Current')
  form.append('vintage', 'Current_Current')

  let censusResp: Response
  try {
    censusResp = await fetch(BATCH_URL, { method: 'POST', body: form })
  } catch (e) {
    res.status(502).json({ error: `Census geocoder request failed: ${e instanceof Error ? e.message : String(e)}` })
    return
  }
  if (!censusResp.ok) {
    res.status(502).json({ error: `Census geocoder returned ${censusResp.status}` })
    return
  }

  const text = await censusResp.text()
  const byId = new Map<string, OutRow>()
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const f = splitCsvLine(line)
    // 0:id 1:input addr 2:match indicator 3:match type 4:matched addr
    // 5:coords 6:tigerLineId 7:side 8:state fips 9:county fips 10:tract 11:block
    const id = f[0] ?? ''
    const matched = f[2] === 'Match'
    const stateFips = matched ? (f[8] ?? '') : ''
    const countyFips = matched ? (f[9] ?? '') : ''
    byId.set(id, {
      id,
      matched: matched && !!stateFips && !!countyFips,
      matchType: f[3] ?? '',
      stateFips,
      countyFips,
      fips: matched && stateFips && countyFips ? `${stateFips}${countyFips}` : '',
    })
  }

  // Always return one result per requested row, even if Census dropped it.
  const results: OutRow[] = rows.map(
    (r) =>
      byId.get(r.id) ?? {
        id: r.id,
        matched: false,
        matchType: '',
        stateFips: '',
        countyFips: '',
        fips: '',
      },
  )

  res.status(200).json({ results })
}
