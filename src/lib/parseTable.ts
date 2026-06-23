// ============================================================
// Generic pasted-table parsing primitives (tab / CSV / multi-space),
// shared by the import-based tools. Pure functions.
// ============================================================

export const normHeader = (s: string) =>
  s.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t'
  if (line.includes(',')) return ','
  if (/\s{2,}/.test(line)) return 'MULTISPACE'
  return ','
}

function splitLine(line: string, delim: string): string[] {
  if (delim === 'MULTISPACE') return line.split(/\s{2,}/).map((c) => c.trim())
  if (delim === ',') {
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

export interface ParsedTable {
  headers: string[]
  rows: string[][]
}

export function parseTable(text: string): ParsedTable {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }
  const delim = detectDelimiter(lines[0])
  const headers = splitLine(lines[0], delim)
  const rows = lines.slice(1).map((l) => splitLine(l, delim))
  return { headers, rows }
}

// Map field keys → column index by matching header aliases (exact then contains).
export function detectColumns<K extends string>(
  headers: string[],
  aliases: Record<K, string[]>,
): Partial<Record<K, number>> {
  const normed = headers.map(normHeader)
  const detected: Partial<Record<K, number>> = {}
  const used = new Set<number>()
  for (const field of Object.keys(aliases) as K[]) {
    for (const a of aliases[field]) {
      const idx = normed.findIndex((h, i) => h === a && !used.has(i))
      if (idx >= 0) { detected[field] = idx; used.add(idx); break }
    }
    if (detected[field] == null) {
      for (const a of aliases[field]) {
        const idx = normed.findIndex((h, i) => h.includes(a) && !used.has(i))
        if (idx >= 0) { detected[field] = idx; used.add(idx); break }
      }
    }
  }
  return detected
}
