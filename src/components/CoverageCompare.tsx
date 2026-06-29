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
const DIST_FIELDS: Field[] = ['fips', 'county', 'state', 'distributor']

export interface LoadedDsd {
  county: string | null
  state: string | null
  fips: string | null
  distributor: string | null
}

export function CoverageCompare({ loadedDsd }: { loadedDsd?: LoadedDsd[] }) {
  const [retailText, setRetailText] = useState('')
  const [distText, setDistText] = useState('')
  const [retailOverride, setRetailOverride] = useState<ColMap>({})
  const [distOverride, setDistOverride] = useState<ColMap>({})

  const retail = useParsed(retailText, retailOverride)
  const dist = useParsed(distText, distOverride)

  const ready =
    retail.table.rows.length > 0 &&
    dist.table.rows.length > 0 &&
    dist.map.fips != null &&
    (retail.map.fips != null || (retail.map.county != null && retail.map.state != null))

  const result = useMemo(() => {
    if (!ready) return null
    try {
      return compareCoverage(retail.table, retail.map, dist.table, dist.map)
    } catch {
      return null
    }
  }, [ready, retail.table, retail.map, dist.table, dist.map])

  const loadDsd = () => {
    if (!loadedDsd?.length) return
    const lines = ['FIPS\tCounty\tState\tDistributor']
    for (const r of loadedDsd) {
      lines.push(`${r.fips ?? ''}\t${r.county ?? ''}\t${r.state ?? ''}\t${r.distributor ?? ''}`)
    }
    setDistText(lines.join('\n'))
    setDistOverride({})
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Paste your retailer outlet list and a distributor county-coverage list.
        The map shows where retailer demand overlaps DSD coverage (
        <span style={{ color: theme.good }}>served</span>) vs. where you have
        outlets but no coverage (<span style={{ color: theme.bad }}>gap</span>).
        Joined on county FIPS (resolved from county + state when needed).
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
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
        <PastePanel
          step="2"
          title="Distributor county coverage"
          fields={DIST_FIELDS}
          placeholder={'FIPS\tCounty\tState\tDistributor\n04013\tMaricopa\tAZ\tSavannah Dist'}
          text={distText}
          onText={(v) => {
            setDistText(v)
            setDistOverride({})
          }}
          parsed={dist}
          onSetCol={(f, i) => setDistOverride((m) => ({ ...m, [f]: i }))}
          extra={
            loadedDsd?.length ? (
              <button className="btn text-xs" onClick={loadDsd}>
                ↧ Use loaded DSD data ({fmtInt(loadedDsd.length)} counties)
              </button>
            ) : null
          }
        />
      </div>

      {!ready ? (
        <EmptyState
          message={
            !retailText.trim() || !distText.trim()
              ? 'Paste both lists above to compare coverage.'
              : 'Map the key columns: distributor needs FIPS; retailer needs FIPS or County + State.'
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
  const { counts, gaps, statusByFips } = result
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Counties served" value={fmtInt(counts.servedCounties)} color={theme.good} />
        <Kpi label="Gap counties" value={fmtInt(counts.gapCounties)} color={theme.bad} />
        <Kpi label="Outlets in gap counties" value={fmtInt(counts.outletsGap)} color={theme.bad} />
        <Kpi label="Outlets served" value={fmtInt(counts.outletsServed)} color={theme.good} />
      </div>
      {counts.unresolved > 0 && (
        <div className="text-xs text-muted">
          {fmtInt(counts.unresolved)} retailer row(s) couldn’t be matched to a county
          (missing/unknown county+state or FIPS).
        </div>
      )}

      <div className="card p-3">
        <CoverageMap statusByFips={statusByFips} exportName="coverage_comparison_map" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-2 border-b border-ink-700">
          <div className="text-sm font-semibold">
            Gap counties
            <span className="text-muted font-normal"> — outlets with no DSD coverage</span>
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
