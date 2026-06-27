import { useMemo, useState } from 'react'
import {
  parseArPaste,
  crossReference,
  AR_FIELD_LABELS,
  AR_REQUIRED,
  DEFAULT_CROSSREF_OPTIONS,
  type ArColumnMap,
  type ArField,
  type ArTable,
  type ArResult,
  type ArStatus,
} from '../lib/unfiAr'
import { EmptyState } from '../components/States'
import { exportCsv } from '../lib/csv'
import { fmtUsd } from '../lib/format'
import { theme } from '../theme'

const FIELD_ORDER: ArField[] = ['invoice', 'amount', 'date', 'description']

const STATUS_STYLE: Record<ArStatus, { color: string; rowBg: string; icon: string }> = {
  'Open in Payables': { color: theme.good, rowBg: '', icon: '✓' },
  'Amount Mismatch': { color: theme.warn, rowBg: 'bg-warn/5', icon: '≠' },
  'Not in Payables': { color: theme.bad, rowBg: 'bg-bad/10', icon: '⚠' },
  'No Invoice #': { color: theme.textMuted, rowBg: '', icon: '–' },
}

const STATUS_RANK: Record<ArStatus, number> = {
  'Not in Payables': 0,
  'Amount Mismatch': 1,
  'Open in Payables': 2,
  'No Invoice #': 3,
}

