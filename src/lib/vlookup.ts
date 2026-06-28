// ============================================================
// VLOOKUP / match tool — join two pasted datasets on a key column.
// Pure functions; no React, no network. Used by pages/Vlookup.tsx.
//
// Reuses the robust paste parser from the inventory lib.
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

// Match keys: uppercase + alphanumeric only, with a leading-zero-tolerant form
// so "000123" matches "123" (common across exports).
const strict = (s: unknown) => (s ?? '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
const loose = (s: unknown) => strict(s).replace(/^0+/, '')

const blankRow = (r: string[]) => r.every((c) => (c ?? '').toString().trim() === '')

/**
 * Suggest the best key pair by value overlap: the (col in A, col in B) whose
 * normalized values share the most rows. Also returns a description→column hint.
 */
export function suggestKeys(
  a: Table,
  b: Table,
  hint?: string,
): { aKey: number; bKey: number; overlap: number } {
  let best = { aKey: 0, bKey: 0, overlap: -1 }
  for (let i = 0; i < a.headers.length; i++) {
    const aset = new Set(a.rows.map((r) => loose(r[i])).filter(Boolean))
    if (!aset.size) continue
    for (let j = 0; j < b.headers.length; j++) {
      const seen = new Set<string>()
      let hit = 0
      for (const r of b.rows) {
        const k = loose(r[j])
        if (k && aset.has(k) && !seen.has(k)) {
          hit++
          seen.add(k)
        }
      }
      if (hit > best.overlap) best = { aKey: i, bKey: j, overlap: hit }
    }
  }
  // If the description names a header present in both, prefer that column.
  if (hint && hint.trim()) {
    const h = strict(hint)
    const findCol = (t: Table) =>
      t.headers.findIndex((hd) => hd && (h.includes(strict(hd)) || strict(hd).includes(h)) && strict(hd).length >= 3)
    const ai = findCol(a)
    const bi = findCol(b)
    if (ai >= 0 && bi >= 0) return { aKey: ai, bKey: bi, overlap: best.overlap }
  }
  return best
}

export type MatchStatus = 'Matched' | 'No match' | 'Multiple matches'

export interface VlookupRow {
  base: string[] // the dataset-1 row
  returned: (string | null)[] // pulled values from dataset 2 (first match)
  status: MatchStatus
  matchCount: number
}

export interface VlookupResult {
  baseHeaders: string[]
  returnHeaders: string[]
  rows: VlookupRow[]
  counts: { matched: number; noMatch: number; multiple: number }
}

/**
 * For each row in A, find matching row(s) in B by key and pull `returnCols`
 * (column indexes in B). First match wins; multiple matches are flagged.
 */
export function vlookup(
  a: Table,
  b: Table,
  aKey: number,
  bKey: number,
  returnCols: number[],
): VlookupResult {
  const index = new Map<string, string[][]>()
  for (const r of b.rows) {
    if (blankRow(r)) continue
    const k = loose(r[bKey])
    if (!k) continue
    const list = index.get(k) ?? []
    list.push(r)
    index.set(k, list)
  }

  const rows: VlookupRow[] = []
  let matched = 0
  let noMatch = 0
  let multiple = 0

  for (const r of a.rows) {
    if (blankRow(r)) continue
    const k = loose(r[aKey])
    const hits = k ? (index.get(k) ?? []) : []
    let status: MatchStatus
    let returned: (string | null)[]
    if (hits.length === 0) {
      status = 'No match'
      returned = returnCols.map(() => null)
      noMatch++
    } else {
      returned = returnCols.map((ci) => hits[0][ci] ?? null)
      if (hits.length > 1) {
        status = 'Multiple matches'
        multiple++
      } else {
        status = 'Matched'
        matched++
      }
    }
    rows.push({ base: r, returned, status, matchCount: hits.length })
  }

  return {
    baseHeaders: a.headers,
    returnHeaders: returnCols.map((ci) => b.headers[ci] || `Column ${ci + 1}`),
    rows,
    counts: { matched, noMatch, multiple },
  }
}
