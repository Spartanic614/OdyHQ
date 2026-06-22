// Export an array of plain objects to a downloaded CSV of the current view.

function escapeCell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns?: { key: string; label: string }[],
) {
  if (!rows.length) return
  const cols =
    columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))

  const header = cols.map((c) => escapeCell(c.label)).join(',')
  const body = rows
    .map((r) => cols.map((c) => escapeCell(r[c.key])).join(','))
    .join('\n')
  const csv = `${header}\n${body}`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
