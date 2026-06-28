import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseQuery } from '../data/useSupabaseQuery'
import type { Tables } from '../lib/database.types'
import { DataTable, type Column } from '../components/DataTable'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { TableSkeleton, ErrorBanner, EmptyState } from '../components/States'
import { fmtInt, fmtPct } from '../lib/format'
import { theme } from '../theme'

type Row = Tables<'ref_dsd_coverage'>
const TABLE = 'ref_dsd_coverage'

type CoverageFilter = 'all' | 'covered' | 'whitespace'

export function DsdCoverage() {
  const { data, loading, error, refetch } = useSupabaseQuery<Row[]>(
    async () => {
      // Paginate past the 1000-row per-request cap (dataset is ~3.1k counties).
      const PAGE = 1000
      const all: Row[] = []
      for (let from = 0; ; from += PAGE) {
        const res = await supabase
          .from(TABLE)
          .select('*')
          .order('state', { ascending: true })
          .order('county', { ascending: true })
          .range(from, from + PAGE - 1)
        if (res.error) return { data: null, error: res.error }
        const batch = (res.data as Row[] | null) ?? []
        all.push(...batch)
        if (batch.length < PAGE) break
      }
      return { data: all, error: null }
    },
    [],
    TABLE,
  )

  const rows = useMemo(() => data ?? [], [data])

  const [state, setState] = useState('')
  const [distributor, setDistributor] = useState('')
  const [coverage, setCoverage] = useState<CoverageFilter>('all')

  const isCovered = (r: Row) => !!(r.distributor && r.distributor.trim())

  // KPIs over the full dataset.
  const kpis = useMemo(() => {
    const covered = rows.filter(isCovered)
    const dists = new Set(covered.map((r) => r.distributor as string))
    const states = new Set(rows.map((r) => r.state).filter(Boolean) as string[])
    return {
      total: rows.length,
      covered: covered.length,
      whitespace: rows.length - covered.length,
      distributors: dists.size,
      states: states.size,
      coveragePct: rows.length ? covered.length / rows.length : 0,
    }
  }, [rows])

  // Coverage rollup by state (covered vs total) — the whitespace view.
  const byState = useMemo(() => {
    const m = new Map<string, { total: number; covered: number }>()
    for (const r of rows) {
      const s = r.state ?? '—'
      const e = m.get(s) ?? { total: 0, covered: 0 }
      e.total++
      if (isCovered(r)) e.covered++
      m.set(s, e)
    }
    return [...m.entries()]
      .map(([s, v]) => ({ state: s, ...v, pct: v.total ? v.covered / v.total : 0 }))
      .sort((a, b) => b.covered - a.covered || b.total - a.total)
  }, [rows])

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => !state || r.state === state)
        .filter((r) => !distributor || r.distributor === distributor)
        .filter((r) =>
          coverage === 'all'
            ? true
            : coverage === 'covered'
              ? isCovered(r)
              : !isCovered(r),
        ),
    [rows, state, distributor, coverage],
  )

  const columns: Column<Row>[] = [
    { key: 'state', label: 'State', value: (r) => r.state },
    { key: 'county', label: 'County', value: (r) => r.county },
    { key: 'county_type', label: 'Type', value: (r) => r.county_type },
    {
      key: 'distributor',
      label: 'DSD Distributor',
      value: (r) => r.distributor ?? '',
      render: (r) =>
        isCovered(r) ? (
          <span style={{ color: theme.good }}>{r.distributor}</span>
        ) : (
          <span style={{ color: theme.bad }}>✗ Whitespace</span>
        ),
    },
    { key: 'fips', label: 'FIPS', value: (r) => r.fips },
  ]

  if (loading) return <TableSkeleton />
  if (error) return <ErrorBanner table={TABLE} message={error} onRetry={refetch} />
  if (!rows.length)
    return <EmptyState message="No DSD coverage data loaded yet — run the seed." />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">DSD Coverage &amp; Whitespace</h1>
        <p className="text-sm text-muted">
          County-level DSD coverage. &quot;Whitespace&quot; counties have no
          distributor assigned — open territory for expansion.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Kpi label="Counties covered" value={fmtInt(kpis.covered)} color={theme.good} />
        <Kpi label="Whitespace counties" value={fmtInt(kpis.whitespace)} color={theme.bad} />
        <Kpi label="Coverage" value={fmtPct(kpis.coveragePct)} />
        <Kpi label="DSD distributors" value={fmtInt(kpis.distributors)} />
        <Kpi label="States" value={fmtInt(kpis.states)} />
      </div>

      {/* Coverage by state */}
      <div className="card p-3 space-y-2">
        <div className="text-sm font-semibold">Coverage by state</div>
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-[40vh] overflow-auto pr-1">
          {byState.map((s) => (
            <button
              key={s.state}
              onClick={() => setState(s.state === state ? '' : s.state)}
              className={`flex items-center gap-2 text-left rounded px-1.5 py-0.5 hover:bg-white/5 ${
                state === s.state ? 'bg-white/10' : ''
              }`}
            >
              <span className="w-10 text-xs text-muted truncate">{s.state}</span>
              <span className="flex-1 h-2 rounded bg-white/5 overflow-hidden">
                <span
                  className="block h-full rounded"
                  style={{ width: `${s.pct * 100}%`, backgroundColor: theme.good }}
                />
              </span>
              <span className="text-[11px] tabular-nums text-muted w-20 text-right">
                {s.covered}/{s.total}
              </span>
            </button>
          ))}
        </div>
        <div className="text-[11px] text-muted">Click a state to filter the table below.</div>
      </div>

      {/* County table */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => String(r.id)}
        exportName="dsd_coverage"
        initialSort={{ key: 'state', dir: 'asc' }}
        searchPlaceholder="Search county, state, distributor…"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SelectFilter
              label="State"
              value={state}
              onChange={setState}
              options={uniqueValues(rows, (r) => r.state)}
            />
            <SelectFilter
              label="Distributor"
              value={distributor}
              onChange={setDistributor}
              options={uniqueValues(rows, (r) => r.distributor)}
            />
            <label className="text-xs text-muted flex items-center gap-1">
              Coverage
              <select
                className="input py-1"
                value={coverage}
                onChange={(e) => setCoverage(e.target.value as CoverageFilter)}
              >
                <option value="all">All</option>
                <option value="covered">Covered</option>
                <option value="whitespace">Whitespace</option>
              </select>
            </label>
          </div>
        }
      />
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card p-3">
      <div className="text-2xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
