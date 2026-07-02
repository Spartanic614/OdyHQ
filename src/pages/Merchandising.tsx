import { useMemo, useState } from 'react'
import { parseTable } from '../lib/parseTable'
import {
  buildVisits,
  dateRange,
  detectMerchColumns,
  MERCH_FIELD_LABELS,
  MERCH_REQUIRED,
  summarize,
  retailerProfit,
  profitTotals,
  DEFAULT_MERCH_ECON,
  type MerchColumnMap,
  type MerchEconomics,
  type MerchField,
  type RetailerProfit,
  type StoreVisit,
} from '../lib/merchandising'
import { useLocalStorage } from '../lib/useLocalStorage'
import { KpiCard } from '../components/KpiCard'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { EmptyState } from '../components/States'
import { exportCsv } from '../lib/csv'
import { fmtInt, fmtPct, fmtUsd } from '../lib/format'
import { theme } from '../theme'

const FIELD_ORDER: MerchField[] = [
  'storeInfo',
  'storeId',
  'chain',
  'masterChain',
  'question',
  'response',
  'visitDate',
]

const roiPct = (roi: number | null) => (roi == null ? '—' : `${(roi * 100).toFixed(0)}%`)
const signColor = (n: number) => (n >= 0 ? theme.good : theme.bad)
const fmtRangeDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const packColor = (p: string) =>
  p === 'Shelf Full'
    ? theme.good
    : p === 'Out of Stock'
      ? theme.bad
      : p.startsWith('Packed')
        ? theme.accent
        : theme.textMuted

const displayColor = (d: string) =>
  d === 'Display Up' ? theme.good : d === 'Refused' ? theme.bad : d === 'Not Up' ? theme.warn : theme.textMuted

