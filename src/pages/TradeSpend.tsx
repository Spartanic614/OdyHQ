import { useMemo, useState } from 'react'
import {
  calcTradeSpend,
  DEFAULT_TRADE_INPUTS,
  skuAnnualCases,
  type TradeSpendInputs,
  type Verdict,
} from '../lib/tradeSpend'
import { exportTradeSpendPdf } from '../lib/tradeSpendPdf'
import { useLocalStorage } from '../lib/useLocalStorage'
import { TRADE_PROFIT_MARGIN } from '../config/methodology'
import { PORTFOLIO_SKUS } from '../config/skuPortfolio'
import { SkuCanImage, skuCanAspect } from '../components/SkuCan'
import { fmtUsd, fmtPct, fmtInt } from '../lib/format'
import { theme } from '../theme'

// Light-blue field styling — scoped to this page only, so inputs pop
// against the dark card backgrounds instead of blending in. no-spinner
// hides the number arrows: all values here are keyed in manually.
const FIELD_INPUT = 'no-spinner bg-sky-100 text-slate-900 border-sky-300 placeholder:text-slate-400'
const FIELD_ADORNMENT = 'bg-sky-100 border-sky-300 text-slate-600'

const VERDICT_STYLE: Record<Verdict, { color: string; icon: string; blurb: string }> = {
  Profitable: { color: theme.good, icon: '✓', blurb: 'Net margin clears the healthy threshold after all trade spend.' },
  Breakeven: { color: theme.warn, icon: '≈', blurb: 'Positive but thin — net margin is below the healthy threshold.' },
  'In the Red': { color: theme.bad, icon: '✕', blurb: 'Trade spend and COGS exceed forecasted sales. Net is negative.' },
}

