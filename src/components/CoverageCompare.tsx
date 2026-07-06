import { useEffect, useMemo, useState } from 'react'
import {
  parseTable,
  detectColumns,
  compareCoverage,
  FIELD_LABELS,
  type ColMap,
  type Field,
  type Table,
} from '../lib/coverageCompare'
import { geocodeAddresses, type GeocodeMatch, type GeocodeProgress } from '../lib/geocode'
import { CoverageMap } from './CoverageMap'
import { EmptyState } from './States'
import { exportCsv } from '../lib/csv'
import { fmtInt } from '../lib/format'
import { theme } from '../theme'

const RETAIL_FIELDS: Field[] = ['fips', 'county', 'state', 'address', 'outlets']

export interface LoadedDsd {
  county: string | null
  state: string | null
  fips: string | null
  distributor: string | null
}

export function CoverageCompare({ loadedDsd }: { loadedDsd?: LoadedDsd[] }) {
  const [retailText, setRetailText] = useState('')
  const [retailOverride, setRetailOverride] = useState<ColMap>({})

  // Address -> county resolution (only used when the paste has an address
  // column but no county/state/FIPS). Keyed by row index in retail.table.rows.
  const [geoResults, setGeoResults] = useState<Map<number, GeocodeMatch | null>>(new Map())
  const [geoStatus, setGeoStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [geoProgress, setGeoProgress] = useState<GeocodeProgress>({ done: 0, total: 0 })
  const [geoError, setGeoError] = useState<string | null>(null)

  const retail = useParsed(retailText, retailOverride)

  // Reset geocoding state whenever the paste changes — stale results from a
  // previous data set must not silently carry over.
  useEffect(() => {
    setGeoResults(new Map())
    setGeoStatus('idle')
    setGeoProgress({ done: 0, total: 0 })
    setGeoError(null)
  }, [retailText])

  // Distributor side = your CURRENT loaded DSD coverage (no paste needed).
  const dist = useMemo(() => {
    const rows = (loadedDsd ?? []).map((r) => [
      r.fips ?? '',
      r.county ?? '',
      r.state ?? '',
      r.distributor ?? '',
    ])
    return {
      table: { headers: ['FIPS', 'County', 'State', 'Distributor'], rows } as Table,
      map: { fips: 0, county: 1, state: 2, distributor: 3 } as ColMap,
    }
  }, [loadedDsd])

  const hasDirectKey =
    retail.map.fips != null || (retail.map.county != null && retail.map.state != null)
  const hasAddress = retail.map.address != null
  // County-mapping data was pasted without county/state — geocoding can fill the gap.
  const needsGeocode = hasAddress && !hasDirectKey

  // Once geocoded, append a synthetic FIPS column so compareCoverage can run
  // unchanged — unmatched rows get an empty FIPS and fall out as "unresolved".
  const { table: retailTable, map: retailMap } = useMemo(() => {
    if (!needsGeocode || geoStatus !== 'done') return { table: retail.table, map: retail.map }
    const fipsCol = retail.table.headers.length
    const rows = retail.table.rows.map((r, i) => [...r, geoResults.get(i)?.fips ?? ''])
    return {
      table: { headers: [...retail.table.headers, 'Resolved County FIPS'], rows },
      map: { ...retail.map, fips: fipsCol },
    }
  }, [needsGeocode, geoStatus, retail.table, retail.map, geoResults])

  const ready =
    retailTable.rows.length > 0 &&
    dist.table.rows.length > 0 &&
    (hasDirectKey || (needsGeocode && geoStatus === 'done'))

  const result = useMemo(() => {
    if (!ready) return null
    try {
      return compareCoverage(retailTable, retailMap, dist.table, dist.map)
    } catch {
      return null
    }
  }, [ready, retailTable, retailMap, dist.table, dist.map])

  const runGeocode = async () => {
    const addrCol = retail.map.address
    if (addrCol == null) return
    setGeoStatus('running')
    setGeoError(null)
    const rows = retail.table.rows.map((r, i) => ({ id: String(i), address: r[addrCol] ?? '' }))
    try {
      const results = await geocodeAddresses(rows, setGeoProgress)
      const byIndex = new Map<number, GeocodeMatch | null>()
      results.forEach((v, k) => byIndex.set(Number(k), v))
      setGeoResults(byIndex)
      setGeoStatus('done')
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : String(e))
      setGeoStatus('error')
    }
  }

  const geoMatchedCount = useMemo(
    () => [...geoResults.values()].filter((v) => v?.matched).length,
    [geoResults],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Paste your retailer outlets below (county/state, FIPS, or a street
        address — we&apos;ll resolve addresses to counties for you). The map shows:{' '}
        <span style={{ color: theme.info }}>Served</span> (retailers + coverage),{' '}
        <span style={{ color: theme.bad }}>Gap</span> (retailers, no coverage),{' '}
        <span style={{ color: theme.good }}>Existing Coverage</span> (coverage, no retailers).
      </p>

      <PastePanel
        step="1"
        title="Retailer outlets"
        fields={RETAIL_FIELDS}
        placeholder={
          'County\tState\tStores\nMaricopa\tAZ\t14\nHarris\tTX\t9\n\n' +
          '— or, no county? just paste an address column —\n' +
          'Address\tStores\n155 Harvard St, Brookline, MA 02446\t14'
        }
        text={retailText}
        onText={(v) => {
          setRetailText(v)
          setRetailOverride({})
        }}
        parsed={retail}
        onSetCol={(f, i) => setRetailOverride((m) => ({ ...m, [f]: i }))}
      />

      {needsGeocode && (
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="font-semibold">Address-only data detected.</span>{' '}
              <span className="text-muted">
                No county/state or FIPS column — resolve the {fmtInt(retail.table.rows.length)} address(es)
                to counties before comparing.
              </span>
            </div>
            <button
              className="btn btn-accent text-xs shrink-0"
              onClick={runGeocode}
              disabled={geoStatus === 'running'}
            >
              {geoStatus === 'running'
                ? `Resolving… ${fmtInt(geoProgress.done)}/${fmtInt(geoProgress.total)}`
                : geoStatus === 'done'
                  ? '↻ Re-resolve addresses'
                  : '📍 Resolve addresses to counties'}
            </button>
          </div>
          {geoStatus === 'done' && (
            <div className="text-xs text-muted">
              {fmtInt(geoMatchedCount)} of {fmtInt(retail.table.rows.length)} addresses matched to a
              county.
              {geoMatchedCount < retail.table.rows.length && (
                <span style={{ color: theme.warn }}>
                  {' '}
                  {fmtInt(retail.table.rows.length - geoMatchedCount)} couldn&apos;t be matched — check
                  those addresses.
                </span>
              )}
            </div>
          )}
          {geoStatus === 'error' && (
            <div className="text-xs text-bad">Geocoding failed: {geoError}</div>
          )}
        </div>
      )}

      {!ready ? (
        <EmptyState
          message={
            !dist.table.rows.length
              ? 'DSD coverage still loading…'
              : !retailText.trim()
                ? 'Paste your retailer outlets above to see what counties you’re missing.'
                : needsGeocode
                  ? 'Click "Resolve addresses to counties" above to continue.'
                  : 'Map the County + State (or FIPS) column on your retailer data.'
          }
        />
      ) : (
        result && <Results result={result} />
      )}
    </div>
  )
}

