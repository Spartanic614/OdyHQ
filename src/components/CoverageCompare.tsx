import { useMemo, useState } from 'react'
import {
  parseTable,
  detectColumns,
  compareCoverage,
  FIELD_LABELS,
  type ColMap,
  type Field,
  type Table,
} from '../lib/coverageCompare'
import { CoverageMap } from './CoverageMap'
import { EmptyState } from './States'
import { exportCsv } from '../lib/csv'
import { fmtInt } from '../lib/format'
import { theme } from '../theme'

const RETAIL_FIELDS: Field[] = ['fips', 'county', 'state', 'outlets']

export interface LoadedDsd {
  county: string | null
  state: string | null
  fips: string | null
  distributor: string | null
}

export function CoverageCompare({ loadedDsd }: { loadedDsd?: LoadedDsd[] }) {
  const [retailText, setRetailText] = useState('')
  const [retailOverride, setRetailOverride] = useState<ColMap>({})

  const retail = useParsed(retailText, retailOverride)

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

  const retailKeyed =
    retail.map.fips != null || (retail.map.county != null && retail.map.state != null)
  const ready = retail.table.rows.length > 0 && dist.table.rows.length > 0 && retailKeyed

  const result = useMemo(() => {
    if (!ready) return null
    try {
      return compareCoverage(retail.table, retail.map, dist.table, dist.map)
    } catch {
      return null
    }
  }, [ready, retail.table, retail.map, dist.table, dist.map])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Paste your retailer outlets below. The map shows your{' '}
        <span style={{ color: theme.good }}>current DSD coverage</span> and flags
        the counties where you have outlets but{' '}
        <span style={{ color: theme.bad }}>no coverage</span> — the ones you&apos;d
        need a new DSD for. Compared against{' '}
        {loadedDsd?.length ? `${fmtInt(loadedDsd.length)} loaded counties` : 'your loaded DSD data'}.
      </p>

      <PastePanel
        step="1"
        title="Retailer outlets"
        fields={RETAIL_FIELDS}
        placeholder={'County\tState\tStores\nMaricopa\tAZ\t14\nHarris\tTX\t9'}
        text={retailText}
        onText={(v) => {
          setRetailText(v)
          setRetailOverride({})
        }}
        parsed={retail}
        onSetCol={(f, i) => setRetailOverride((m) => ({ ...m, [f]: i }))}
      />

      {!ready ? (
        <EmptyState
          message={
            !dist.table.rows.length
              ? 'DSD coverage still loading…'
              : !retailText.trim()
                ? 'Paste your retailer outlets above to see what counties you’re missing.'
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
  const [servedColor, setServedColor] = useState<string>(theme.good)
  const [gapColor, setGapColor] = useState<string>(theme.bad)
  const [coverageColor, setCoverageColor] = useState<string>('#39414f')

  const fillByFips = useMemo(() => {
    const m = new Map<string, string>()
    for (const [fips, status] of statusByFips) {
      m.set(fips, status === 'served' ? servedColor : status === 'gap' ? gapColor : coverageColor)
    }
    return m
  }, [statusByFips, servedColor, gapColor, coverageColor])

  const tooltipByFips = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of gaps) m.set(g.fips, `Needs a DSD · ${fmtInt(g.outlets)} outlets`)
    for (const s of served) m.set(s.fips, `Served · ${fmtInt(s.outlets)} outlets`)
    for (const [fips, status] of statusByFips)
      if (status === 'coverageOnly' && !m.has(fips)) m.set(fips, 'DSD coverage (no outlets)')
    return m
  }, [gaps, served, statusByFips])

  const legend = [
    { label: 'Served (outlets + DSD)', color: servedColor },
    { label: 'Needs a DSD (outlets, no coverage)', color: gapColor },
    { label: 'DSD coverage only', color: coverageColor },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Counties served" value={fmtInt(counts.servedCounties)} color={theme.good} />
        <Kpi label="Counties needing a DSD" value={fmtInt(counts.gapCounties)} color={theme.bad} />
        <Kpi label="Outlets with no DSD" value={fmtInt(counts.outletsGap)} color={theme.bad} />
        <Kpi label="Outlets served" value={fmtInt(counts.outletsServed)} color={theme.good} />
      </div>
      {counts.unresolved > 0 && (
        <div className="text-xs text-muted">
          {fmtInt(counts.unresolved)} retailer row(s) couldn’t be matched to a county
          (missing/unknown county+state or FIPS).
        </div>
      )}

      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <ColorPick label="Served" value={servedColor} onChange={setServedColor} />
          <ColorPick label="Needs a DSD" value={gapColor} onChange={setGapColor} />
          <ColorPick label="Coverage only" value={coverageColor} onChange={setCoverageColor} />
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
            Counties needing a new DSD
            <span className="text-muted font-normal"> — retailer outlets with no coverage</span>
          </div>
          <button
            className="btn text-xs"
            onClick={() =>
              exportCsv(
                'coverage_gaps',
                gaps.map((g) => ({
                  FIPS: g.fips,
                  County: g.county,
                  State: g.state,
                  Outlets: g.outlets,
                })),
              )
            }
          >
            ⤓ CSV
          </button>
        </div>
        <div className="overflow-auto max-h-[45vh]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-ink-800">
              <tr>
                <th className="th">County</th>
                <th className="th">State</th>
                <th className="th">FIPS</th>
                <th className="th text-right">Outlets</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={g.fips} className="bg-bad/5">
                  <td className="td font-medium">{g.county || '—'}</td>
                  <td className="td text-muted">{g.state || '—'}</td>
                  <td className="td text-muted">{g.fips}</td>
                  <td className="td text-right font-semibold">{fmtInt(g.outlets)}</td>
                </tr>
              ))}
              {gaps.length === 0 && (
                <tr>
                  <td className="td text-muted" colSpan={4}>
                    No gaps — every retailer county has DSD coverage. 🎉
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
