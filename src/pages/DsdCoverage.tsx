import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseQuery } from '../data/useSupabaseQuery'
import type { Tables } from '../lib/database.types'
import { DataTable, type Column } from '../components/DataTable'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { TableSkeleton, ErrorBanner, EmptyState } from '../components/States'
import { CoverageCompare, ColorPick } from '../components/CoverageCompare'
import { CoverageMap } from '../components/CoverageMap'
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

  const [tab, setTab] = useState<'coverage' | 'compare'>('coverage')
  const [state, setState] = useState('')
  const [distributor, setDistributor] = useState('')
  const [coverage, setCoverage] = useState<CoverageFilter>('all')
  const [coveredColor, setCoveredColor] = useState<string>(theme.good)
  const [whitespaceColor, setWhitespaceColor] = useState<string>('#39414f')

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

  // County fills + hover tooltips for the interactive coverage map. When a DSD
  // is selected, only that distributor's counties are highlighted (others dim).
  const mapFill = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) {
      if (!r.fips) continue
      const on = distributor ? r.distributor === distributor : isCovered(r)
      m.set(r.fips, on ? coveredColor : whitespaceColor)
    }
    return m
  }, [rows, coveredColor, whitespaceColor, distributor])

  const mapTooltip = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) {
      if (r.fips) m.set(r.fips, isCovered(r) ? (r.distributor as string) : 'No DSD — whitespace')
    }
    return m
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

  const loadedDsd = useMemo(
    () =>
      rows.map((r) => ({
        county: r.county,
        state: r.state,
        fips: r.fips,
        distributor: r.distributor,
      })),
    [rows],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">DSD Coverage &amp; Whitespace</h1>
          <p className="text-sm text-muted">
            County-level DSD coverage, plus a retailer-vs-distributor comparison map.
          </p>
        </div>
        <div className="flex gap-1">
          <button
            className={`btn text-sm ${tab === 'coverage' ? 'btn-accent' : ''}`}
            onClick={() => setTab('coverage')}
          >
            Coverage
          </button>
          <button
            className={`btn text-sm ${tab === 'compare' ? 'btn-accent' : ''}`}
            onClick={() => setTab('compare')}
          >
            Comparison Map
          </button>
        </div>
      </div>

      {tab === 'compare' ? (
        <>
          <div className="card p-4 space-y-3 bg-blue-950/20 border border-blue-500/20">
            <div className="text-sm font-semibold">Demo Data (Copy & Paste)</div>
            <p className="text-xs text-muted">
              Paste this sample retail chain data into the comparison map to see how Green Valley Mart (fictional) compares to your DSD coverage in California.
            </p>
            <div className="relative">
              <textarea
                readOnly
                value={`County	State	Outlets	Distributor
Alameda	CA	12	Green Valley Mart
Butte	CA	3	Green Valley Mart
Contra Costa	CA	8	Green Valley Mart
Fresno	CA	0
Kern	CA	5	Green Valley Mart
Kings	CA	0
Los Angeles	CA	18	Green Valley Mart
Madera	CA	0
Merced	CA	2	Green Valley Mart
Monterey	CA	4	Green Valley Mart
Orange	CA	14	Green Valley Mart
Riverside	CA	9	Green Valley Mart
Sacramento	CA	6	Green Valley Mart
San Bernardino	CA	11	Green Valley Mart
San Diego	CA	16	Green Valley Mart
San Francisco	CA	7	Green Valley Mart
San Joaquin	CA	3	Green Valley Mart
San Luis Obispo	CA	0
Santa Barbara	CA	2	Green Valley Mart
Santa Clara	CA	9	Green Valley Mart
Santa Cruz	CA	3	Green Valley Mart
Shasta	CA	0
Stanislaus	CA	4	Green Valley Mart
Tulare	CA	0
Ventura	CA	5	Green Valley Mart`}
                className="w-full h-64 p-3 text-xs font-mono bg-black/40 border border-white/10 rounded resize-none"
              />
              <button
                onClick={() => {
                  const text = `County	State	Outlets	Distributor
Alameda	CA	12	Green Valley Mart
Butte	CA	3	Green Valley Mart
Contra Costa	CA	8	Green Valley Mart
Fresno	CA	0
Kern	CA	5	Green Valley Mart
Kings	CA	0
Los Angeles	CA	18	Green Valley Mart
Madera	CA	0
Merced	CA	2	Green Valley Mart
Monterey	CA	4	Green Valley Mart
Orange	CA	14	Green Valley Mart
Riverside	CA	9	Green Valley Mart
Sacramento	CA	6	Green Valley Mart
San Bernardino	CA	11	Green Valley Mart
San Diego	CA	16	Green Valley Mart
San Francisco	CA	7	Green Valley Mart
San Joaquin	CA	3	Green Valley Mart
San Luis Obispo	CA	0
Santa Barbara	CA	2	Green Valley Mart
Santa Clara	CA	9	Green Valley Mart
Santa Cruz	CA	3	Green Valley Mart
Shasta	CA	0
Stanislaus	CA	4	Green Valley Mart
Tulare	CA	0
Ventura	CA	5	Green Valley Mart`
                  navigator.clipboard.writeText(text)
                }}
                className="absolute top-3 right-3 text-xs btn"
              >
                Copy
              </button>
            </div>
          </div>
          <CoverageCompare loadedDsd={loadedDsd} />
        </>
      ) : loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorBanner table={TABLE} message={error} onRetry={refetch} />
      ) : !rows.length ? (
        <EmptyState message="No DSD coverage data loaded yet — run the seed." />
      ) : (
        <>
          {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Kpi label="Counties covered" value={fmtInt(kpis.covered)} color={theme.good} />
        <Kpi label="Whitespace counties" value={fmtInt(kpis.whitespace)} color={theme.bad} />
        <Kpi label="Coverage" value={fmtPct(kpis.coveragePct)} />
        <Kpi label="DSD distributors" value={fmtInt(kpis.distributors)} />
        <Kpi label="States" value={fmtInt(kpis.states)} />
      </div>

      {/* Interactive coverage map */}
      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">
            DSD coverage map
            {distributor ? (
              <span className="text-muted font-normal">
                {' — '}
                {distributor}: {fmtInt(rows.filter((r) => r.distributor === distributor && r.fips).length)} counties
              </span>
            ) : (
              <span className="text-muted font-normal"> — pick a DSD to see its territory</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <SelectFilter
              label="Highlight DSD"
              value={distributor}
              onChange={setDistributor}
              options={uniqueValues(rows, (r) => r.distributor)}
            />
            <ColorPick label={distributor ? 'Territory' : 'Covered'} value={coveredColor} onChange={setCoveredColor} />
            <ColorPick label="Other" value={whitespaceColor} onChange={setWhitespaceColor} />
          </div>
        </div>
        <CoverageMap
          fillByFips={mapFill}
          tooltipByFips={mapTooltip}
          legend={
            distributor
              ? [
                  { label: `${distributor} territory`, color: coveredColor },
                  { label: 'Other / whitespace', color: whitespaceColor },
                ]
              : [
                  { label: 'DSD coverage', color: coveredColor },
                  { label: 'Whitespace (no DSD)', color: whitespaceColor },
                ]
          }
          exportName="dsd_coverage_map"
        />
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
        </>
      )}
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