interface Parsed {
  table: Table
  map: ColMap
}
function useParsed(text: string, override: ColMap): Parsed {
  return useMemo(() => {
    if (!text.trim()) return { table: { headers: [], rows: [] }, map: {} }
    try {
      const table = parseTable(text)
      return { table, map: { ...detectColumns(table), ...override } }
    } catch {
      return { table: { headers: [], rows: [] }, map: {} }
    }
  }, [text, override])
}

function PastePanel({
  step,
  title,
  fields,
  placeholder,
  text,
  onText,
  parsed,
  onSetCol,
  extra,
}: {
  step: string
  title: string
  fields: Field[]
  placeholder: string
  text: string
  onText: (v: string) => void
  parsed: Parsed
  onSetCol: (field: Field, index: number | undefined) => void
  extra?: React.ReactNode
}) {
  const hasData = parsed.table.rows.length > 0
  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          {step}. {title}
          <span className="text-muted font-normal"> ({parsed.table.rows.length} rows)</span>
        </div>
        {extra}
      </div>
      <textarea
        className="input w-full h-36 font-mono text-xs"
        placeholder={placeholder}
        value={text}
        onChange={(e) => onText(e.target.value)}
      />
      {hasData && (
        <div className="grid gap-2 sm:grid-cols-4">
          {fields.map((f) => (
            <label key={f} className="text-xs text-muted flex flex-col gap-1">
              {FIELD_LABELS[f]}
              <select
                className="input"
                value={parsed.map[f] ?? ''}
                onChange={(e) =>
                  onSetCol(f, e.target.value === '' ? undefined : Number(e.target.value))
                }
              >
                <option value="">— none —</option>
                {parsed.table.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function Results({ result }: { result: NonNullable<ReturnType<typeof compareCoverage>> }) {
  const { counts, gaps, served, statusByFips } = result
  // Color scheme: blue = need it & have it; red = need it & don't; green = have it & don't need it.
  const [servedColor, setServedColor] = useState<string>(theme.info)
  const [gapColor, setGapColor] = useState<string>(theme.bad)
  const [coverageColor, setCoverageColor] = useState<string>(theme.good)

  const fillByFips = useMemo(() => {
    const m = new Map<string, string>()
    for (const [fips, status] of statusByFips) {
      m.set(fips, status === 'served' ? servedColor : status === 'gap' ? gapColor : coverageColor)
    }
    return m
  }, [statusByFips, servedColor, gapColor, coverageColor])

  const tooltipByFips = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of gaps) m.set(g.fips, `Gap · ${fmtInt(g.outlets)} outlets`)
    for (const s of served) m.set(s.fips, `Served · ${fmtInt(s.outlets)} outlets`)
    for (const [fips, status] of statusByFips)
      if (status === 'coverageOnly' && !m.has(fips)) m.set(fips, "Existing Coverage · no retailers")
    return m
  }, [gaps, served, statusByFips])

  const legend = [
    { label: 'Served', color: servedColor },
    { label: 'Gap', color: gapColor },
    { label: 'Existing Coverage', color: coverageColor },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Served" value={fmtInt(counts.servedCounties)} color={theme.info} />
        <Kpi label="Gap" value={fmtInt(counts.gapCounties)} color={theme.bad} />
        <Kpi label="Outlets in gap" value={fmtInt(counts.outletsGap)} color={theme.bad} />
        <Kpi label="Existing Coverage" value={fmtInt(counts.coverageOnly)} color={theme.good} />
      </div>
      {counts.unresolved > 0 && (
        <div className="text-xs text-muted">
          {fmtInt(counts.unresolved)} retailer row(s) couldn’t be matched to a county
          (missing/unknown county+state, FIPS, or unresolved address).
        </div>
      )}

      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <ColorPick label="Served" value={servedColor} onChange={setServedColor} />
          <ColorPick label="Gap" value={gapColor} onChange={setGapColor} />
          <ColorPick label="Existing Coverage" value={coverageColor} onChange={setCoverageColor} />
        </div>
        <CoverageMap
          fillByFips={fillByFips}
          tooltipByFips={tooltipByFips}
          legend={legend}
          exportName="coverage_comparison_map"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-2 border-b border-ink-700">
          <div className="text-sm font-semibold">
            Coverage Analysis
            <span className="text-muted font-normal"> — retailers and their DSD coverage status</span>
          </div>
          <button
            className="btn text-xs"
            onClick={() => {
              const allRows = [
                ...served.map((s) => ({
                  FIPS: s.fips,
                  County: s.county,
                  State: s.state,
                  Outlets: s.outlets,
                  Status: 'Served',
                  Distributor: s.distributor ?? '—',
                })),
                ...gaps.map((g) => ({
                  FIPS: g.fips,
                  County: g.county,
                  State: g.state,
                  Outlets: g.outlets,
                  Status: 'Gap',
                  Distributor: '—',
                })),
              ]
              exportCsv('coverage_analysis', allRows)
            }}
          >
            ⤓ CSV
          </button>
        </div>
        <div className="overflow-auto max-h-[45vh]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-ink-800">
              <tr>
                <th className="th">Status</th>
                <th className="th">County</th>
                <th className="th">State</th>
                <th className="th">FIPS</th>
                <th className="th text-right">Outlets</th>
                <th className="th">Distributor</th>
              </tr>
            </thead>
            <tbody>
              {served.length > 0 && served.map((s) => (
                <tr key={`served-${s.fips}`} className="bg-info/5">
                  <td className="td">
                    <span style={{ color: theme.good }}>✓ Served</span>
                  </td>
                  <td className="td font-medium">{s.county || '—'}</td>
                  <td className="td text-muted">{s.state || '—'}</td>
                  <td className="td text-muted">{s.fips}</td>
                  <td className="td text-right font-semibold">{fmtInt(s.outlets)}</td>
                  <td className="td" style={{ color: theme.good }}>
                    {s.distributor ?? '—'}
                  </td>
                </tr>
              ))}
              {gaps.length > 0 && gaps.map((g) => (
                <tr key={`gap-${g.fips}`} className="bg-bad/5">
                  <td className="td">
                    <span style={{ color: theme.bad }}>✗ Gap</span>
                  </td>
                  <td className="td font-medium">{g.county || '—'}</td>
                  <td className="td text-muted">{g.state || '—'}</td>
                  <td className="td text-muted">{g.fips}</td>
                  <td className="td text-right font-semibold">{fmtInt(g.outlets)}</td>
                  <td className="td text-muted">—</td>
                </tr>
              ))}
              {gaps.length === 0 && served.length === 0 && (
                <tr>
                  <td className="td text-muted" colSpan={6}>
                    No retailers found for this region.
                  </td>
                </tr>
              )}
              {gaps.length === 0 && served.length > 0 && (
                <tr>
                  <td className="td text-muted" colSpan={6}>
                    ✓ No gaps — every retailer county has DSD coverage! 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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

export function ColorPick({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="text-xs text-muted flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer bg-transparent"
      />
      {label}
    </label>
  )
}