export function Merchandising() {
  const [text, setText] = useState('')
  const [overrideMap, setOverrideMap] = useState<MerchColumnMap>({})
  const [econ, setEcon] = useLocalStorage<MerchEconomics>('merch_econ', DEFAULT_MERCH_ECON)
  const [chain, setChain] = useState('')
  const [search, setSearch] = useState('')
  const [onlyNotAuth, setOnlyNotAuth] = useState(false)

  const table = useMemo(() => parseTable(text), [text])
  const detected = useMemo(() => detectMerchColumns(table), [table])
  const map = useMemo<MerchColumnMap>(() => ({ ...detected, ...overrideMap }), [detected, overrideMap])

  const visits = useMemo(() => buildVisits(table, map), [table, map])
  const range = useMemo(() => dateRange(visits), [visits])
  const summary = useMemo(() => summarize(visits), [visits])
  const profit = useMemo(() => retailerProfit(visits, econ), [visits, econ])
  const totals = useMemo(() => profitTotals(profit), [profit])

  const hasData = table.rows.length > 0
  const missingRequired = MERCH_REQUIRED.some((f) => map[f] == null)
  const noEcon = econ.costPerVisit === 0 && econ.marginPerCase === 0

  const setNum = (k: keyof MerchEconomics) => (v: string) =>
    setEcon((prev) => ({ ...prev, [k]: Number(v) || 0 }))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return visits
      .filter((v) => !chain || v.chain === chain || v.masterChain === chain)
      .filter((v) => !onlyNotAuth || !v.authorized)
      .filter(
        (v) =>
          !q ||
          [v.store, v.chain, v.address, v.notes, v.storeId].some((s) =>
            (s ?? '').toLowerCase().includes(q),
          ),
      )
  }, [visits, chain, onlyNotAuth, search])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Merchandising Profitability</h1>
        <p className="text-sm text-muted">
          Paste your field-merchandising visit export (one row per survey
          question). Set your economics, and it computes ROI per retailer —
          value of cases packed &amp; displays built vs. merch cost per visit.
        </p>
      </div>

      {/* Paste box */}
      <div className="card p-3 space-y-2">
        <div className="text-sm font-semibold">
          1. Paste merchandising data
          <span className="text-muted font-normal"> (include the header row)</span>
        </div>
        <textarea
          className="input w-full h-32 font-mono text-xs"
          placeholder={
            'Store Info\tSurvey Name\tQuestion\tResponse\tVisit Date\tStoreId\tMaster Chain\tChain\n' +
            '1 - Stop & Shop | …\t(ARP) Pack Out\tDid you pack out Odyssey Product?\tDisplay-Shelf Is Full\t6/5/2026\t102116\tAhold USA Inc\tStop & Shop'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {/* Column mapping */}
      {hasData && (
        <div className="card p-3 space-y-2">
          <div className="text-sm font-semibold">
            2. Confirm columns
            <span className="text-muted font-normal"> (auto-detected — override if wrong)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELD_ORDER.map((field) => (
              <label key={field} className="text-xs text-muted flex flex-col gap-1">
                <span>
                  {MERCH_FIELD_LABELS[field]}
                  {MERCH_REQUIRED.includes(field) && <span className="text-bad"> *</span>}
                </span>
                <select
                  className="input"
                  value={map[field] ?? ''}
                  onChange={(e) =>
                    setOverrideMap((m) => ({
                      ...m,
                      [field]: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">— none —</option>
                  {table.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {missingRequired && (
            <div className="text-xs text-bad">Map Question and Response to analyze visits.</div>
          )}
        </div>
      )}

      {/* Economics */}
      {hasData && !missingRequired && (
        <div className="card p-3 space-y-2">
          <div className="text-sm font-semibold">
            3. Economics
            <span className="text-muted font-normal"> (saved on this device)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MoneyInput label="Cost per store visit" value={econ.costPerVisit} onChange={setNum('costPerVisit')} />
            <MoneyInput label="Odyssey margin / case" value={econ.marginPerCase} onChange={setNum('marginPerCase')} />
            <NumInput label="Cases credited per display" value={econ.casesPerDisplay} onChange={setNum('casesPerDisplay')} step={0.5} />
          </div>
          <div className="text-xs text-muted">
            Value = (cases packed out + displays built × cases/display) × margin.
            Cost = store visits × cost/visit.
          </div>
          {noEcon && (
            <div className="text-xs text-warn">
              Enter your cost per visit and margin per case above to see profitability.
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasData && !missingRequired && (
        <>
          {/* Timeframe of the pasted data */}
          <div className="card p-3 flex flex-wrap items-center justify-between gap-2 border-l-2 border-accent">
            <div className="text-sm">
              <span className="text-muted">Timeframe of pasted data: </span>
              {range.start && range.end ? (
                <span className="font-semibold">
                  {fmtRangeDate(range.start)} – {fmtRangeDate(range.end)}
                  <span className="text-muted font-normal"> · {fmtInt(range.days)} days</span>
                </span>
              ) : (
                <span className="text-warn font-semibold">no visit dates detected</span>
              )}
            </div>
            <div className="text-xs text-muted">
              {fmtInt(range.total)} store visits
              {range.dated < range.total ? ` · ${fmtInt(range.total - range.dated)} without a date` : ''}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Stores Visited" value={fmtInt(summary.visits)} />
            <KpiCard label="In System" value={fmtPct(summary.authRate)} sub={`${fmtInt(summary.notAuthorized)} not auth`} />
            <KpiCard label="Merch Cost" value={fmtUsd(totals.merchCost)} />
            <KpiCard label="Incremental Profit" value={fmtUsd(totals.incrementalProfit)} accent={theme.good} />
            <KpiCard label="Net Profit" value={fmtUsd(totals.netProfit)} accent={signColor(totals.netProfit)} />
            <KpiCard label="Blended ROI" value={roiPct(totals.roi)} accent={signColor(totals.netProfit)} />
          </div>

          {/* Profitability by retailer */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-2 border-b border-ink-700">
              <div className="text-sm font-semibold">4. Profitability by retailer</div>
              <button
                className="btn text-xs"
                onClick={() =>
                  exportCsv(
                    'merchandising_profitability',
                    profit.map((r) => ({
                      Retailer: r.retailer,
                      Visits: r.visits,
                      'Auth %': (r.authRate * 100).toFixed(0),
                      'Cases Packed': r.casesPacked,
                      Displays: r.displays,
                      'Incremental Cases': r.incrementalCases,
                      'Merch Cost': r.merchCost.toFixed(2),
                      'Incremental Profit': r.incrementalProfit.toFixed(2),
                      'Net Profit': r.netProfit.toFixed(2),
                      'ROI %': r.roi == null ? '' : (r.roi * 100).toFixed(0),
                    })),
                  )
                }
              >
                ⤓ CSV
              </button>
            </div>
            <div className="overflow-auto max-h-[50vh]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-ink-800">
                  <tr>
                    <th className="th">Retailer</th>
                    <th className="th text-right">Visits</th>
                    <th className="th text-right">Auth%</th>
                    <th className="th text-right">Cases Packed</th>
                    <th className="th text-right">Displays</th>
                    <th className="th text-right">Inc. Cases</th>
                    <th className="th text-right">Merch Cost</th>
                    <th className="th text-right">Inc. Profit</th>
                    <th className="th text-right">Net</th>
                    <th className="th text-right">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {profit.map((r) => (
                    <ProfitRow key={r.retailer} r={r} />
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-ink-800 border-t-2 border-ink-600">
                  <tr className="font-semibold">
                    <td className="td">Total</td>
                    <td className="td text-right">{fmtInt(totals.visits)}</td>
                    <td className="td" />
                    <td className="td" />
                    <td className="td" />
                    <td className="td text-right">{fmtInt(totals.incrementalCases)}</td>
                    <td className="td text-right">{fmtUsd(totals.merchCost)}</td>
                    <td className="td text-right">{fmtUsd(totals.incrementalProfit)}</td>
                    <td className="td text-right" style={{ color: signColor(totals.netProfit) }}>
                      {fmtUsd(totals.netProfit)}
                    </td>
                    <td className="td text-right" style={{ color: signColor(totals.netProfit) }}>
                      {roiPct(totals.roi)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Store detail */}
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-ink-700">
              <div className="text-sm font-semibold">
                5. Store visits
                <span className="text-muted font-normal"> ({fmtInt(filtered.length)})</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted flex items-center gap-1.5">
                  <input type="checkbox" checked={onlyNotAuth} onChange={(e) => setOnlyNotAuth(e.target.checked)} />
                  Only not-authorized
                </label>
                <SelectFilter
                  label="Chain"
                  value={chain}
                  onChange={setChain}
                  options={uniqueValues(visits, (v) => v.chain || v.masterChain)}
                />
                <input
                  className="input w-44"
                  placeholder="Search store / notes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  className="btn text-xs"
                  onClick={() =>
                    exportCsv(
                      'merchandising_visits',
                      filtered.map((v) => ({
                        Store: v.store,
                        Address: v.address,
                        'Store ID': v.storeId,
                        Chain: v.chain,
                        'Visit Date': v.visitDate,
                        Authorized: v.authorized ? 'Yes' : 'No',
                        'Pack Out': v.packOut,
                        'Cases Packed': v.casesPacked,
                        Display: v.display,
                        Notes: v.notes,
                      })),
                    )
                  }
                >
                  ⤓ CSV
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[55vh]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-ink-800">
                  <tr>
                    <th className="th">Store</th>
                    <th className="th">Chain</th>
                    <th className="th">Visit</th>
                    <th className="th">Authorized</th>
                    <th className="th">Pack Out</th>
                    <th className="th">Display</th>
                    <th className="th">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <VisitRow key={v.key} v={v} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!hasData && (
        <EmptyState message="Paste your field-merchandising visit export to see profitability by retailer." />
      )}
    </div>
  )
}

function ProfitRow({ r }: { r: RetailerProfit }) {
  const color = r.roi == null ? undefined : signColor(r.netProfit)
  return (
    <tr className={r.netProfit < 0 ? 'bg-bad/5' : ''}>
      <td className="td font-medium">{r.retailer}</td>
      <td className="td text-right">{fmtInt(r.visits)}</td>
      <td className="td text-right">{fmtPct(r.authRate)}</td>
      <td className="td text-right">{fmtInt(r.casesPacked)}</td>
      <td className="td text-right">{fmtInt(r.displays)}</td>
      <td className="td text-right">{fmtInt(r.incrementalCases)}</td>
      <td className="td text-right text-muted">{fmtUsd(r.merchCost)}</td>
      <td className="td text-right">{fmtUsd(r.incrementalProfit)}</td>
      <td className="td text-right" style={{ color }}>{fmtUsd(r.netProfit)}</td>
      <td className="td text-right font-semibold" style={{ color }}>{roiPct(r.roi)}</td>
    </tr>
  )
}

function VisitRow({ v }: { v: StoreVisit }) {
  return (
    <tr className={!v.authorized ? 'bg-bad/5' : ''}>
      <td className="td">
        <div className="font-medium">{v.store || '—'}</div>
        {v.address && <div className="text-[11px] text-muted truncate max-w-[240px]">{v.address}</div>}
      </td>
      <td className="td text-muted">{v.chain || v.masterChain || '—'}</td>
      <td className="td text-muted whitespace-nowrap">{v.visitDate || '—'}</td>
      <td className="td">
        <Badge color={v.authorized ? theme.good : theme.bad}>
          {v.authorized ? '✓ In system' : '✗ Not authorized'}
        </Badge>
      </td>
      <td className="td">
        {v.packOut === '—' ? <span className="text-muted">—</span> : <Badge color={packColor(v.packOut)}>{v.packOut}</Badge>}
      </td>
      <td className="td">
        {v.display === '—' ? <span className="text-muted">—</span> : <Badge color={displayColor(v.display)}>{v.display}</Badge>}
      </td>
      <td className="td text-muted max-w-[220px] truncate" title={v.notes}>
        {v.notes || '—'}
      </td>
    </tr>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {children}
    </span>
  )
}

function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="text-xs text-muted flex flex-col gap-1">
      {label}
      <div className="flex items-center">
        <span className="px-2 py-1.5 bg-ink-900 border border-r-0 border-ink-500 rounded-l-md">$</span>
        <input
          type="number"
          min={0}
          step={0.01}
          className="input rounded-l-none w-full"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  )
}

function NumInput({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: string) => void; step?: number }) {
  return (
    <label className="text-xs text-muted flex flex-col gap-1">
      {label}
      <input type="number" min={0} step={step} className="input w-full" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
