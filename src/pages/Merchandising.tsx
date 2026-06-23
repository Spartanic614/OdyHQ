import { useMemo, useState } from 'react'
import { parseTable } from '../lib/parseTable'
import {
  buildRetailerRoi,
  detectMerchColumns,
  DEFAULT_MERCH_INPUTS,
  marginPerCase,
  MERCH_FIELD_LABELS,
  MERCH_REQUIRED,
  summarize,
  type MerchColumnMap,
  type MerchField,
  type MerchInputs,
  type RetailerRoi,
} from '../lib/merchandising'
import { useLocalStorage } from '../lib/useLocalStorage'
import { KpiCard } from '../components/KpiCard'
import { EmptyState } from '../components/States'
import { exportCsv } from '../lib/csv'
import { fmtUsd, fmtInt } from '../lib/format'
import { theme } from '../theme'

const FIELD_ORDER: MerchField[] = [
  'retailer',
  'distributor',
  'oosCorrected',
  'voidsCorrected',
  'touches',
]

const roiPct = (roi: number | null) =>
  roi == null ? '—' : `${(roi * 100).toFixed(0)}%`

export function Merchandising() {
  const [inputs, setInputs] = useLocalStorage<MerchInputs>(
    'merch_inputs',
    DEFAULT_MERCH_INPUTS,
  )
  const [text, setText] = useState('')
  const [overrideMap, setOverrideMap] = useState<MerchColumnMap>({})

  const table = useMemo(() => parseTable(text), [text])
  const detected = useMemo(() => detectMerchColumns(table), [table])
  const map = useMemo<MerchColumnMap>(
    () => ({ ...detected, ...overrideMap }),
    [detected, overrideMap],
  )

  const rows = useMemo(
    () => buildRetailerRoi(table, map, inputs),
    [table, map, inputs],
  )
  const summary = useMemo(() => summarize(rows), [rows])

  const hasData = table.rows.length > 0
  const missingRequired = MERCH_REQUIRED.some((f) => map[f] == null)
  const margin = marginPerCase(inputs)

  const setNum = (k: keyof MerchInputs) => (v: string) =>
    setInputs((prev) => ({ ...prev, [k]: Number(v) || 0 }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Merchandising ROI Calculator</h1>
        <p className="text-sm text-muted">
          Import third-party merchandising results and see ROI per retailer —
          value of out-of-stocks & voids corrected vs. cost per touch.
        </p>
      </div>

      {/* Economic inputs (persisted on this device) */}
      <div className="card p-3 space-y-2">
        <div className="text-sm font-semibold">
          1. Economics
          <span className="text-muted font-normal"> (per case; saved on this device)</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MoneyInput label="Odyssey COGS / case" value={inputs.cogsPerCase} onChange={setNum('cogsPerCase')} />
          <MoneyInput label="Sell to KeHE/UNFI / case" value={inputs.sellPerCase} onChange={setNum('sellPerCase')} />
          <MoneyInput label="Merch cost / touch" value={inputs.costPerTouch} onChange={setNum('costPerTouch')} />
          <NumInput label="Cases per OOS fixed" value={inputs.casesPerOos} onChange={setNum('casesPerOos')} step={0.5} />
          <NumInput label="Cases per void fixed" value={inputs.casesPerVoid} onChange={setNum('casesPerVoid')} step={0.5} />
        </div>
        <div className="text-xs text-muted">
          Margin per case ={' '}
          <span style={{ color: margin >= 0 ? theme.good : theme.bad }}>
            {fmtUsd(margin)}
          </span>{' '}
          (sell − COGS). Each OOS corrected = {inputs.casesPerOos} case(s); each void
          corrected = {inputs.casesPerVoid} case(s).
        </div>
      </div>

      {/* Paste box */}
      <div className="card p-3 space-y-2">
        <div className="text-sm font-semibold">
          2. Paste merchandising data
          <span className="text-muted font-normal"> (include the header row)</span>
        </div>
        <textarea
          className="input w-full h-36 font-mono text-xs"
          placeholder={
            'Retailer\tDistributor\tOut-of-Stocks Corrected\tVoids Corrected\tTouches\n' +
            "Sprouts\tUNFI\t42\t11\t120\n" +
            "Erewhon\tKeHE\t8\t3\t24"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {/* Column mapping */}
      {hasData && (
        <div className="card p-3 space-y-2">
          <div className="text-sm font-semibold">
            3. Confirm columns
            <span className="text-muted font-normal"> (auto-detected — override if wrong)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FIELD_ORDER.map((field) => (
              <label key={field} className="text-xs text-muted flex flex-col gap-1">
                <span>
                  {MERCH_FIELD_LABELS[field]}
                  {MERCH_REQUIRED.includes(field) && (
                    <span className="text-bad"> *</span>
                  )}
                </span>
                <select
                  className="input"
                  value={map[field] ?? ''}
                  onChange={(e) =>
                    setOverrideMap((m) => ({
                      ...m,
                      [field]:
                        e.target.value === '' ? undefined : Number(e.target.value),
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
            <div className="text-xs text-bad">
              Map Retailer, OOS Corrected, Voids Corrected, and Touches to compute ROI.
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasData && !missingRequired && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Merch Spend" value={fmtUsd(summary.merchCost)} />
            <KpiCard label="Incremental Cases" value={fmtInt(summary.incrementalCases)} />
            <KpiCard label="Incremental Profit" value={fmtUsd(summary.incrementalProfit)} accent={theme.good} />
            <KpiCard
              label="Net Profit"
              value={fmtUsd(summary.netProfit)}
              accent={summary.netProfit >= 0 ? theme.good : theme.bad}
            />
            <KpiCard
              label="Blended ROI"
              value={roiPct(summary.roi)}
              accent={(summary.roi ?? 0) >= 0 ? theme.good : theme.bad}
            />
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-2 border-b border-ink-700">
              <div className="text-sm font-semibold">4. ROI by retailer</div>
              <button
                className="btn text-xs"
                onClick={() =>
                  exportCsv(
                    'merchandising_roi',
                    rows.map((r) => ({
                      Retailer: r.retailer,
                      Distributor: r.distributor,
                      'OOS Corrected': r.oosCorrected,
                      'Voids Corrected': r.voidsCorrected,
                      Touches: r.touches,
                      'Incremental Cases': r.incrementalCases,
                      'Incremental Profit': r.incrementalProfit.toFixed(2),
                      'Merch Cost': r.merchCost.toFixed(2),
                      'Net Profit': r.netProfit.toFixed(2),
                      'ROI %': r.roi == null ? '' : (r.roi * 100).toFixed(0),
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
                    <th className="th">Retailer</th>
                    <th className="th">Dist</th>
                    <th className="th text-right">OOS</th>
                    <th className="th text-right">Voids</th>
                    <th className="th text-right">Touches</th>
                    <th className="th text-right">Inc. Cases</th>
                    <th className="th text-right">Inc. Profit</th>
                    <th className="th text-right">Merch Cost</th>
                    <th className="th text-right">Net</th>
                    <th className="th text-right">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <RoiRow key={`${r.retailer}-${r.distributor}-${i}`} r={r} />
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-ink-800 border-t-2 border-ink-600">
                  <tr className="font-semibold">
                    <td className="td">Total</td>
                    <td className="td" />
                    <td className="td text-right">{fmtInt(rows.reduce((s, r) => s + r.oosCorrected, 0))}</td>
                    <td className="td text-right">{fmtInt(rows.reduce((s, r) => s + r.voidsCorrected, 0))}</td>
                    <td className="td text-right">{fmtInt(summary.touches)}</td>
                    <td className="td text-right">{fmtInt(summary.incrementalCases)}</td>
                    <td className="td text-right">{fmtUsd(summary.incrementalProfit)}</td>
                    <td className="td text-right">{fmtUsd(summary.merchCost)}</td>
                    <td className="td text-right" style={{ color: summary.netProfit >= 0 ? theme.good : theme.bad }}>
                      {fmtUsd(summary.netProfit)}
                    </td>
                    <td className="td text-right" style={{ color: (summary.roi ?? 0) >= 0 ? theme.good : theme.bad }}>
                      {roiPct(summary.roi)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          {margin <= 0 && (
            <div className="text-xs text-warn">
              Heads up: margin per case is {fmtUsd(margin)} — enter your COGS and
              sell price above for meaningful ROI.
            </div>
          )}
        </>
      )}

      {!hasData && (
        <EmptyState message="Enter your economics, then paste merchandising rows to see ROI." />
      )}
    </div>
  )
}

function RoiRow({ r }: { r: RetailerRoi }) {
  const color = r.roi == null ? undefined : r.roi >= 0 ? theme.good : theme.bad
  return (
    <tr className={r.roi != null && r.roi < 0 ? 'bg-bad/5' : ''}>
      <td className="td font-medium">{r.retailer}</td>
      <td className="td text-muted">{r.distributor || '—'}</td>
      <td className="td text-right">{fmtInt(r.oosCorrected)}</td>
      <td className="td text-right">{fmtInt(r.voidsCorrected)}</td>
      <td className="td text-right">{fmtInt(r.touches)}</td>
      <td className="td text-right">{fmtInt(r.incrementalCases)}</td>
      <td className="td text-right">{fmtUsd(r.incrementalProfit)}</td>
      <td className="td text-right">{fmtUsd(r.merchCost)}</td>
      <td className="td text-right" style={{ color }}>{fmtUsd(r.netProfit)}</td>
      <td className="td text-right font-semibold" style={{ color }}>
        {roiPct(r.roi)}
      </td>
    </tr>
  )
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: string) => void
}) {
  return (
    <label className="text-xs text-muted flex flex-col gap-1">
      {label}
      <div className="flex items-center">
        <span className="px-2 py-1.5 bg-ink-900 border border-r-0 border-ink-500 rounded-l-md">
          $
        </span>
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

function NumInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: string) => void
  step?: number
}) {
  return (
    <label className="text-xs text-muted flex flex-col gap-1">
      {label}
      <input
        type="number"
        min={0}
        step={step}
        className="input w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