export function UnfiArTool() {
  const [payablesText, setPayablesText] = useState('')
  const [unpaidText, setUnpaidText] = useState('')
  const [payablesOverride, setPayablesOverride] = useState<ArColumnMap>({})
  const [unpaidOverride, setUnpaidOverride] = useState<ArColumnMap>({})
  const [compareAmounts, setCompareAmounts] = useState(DEFAULT_CROSSREF_OPTIONS.compareAmounts)

  const payables = useParsed(payablesText, payablesOverride)
  const unpaid = useParsed(unpaidText, unpaidOverride)

  const result = useMemo(() => {
    if (!payables.table.rows.length || !unpaid.table.rows.length) return null
    try {
      return crossReference(unpaid.table, payables.table, {
        ...DEFAULT_CROSSREF_OPTIONS,
        compareAmounts,
      })
    } catch {
      return null
    }
  }, [payables.table, unpaid.table, compareAmounts])

  const ready =
    payables.table.rows.length > 0 &&
    unpaid.table.rows.length > 0 &&
    payables.table.detected.invoice != null &&
    unpaid.table.detected.invoice != null

  const sortedRows = useMemo(
    () =>
      result
        ? [...result.rows].sort(
            (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
          )
        : [],
    [result],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">UNFI AR Tool</h1>
        <p className="text-sm text-muted">
          Cross-reference suspected-unpaid line items against UNFI&apos;s Open
          Payables. Matched items are sitting open on UNFI&apos;s books (awaiting
          release); unmatched items aren&apos;t showing — already paid or dropped.
          Paste both data sets below.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PastePanel
          step="1"
          title="Open Payables (from UNFI)"
          placeholder={
            'Invoice #\tAmount\tDate\tDescription\n' +
            '1234567\t4,820.00\t2026-03-01\tDeduction\n' +
            '1234890\t1,200.00\t2026-03-04\tShortage'
          }
          text={payablesText}
          onText={setPayablesText}
          parsed={payables}
          setOverride={setPayablesOverride}
        />
        <PastePanel
          step="2"
          title="Unpaid line items (suspected unreleased)"
          placeholder={
            'Invoice #\tAmount\tDate\tDescription\n' +
            '1234567\t4,820.00\t2026-03-01\tInvoice\n' +
            '9990001\t775.00\t2026-02-18\tInvoice'
          }
          text={unpaidText}
          onText={setUnpaidText}
          parsed={unpaid}
          setOverride={setUnpaidOverride}
        />
      </div>

      {!ready ? (
        <EmptyState
          message={
            !payablesText.trim() || !unpaidText.trim()
              ? 'Paste both data sets above to cross-reference them.'
              : 'Map the Invoice / Ref # column in both data sets to cross-reference.'
          }
        />
      ) : (
        result && (
          <Results
            result={result}
            sortedRows={sortedRows}
            compareAmounts={compareAmounts}
            setCompareAmounts={setCompareAmounts}
          />
        )
      )}
    </div>
  )
}

// ---- parse + effective column map hook ----
interface Parsed {
  table: ArTable
  parseError: string | null
}
function useParsed(text: string, override: ArColumnMap): Parsed {
  return useMemo(() => {
    if (!text.trim()) {
      return { table: { headers: [], rows: [], detected: {} }, parseError: null }
    }
    try {
      const t = parseArPaste(text)
      return {
        table: { ...t, detected: { ...t.detected, ...override } },
        parseError: null,
      }
    } catch (e) {
      return {
        table: { headers: [], rows: [], detected: {} },
        parseError: e instanceof Error ? e.message : String(e),
      }
    }
  }, [text, override])
}

// ---- one paste panel (box + column confirm) ----
function PastePanel({
  step,
  title,
  placeholder,
  text,
  onText,
  parsed,
  setOverride,
}: {
  step: string
  title: string
  placeholder: string
  text: string
  onText: (v: string) => void
  parsed: Parsed
  setOverride: React.Dispatch<React.SetStateAction<ArColumnMap>>
}) {
  const hasData = parsed.table.rows.length > 0
  const missingKey = hasData && parsed.table.detected.invoice == null
  return (
    <div className="card p-3 space-y-2">
      <div className="text-sm font-semibold">
        {step}. {title}
        <span className="text-muted font-normal"> ({parsed.table.rows.length} rows)</span>
      </div>
      <textarea
        className="input w-full h-40 font-mono text-xs"
        placeholder={placeholder}
        value={text}
        onChange={(e) => onText(e.target.value)}
      />
      {parsed.parseError && (
        <div className="text-xs text-bad">
          Couldn&apos;t read this paste ({parsed.parseError}). Copy the header row
          plus data rows.
        </div>
      )}
      {hasData && (
        <div className="grid gap-2 sm:grid-cols-4">
          {FIELD_ORDER.map((field) => (
            <label key={field} className="text-xs text-muted flex flex-col gap-1">
              <span>
                {AR_FIELD_LABELS[field]}
                {AR_REQUIRED.includes(field) && <span className="text-bad"> *</span>}
              </span>
              <select
                className="input"
                value={parsed.table.detected[field] ?? ''}
                onChange={(e) =>
                  setOverride((m) => ({
                    ...m,
                    [field]: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
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
      {missingKey && (
        <div className="text-xs text-bad">Map the Invoice / Ref # column to cross-reference.</div>
      )}
    </div>
  )
}

// ---- results ----
function Results({
  result,
  sortedRows,
  compareAmounts,
  setCompareAmounts,
}: {
  result: NonNullable<ReturnType<typeof crossReference>>
  sortedRows: ArResult[]
  compareAmounts: boolean
  setCompareAmounts: (v: boolean) => void
}) {
  const { counts, payablesOnly } = result
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <StatusChip status="Not in Payables" n={counts['Not in Payables']} />
        <StatusChip status="Amount Mismatch" n={counts['Amount Mismatch']} />
        <StatusChip status="Open in Payables" n={counts['Open in Payables']} />
        {counts['No Invoice #'] > 0 && (
          <StatusChip status="No Invoice #" n={counts['No Invoice #']} />
        )}
        <div className="flex-1" />
        <label className="text-xs text-muted flex items-center gap-2">
          <input
            type="checkbox"
            checked={compareAmounts}
            onChange={(e) => setCompareAmounts(e.target.checked)}
          />
          Flag amount mismatches
        </label>
      </div>

      {/* Cross-reference table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-2 border-b border-ink-700">
          <div className="text-sm font-semibold">3. Cross-reference</div>
          <button
            className="btn text-xs"
            onClick={() =>
              exportCsv(
                'unfi_ar_crossref',
                sortedRows.map((r) => ({
                  'Invoice / Ref #': r.invoice,
                  Description: r.description,
                  Date: r.date,
                  'Unpaid Amount': r.unpaidAmount ?? '',
                  'Payables Amount': r.payablesAmount ?? '',
                  Status: r.status,
                })),
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
                <th className="th">Invoice / Ref #</th>
                <th className="th">Description</th>
                <th className="th">Date</th>
                <th className="th text-right">Unpaid Amt</th>
                <th className="th text-right">Payables Amt</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => {
                const s = STATUS_STYLE[r.status]
                return (
                  <tr key={`${r.invoice}-${i}`} className={s.rowBg}>
                    <td className="td font-medium">{r.invoice || '—'}</td>
                    <td className="td text-muted">{r.description || '—'}</td>
                    <td className="td text-muted">{r.date || '—'}</td>
                    <td className="td text-right">{fmtUsd(r.unpaidAmount)}</td>
                    <td className="td text-right">{fmtUsd(r.payablesAmount)}</td>
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

      {payablesOnly.length > 0 && (
        <div className="card p-3 space-y-1">
          <div className="text-sm font-semibold">
            In UNFI Payables but not in your list
            <span className="text-muted font-normal"> ({payablesOnly.length})</span>
          </div>
          <p className="text-xs text-muted">
            UNFI shows these as open but they aren&apos;t in your unpaid list — worth a look.
          </p>
          <div className="text-xs font-mono text-muted max-h-32 overflow-auto pt-1">
            {payablesOnly.map((p, i) => (
              <div key={i}>
                {p.invoice}
                {p.amount != null ? ` — ${fmtUsd(p.amount)}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusChip({ status, n }: { status: ArStatus; n: number }) {
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