export function TradeSpend() {
  const [inputs, setInputs] = useLocalStorage<TradeSpendInputs>(
    'trade_spend_inputs_v7',
    DEFAULT_TRADE_INPUTS,
  )
  const r = useMemo(() => calcTradeSpend(inputs), [inputs])
  const [exporting, setExporting] = useState(false)

  const exportPdf = async () => {
    setExporting(true)
    try {
      await exportTradeSpendPdf(inputs)
    } finally {
      setExporting(false)
    }
  }

  const setNum = (k: keyof TradeSpendInputs) => (v: string) =>
    setInputs((prev) => ({ ...prev, [k]: Number(v) || 0 }))

  const toggleSku = (flavor: string) =>
    setInputs((prev) => ({
      ...prev,
      slottingSkus: prev.slottingSkus.includes(flavor)
        ? prev.slottingSkus.filter((f) => f !== flavor)
        : [...prev.slottingSkus, flavor],
    }))

  const setSkuForecast = (flavor: string) => (v: string) =>
    setInputs((prev) => ({
      ...prev,
      skuForecast: { ...prev.skuForecast, [flavor]: Number(v) || 0 },
    }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Trade Spend Calculator</h1>
          <p className="text-sm text-muted">
            Model a deal's slotting fees and one-time spend against forecasted
            sales to gauge directional profitability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className={`input text-sm w-40 ${FIELD_INPUT}`}
            placeholder="Retailer name"
            value={inputs.retailer}
            onChange={(e) =>
              setInputs((p) => ({ ...p, retailer: e.target.value }))
            }
          />
          <input
            className={`input text-sm w-40 ${FIELD_INPUT}`}
            placeholder="Deal / campaign name"
            value={inputs.dealName}
            onChange={(e) =>
              setInputs((p) => ({ ...p, dealName: e.target.value }))
            }
          />
          <button
            className="btn btn-accent text-xs"
            onClick={exportPdf}
            disabled={exporting || r.sales <= 0}
            title={
              r.sales <= 0
                ? 'Enter forecasted cases and price/case first'
                : 'Export a PDF summary'
            }
          >
            {exporting ? 'Generating…' : '⤓ Export PDF'}
          </button>
          <button
            className="btn text-xs"
            onClick={() => setInputs(DEFAULT_TRADE_INPUTS)}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- Inputs ---------- */}
        <div className="space-y-4">
          <section className="card p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Forecasting</div>
              <div className="flex rounded overflow-hidden border border-ink-500">
                <button
                  className={`px-2 py-1 text-[11px] ${
                    inputs.forecastMode === 'sku' ? 'bg-accent text-white' : 'text-muted hover:text-text'
                  }`}
                  onClick={() => setInputs((p) => ({ ...p, forecastMode: 'sku' }))}
                >
                  By SKU
                </button>
                <button
                  className={`px-2 py-1 text-[11px] ${
                    inputs.forecastMode === 'manual' ? 'bg-accent text-white' : 'text-muted hover:text-text'
                  }`}
                  onClick={() => setInputs((p) => ({ ...p, forecastMode: 'manual' }))}
                >
                  Manual total
                </button>
              </div>
            </div>

            {inputs.forecastMode === 'sku' ? (
              <>
                <div className="text-xs text-muted">Units per store per week, by SKU</div>
                <div className="space-y-1.5">
                  {PORTFOLIO_SKUS.map((s, i) => {
                    const upw = inputs.skuForecast[s.flavor] || 0
                    const cases = skuAnnualCases(upw, inputs.outlets)
                    return (
                      <div key={s.flavor} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted text-xs truncate">{i + 1}. {s.flavor}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <NumInput
                            className={`input w-16 text-right ${FIELD_INPUT}`}
                            value={upw}
                            onChange={setSkuForecast(s.flavor)}
                          />
                          <span className="text-[10px] text-muted w-16 text-right">
                            {inputs.outlets > 0 ? `${fmtInt(cases)} cs` : '—'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {inputs.outlets === 0 && (
                  <div className="text-[11px] text-muted">Enter outlet count below to see the case forecast.</div>
                )}
              </>
            ) : (
              <Cases
                label="Forecasted annual sales (12-pk cases)"
                value={inputs.manualAnnualCases}
                onChange={setNum('manualAnnualCases')}
              />
            )}

            <div className="flex items-center justify-between text-sm font-semibold border-t border-white/10 pt-2">
              <span>Total annual forecast</span>
              <span>{fmtInt(r.annualCases)} cases</span>
            </div>
          </section>

          <section className="card p-3 space-y-3">
            <div className="text-sm font-semibold">Volume & economics</div>
            <Money label="Sell price / case" value={inputs.pricePerCase} onChange={setNum('pricePerCase')} />
            <Money label="COGS / case (12-pack)" value={inputs.cogsPerCase} onChange={setNum('cogsPerCase')} />
            <Cases label="Number of outlets" value={inputs.outlets} onChange={setNum('outlets')} />
            <div className="text-xs text-muted border-t border-white/10 pt-2">
              = <span className="text-text">{fmtUsd(r.sales)}</span> revenue ·{' '}
              <span className="text-text">{fmtUsd(r.cogs)}</span> COGS ·{' '}
              <span className="text-text">{fmtUsd(r.grossProfit)}</span> gross profit
            </div>
          </section>

          <section className="card p-3 space-y-3">
            <div className="text-sm font-semibold">Slotting fees</div>
            <Money label="Cost per SKU per store" value={inputs.slottingFeePerSku} onChange={setNum('slottingFeePerSku')} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">SKUs included</span>
                <button
                  className="text-[10px] text-accent hover:underline px-1"
                  onClick={() =>
                    setInputs((p) => ({
                      ...p,
                      slottingSkus: p.slottingSkus.length === PORTFOLIO_SKUS.length
                        ? []
                        : PORTFOLIO_SKUS.map((s) => s.flavor),
                    }))
                  }
                >
                  {inputs.slottingSkus.length === PORTFOLIO_SKUS.length ? 'Clear' : 'All'}
                </button>
              </div>
              {/* One row, cans share the card's full width evenly. */}
              <div className="flex gap-1.5">
                {PORTFOLIO_SKUS.map((s) => {
                  const on = inputs.slottingSkus.includes(s.flavor)
                  return (
                    <button
                      key={s.flavor}
                      onClick={() => toggleSku(s.flavor)}
                      title={`${s.flavor} — ${on ? 'included' : 'excluded'}`}
                      className="relative rounded overflow-hidden border bg-black flex-1 basis-0 min-w-0"
                      style={{
                        aspectRatio: skuCanAspect(s.flavor),
                        borderColor: on ? theme.accent : theme.border,
                        boxShadow: on ? `0 0 0 1px ${theme.accent}66` : undefined,
                        containerType: 'inline-size',
                      }}
                    >
                      <SkuCanImage flavor={s.flavor} dimmed={!on} />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="text-xs text-muted border-t border-white/10 pt-2">
              = <span className="text-text">{fmtUsd(r.slottingTotal)}</span> total ·{' '}
              {inputs.slottingSkus.length} SKU{inputs.slottingSkus.length === 1 ? '' : 's'} ×{' '}
              {fmtInt(inputs.outlets)} outlet{inputs.outlets === 1 ? '' : 's'} ×{' '}
              {fmtUsd(inputs.slottingFeePerSku)}
            </div>
            {inputs.outlets === 0 && (
              <div className="text-[11px] text-muted">Enter outlet count below to calculate the total.</div>
            )}
          </section>

          <section className="card p-3 space-y-3">
            <div className="text-sm font-semibold">One-time & fixed spend</div>
            <Money label="One-time marketing spend" value={inputs.oneTimeMarketing} onChange={setNum('oneTimeMarketing')} />
          </section>
        </div>

        {/* ---------- Results ---------- */}
        <div className="space-y-4">
          {/* Directional profitability box */}
          <ProfitabilityBox result={r} />

          {/* Summary numbers */}
          <section className="card p-3 space-y-2">
            <div className="text-sm font-semibold">Summary</div>
            <Stat
              label="Forecasted sales"
              value={fmtUsd(r.sales)}
              sub={
                r.annualCases > 0
                  ? `${fmtInt(r.annualCases)} cases × ${fmtUsd(inputs.pricePerCase)}`
                  : undefined
              }
            />
            <Stat label="Gross profit (sales − COGS)" value={fmtUsd(r.grossProfit)} />
            <Stat
              label="Total trade spend"
              value={fmtUsd(r.totalTradeSpend)}
              sub={r.sales > 0 ? `${fmtPct(r.tradeSpendRate, 1)} of sales` : undefined}
            />
            <Stat
              label="Spend per outlet"
              value={inputs.outlets > 0 ? fmtUsd(r.spendPerOutlet) : '—'}
              sub={inputs.outlets > 0 ? `${fmtUsd(r.totalTradeSpend)} ÷ ${fmtInt(inputs.outlets)} outlets` : 'Enter outlet count above'}
            />
            <div className="border-t border-ink-700 my-1" />
            <Stat
              label="Net profit"
              value={fmtUsd(r.netProfit)}
              valueColor={r.netProfit >= 0 ? theme.good : theme.bad}
              sub={r.sales > 0 ? `${fmtPct(r.netMargin, 1)} net margin` : undefined}
              bold
            />
          </section>

          {/* Spend breakdown */}
          <section className="card overflow-hidden">
            <div className="text-sm font-semibold p-3 pb-2">Spend breakdown</div>
            <table className="w-full text-sm">
              <tbody>
                {r.lineItems.map((li) => (
                  <tr key={li.key} className="border-t border-ink-700">
                    <td className="td">
                      {li.label}
                      {li.detail && li.amount > 0 && (
                        <span className="text-muted text-xs"> · {li.detail}</span>
                      )}
                    </td>
                    <td className="td text-right">{fmtUsd(li.amount)}</td>
                    <td className="td text-right text-muted w-16">
                      {r.sales > 0 && li.amount > 0
                        ? fmtPct(li.amount / r.sales, 1)
                        : ''}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink-600 font-semibold">
                  <td className="td">Total trade spend</td>
                  <td className="td text-right">{fmtUsd(r.totalTradeSpend)}</td>
                  <td className="td text-right text-muted">
                    {r.sales > 0 ? fmtPct(r.tradeSpendRate, 1) : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Where the sales dollar goes */}
          {r.sales > 0 && <DollarBar result={r} sales={r.sales} cogs={r.cogs} />}
        </div>
      </div>
    </div>
  )
}

// ---------------- Profitability box ----------------
function ProfitabilityBox({ result }: { result: ReturnType<typeof calcTradeSpend> }) {
  if (!result.verdict) {
    return (
      <div className="card p-5 text-center text-muted">
        Enter forecasted annual sales to see directional profitability.
      </div>
    )
  }
  const s = VERDICT_STYLE[result.verdict]
  return (
    <div
      className="card p-5 text-center"
      style={{ borderColor: s.color, backgroundColor: `${s.color}14` }}
    >
      <div className="text-xs uppercase tracking-wide text-muted">
        Directional profitability
      </div>
      <div className="text-3xl font-bold mt-1 flex items-center justify-center gap-2" style={{ color: s.color }}>
        <span>{s.icon}</span>
        {result.verdict}
      </div>
      <div className="mt-2 text-sm">
        Net profit{' '}
        <span className="font-semibold" style={{ color: s.color }}>
          {fmtUsd(result.netProfit)}
        </span>{' '}
        · {fmtPct(result.netMargin, 1)} net margin
      </div>
      <div className="text-xs text-muted mt-1">{s.blurb}</div>
      <div className="text-[11px] text-muted mt-2">
        Healthy threshold: {fmtPct(TRADE_PROFIT_MARGIN, 0)} net margin
      </div>
    </div>
  )
}

function DollarBar({
  result,
  sales,
  cogs,
}: {
  result: ReturnType<typeof calcTradeSpend>
  sales: number
  cogs: number
}) {
  const net = Math.max(0, result.netProfit)
  const segments = [
    { label: 'COGS', value: Math.min(cogs, sales), color: theme.neutral },
    { label: 'Trade spend', value: Math.min(result.totalTradeSpend, Math.max(0, sales - cogs)), color: theme.warn },
    { label: 'Net profit', value: net, color: theme.good },
  ].filter((s) => s.value > 0)
  const total = segments.reduce((s, x) => s + x.value, 0) || 1

  return (
    <section className="card p-3 space-y-2">
      <div className="text-sm font-semibold">Where each sales dollar goes</div>
      <div className="flex h-5 rounded overflow-hidden">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${fmtUsd(s.value)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: s.color }} />
            {s.label} {fmtPct(s.value / total, 0)}
          </span>
        ))}
        {result.netProfit < 0 && (
          <span style={{ color: theme.bad }}>Net loss {fmtUsd(result.netProfit)}</span>
        )}
      </div>
    </section>
  )
}

// ---------------- Input controls ----------------
// Numeric field rendered as type="text" (inputMode decimal): text inputs
// support select-on-focus (number inputs don't in Chrome) and have no
// spinner arrows — every value here is keyed in manually. A local draft
// string holds in-progress typing (e.g. a trailing ".") and snaps back
// to the canonical numeric value on blur.
function NumInput({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (v: string) => void
  className: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value))
        // Defer past the click's mouseup, which would otherwise collapse
        // the selection and drop the caret at the click position.
        const el = e.currentTarget
        setTimeout(() => el.select(), 0)
      }}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '')
        setDraft(raw)
        onChange(raw)
      }}
    />
  )
}

function Money({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <div className="flex items-center">
        <span className={`px-2 py-1.5 border border-r-0 rounded-l-md ${FIELD_ADORNMENT}`}>$</span>
        <NumInput
          className={`input rounded-l-none w-40 text-right ${FIELD_INPUT}`}
          value={value}
          onChange={onChange}
        />
      </div>
    </label>
  )
}

// Plain integer field (e.g. case count) — no $ adornment.
function Cases({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <NumInput className={`input w-40 text-right ${FIELD_INPUT}`} value={value} onChange={onChange} />
    </label>
  )
}

function Stat({
  label,
  value,
  sub,
  valueColor,
  bold,
}: {
  label: string
  value: string
  sub?: string
  valueColor?: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <div className="text-right">
        <div className={bold ? 'font-semibold text-base' : ''} style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
    </div>
  )
}
