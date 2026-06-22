import { useMemo, useState, type ReactNode } from 'react'
import { exportCsv } from '../lib/csv'
import { EmptyState } from './States'

export interface Column<T> {
  key: string
  label: string
  /** Cell renderer. Defaults to String(row[key]). */
  render?: (row: T) => ReactNode
  /** Value used for sorting + CSV export. Defaults to row[key]. */
  value?: (row: T) => string | number | null
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Exclude from CSV export. */
  noExport?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  searchable?: boolean
  searchPlaceholder?: string
  exportName?: string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  dense?: boolean
  /** Optional toolbar content (filters) rendered left of search. */
  toolbar?: ReactNode
  emptyMessage?: string
}

function defaultValue<T>(col: Column<T>, row: T): string | number | null {
  if (col.value) return col.value(row)
  const v = (row as Record<string, unknown>)[col.key]
  if (v == null) return null
  return typeof v === 'number' ? v : String(v)
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Search…',
  exportName,
  initialSort,
  dense = false,
  toolbar,
  emptyMessage = 'No rows match the current filters.',
}: Props<T>) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    initialSort ?? null,
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) =>
      columns.some((col) => {
        const v = defaultValue(col, row)
        return v != null && String(v).toLowerCase().includes(q)
      }),
    )
  }, [rows, search, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return filtered
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = defaultValue(col, a)
      const bv = defaultValue(col, b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [filtered, sort, columns])

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )

  const handleExport = () => {
    const cols = columns.filter((c) => !c.noExport)
    const data = sorted.map((row) => {
      const o: Record<string, unknown> = {}
      for (const c of cols) o[c.label] = defaultValue(c, row)
      return o
    })
    exportCsv(
      exportName ?? 'export',
      data,
      cols.map((c) => ({ key: c.label, label: c.label })),
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-ink-700">
        {toolbar}
        <div className="flex-1" />
        {searchable && (
          <input
            className="input w-56"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <button className="btn" onClick={handleExport} disabled={!sorted.length}>
          ⤓ CSV
        </button>
        <span className="text-xs text-muted px-1">{sorted.length} rows</span>
      </div>

      {sorted.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-ink-800 z-10">
              <tr>
                {columns.map((col) => {
                  const active = sort?.key === col.key
                  return (
                    <th
                      key={col.key}
                      className={`th cursor-pointer hover:text-text ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : ''
                      }`}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      {active && (
                        <span className="ml-1 text-accent">
                          {sort?.dir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={`hover:bg-ink-700/50 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`td ${dense ? 'py-1' : ''} ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : ''
                      } ${col.className ?? ''}`}
                    >
                      {col.render
                        ? col.render(row)
                        : (defaultValue(col, row) ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
