import { useMemo, useState } from 'react'
import {
  parseTable,
  suggestKeys,
  vlookup,
  type Table,
  type MatchStatus,
  type VlookupResult,
} from '../lib/vlookup'
import { EmptyState } from '../components/States'
import { exportCsv } from '../lib/csv'
import { theme } from '../theme'

const STATUS_STYLE: Record<MatchStatus, { color: string; rowBg: string; icon: string }> = {
  Matched: { color: theme.good, rowBg: '', icon: '✓' },
  'Multiple matches': { color: theme.warn, rowBg: 'bg-warn/5', icon: '≑' },
  'No match': { color: theme.bad, rowBg: 'bg-bad/10', icon: '✗' },
}

const STATUS_RANK: Record<MatchStatus, number> = {
  'No match': 0,
  'Multiple matches': 1,
  Matched: 2,
}

export function Vlookup() {
  const [desc, setDesc] = useState('')
  const [text1, setText1] = useState('')
  const [text2, setText2] = useState('')
  const [aKeyOverride, setAKeyOverride] = useState<number | null>(null)
  const [bKeyOverride, setBKeyOverride] = useState<number | null>(null)
  const [returnOverride, setReturnOverride] = useState<number[] | null>(null)

  const set1 = useParsed(text1)
  const set2 = useParsed(text2)

  const ready = set1.rows.length > 0 && set2.headers.length > 0

  // Auto-suggest the key pair (description can bias it); allow override.
  const suggested = useMemo(
    () => (ready ? suggestKeys(set1, set2, desc) : { aKey: 0, bKey: 0, overlap: 0 }),
    [set1, set2, desc, ready],
  )
  const aKey = aKeyOverride ?? suggested.aKey
  const bKey = bKeyOverride ?? suggested.bKey

  // Default return columns = every column of set 2 except the key.
  const returnCols = useMemo(() => {
    if (returnOverride) return returnOverride.filter((c) => c !== bKey)
    return set2.headers.map((_, i) => i).filter((i) => i !== bKey)
  }, [returnOverride, set2.headers, bKey])

  // Computed on demand when the user hits "Run VLOOKUP" (not reactive).
  const [result, setResult] = useState<VlookupResult | null>(null)

  const runVlookup = () => {
    if (!ready) return
    try {
      setResult(vlookup(set1, set2, aKey, bKey, returnCols))
    } catch {
      setResult(null)
    }
  }

  const sortedRows = useMemo(
    () =>
      result
        ? [...result.rows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
        : [],
    [result],
  )

  const toggleReturn = (i: number) => {
    const current = returnOverride ?? set2.headers.map((_, idx) => idx).filter((idx) => idx !== bKey)
    setReturnOverride(
      current.includes(i) ? current.filter((c) => c !== i) : [...current, i],
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">VLOOKUP / Match</h1>
        <p className="text-sm text-muted">
          Paste two datasets and match them on a shared key — like Excel&apos;s
          VLOOKUP. It auto-detects the key column (override below if needed) and
          pulls the matching columns from Set 2 onto Set 1.
        </p>
      </div>

      {/* 1. What are you matching */}
      <div className="card p-3 space-y-1">
        <label className="text-sm font-semibold">1. What are you matching?</label>
        <input
          className="input w-full"
          placeholder="e.g. Match SKU to pull SRP and case cost"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      {/* 2 + 3. Datasets */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PastePanel
          step="2"
          title="Data set 1 (base — rows you want to enrich)"
          placeholder={'SKU\tDescription\nODY-001\tFocus 12pk\nODY-002\tCalm 12pk'}
          text={text1}
          onText={(v) => {
            setText1(v)
            setAKeyOverride(null)
          }}
          table={set1}
          keyIndex={aKey}
          onKey={setAKeyOverride}
        />
        <PastePanel
          step="3"
          title="Data set 2 (lookup source — values pulled from here)"
          placeholder={'SKU\tSRP\tCase Cost\nODY-001\t3.99\t24.00\nODY-002\t3.49\t21.00'}
          text={text2}
          onText={(v) => {
            setText2(v)
            setBKeyOverride(null)
            setReturnOverride(null)
          }}
          table={set2}
          keyIndex={bKey}
          onKey={setBKeyOverride}
        />
      </div>

      {/* return-column picker */}
      {ready && set2.headers.length > 0 && (
        <div className="card p-3 space-y-2">
          <div className="text-sm font-semibold">
            Columns to pull from Set 2
            <span className="text-muted font-normal"> (the key column is excluded)</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {set2.headers.map((h, i) =>
              i === bKey ? null : (
                <label key={i} className="text-xs flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={returnCols.includes(i)}
                    onChange={() => toggleReturn(i)}
                  />
                  {h || `Column ${i + 1}`}
                </label>
              ),
            )}
          </div>
        </div>
      )}

      {/* Giant Run button */}
      <button
        className="btn btn-accent w-full text-lg font-bold py-4 disabled:opacity-40"
        onClick={runVlookup}
        disabled={!ready}
      >
        ▶ Run VLOOKUP
      </button>

      {result ? (
        <Results
          desc={desc}
          result={result}
          sortedRows={sortedRows}
          overlap={suggested.overlap}
        />
      ) : (
        <EmptyState
          message={
            ready
              ? 'Hit “Run VLOOKUP” to match the two data sets.'
              : 'Paste both data sets above (each with a header row), then hit Run VLOOKUP.'
          }
        />
      )}
    </div>
  )
}

function useParsed(text: string): Table {
  return useMemo(() => {
    if (!text.trim()) return { headers: [], rows: [] }
    try {
      return parseTable(text)
    } catch {
      return { headers: [], rows: [] }
    }
  }, [text])
}

function PastePanel({
  step,
  title,
  placeholder,
  text,
  onText,
  table,
  keyIndex,
  onKey,
}: {
  step: string
  title: string
  placeholder: string
  text: string
  onText: (v: string) => void
  table: Table
  keyIndex: number
  onKey: (i: number) => void
}) {
  const hasData = table.rows.length > 0 || table.headers.length > 0
  return (
    <div className="card p-3 space-y-2">
      <div className="text-sm font-semibold">
        {step}. {title}
        <span className="text-muted font-normal"> ({table.rows.length} rows)</span>
      </div>
      <textarea
        className="input w-full h-40 font-mono text-xs"
        placeholder={placeholder}
        value={text}
        onChange={(e) => onText(e.target.value)}
      />
      {hasData && (
        <label className="text-xs text-muted flex flex-col gap-1">
          Match on column (key)
          <select
            className="input"
            value={keyIndex}
            onChange={(e) => onKey(Number(e.target.value))}
          >
            {table.headers.map((h, i) => (
              <option key={i} value={i}>
                {h || `Column ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

function Results({
  desc,
  result,
  sortedRows,
  overlap,
}: {
  desc: string
  result: NonNullable<ReturnType<typeof vlookup>>
  sortedRows: ReturnType<typeof vlookup>['rows']
  overlap: number
}) {
  const { counts, baseHeaders, returnHeaders } = result
  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <Chip status="Matched" n={counts.matched} />
        <Chip status="Multiple matches" n={counts.multiple} />
        <Chip status="No match" n={counts.noMatch} />
        <div className="flex-1" />
        <span className="text-xs text-muted">key overlap detected: {overlap}</span>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-2 border-b border-ink-700">
          <div className="text-sm font-semibold">
            Result{desc.trim() ? ` — ${desc.trim()}` : ''}
          </div>
          <button
            className="btn text-xs"
            onClick={() =>
              exportCsv(
                'vlookup_result',
                sortedRows.map((r) => {
                  const obj: Record<string, unknown> = {}
                  baseHeaders.forEach((h, i) => {
                    obj[h || `Set1 Col ${i + 1}`] = r.base[i] ?? ''
                  })
                  returnHeaders.forEach((h, i) => {
                    obj[h] = r.returned[i] ?? ''
                  })
                  obj.Status = r.status
                  return obj
                }),
              )
            }
          >
            ⤓ CSV
          </button>
        </div>
        <div className="overflow-auto max-h-[55vh]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-ink-800">
              <tr>
                {baseHeaders.map((h, i) => (
                  <th key={`b${i}`} className="th whitespace-nowrap">
                    {h || `Col ${i + 1}`}
                  </th>
                ))}
                {returnHeaders.map((h, i) => (
                  <th key={`r${i}`} className="th whitespace-nowrap text-accent">
                    {h} ←
                  </th>
                ))}
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, idx) => {
                const s = STATUS_STYLE[r.status]
                return (
                  <tr key={idx} className={s.rowBg}>
                    {baseHeaders.map((_, i) => (
                      <td key={`b${i}`} className="td">
                        {r.base[i] ?? ''}
                      </td>
                    ))}
                    {returnHeaders.map((_, i) => (
                      <td key={`r${i}`} className="td">
                        {r.returned[i] ?? <span className="text-ink-500">—</span>}
                      </td>
                    ))}
                    <td className="td">
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `${s.color}22`, color: s.color }}
                      >
                        <span aria-hidden>{s.icon}</span>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Chip({ status, n }: { status: MatchStatus; n: number }) {
  const s = STATUS_STYLE[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold"
        style={{ backgroundColor: `${s.color}22`, color: s.color }}
        aria-hidden
      >
        {s.icon}
      </span>
      <span className="font-semibold" style={{ color: s.color }}>
        {n}
      </span>
      <span className="text-muted">{status}</span>
    </span>
  )
}
