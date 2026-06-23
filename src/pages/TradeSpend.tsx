import { useMemo } from 'react'
import {
  calcTradeSpend,
  DEFAULT_TRADE_INPUTS,
  type BrokerUnit,
  type PromoAllowance,
  type TradeSpendInputs,
  type Verdict,
} from '../lib/tradeSpend'
import { useLocalStorage } from '../lib/useLocalStorage'
import { TRADE_PROFIT_MARGIN } from '../config/methodology'
import { fmtUsd, fmtPct, MONTHS } from '../lib/format'
import { theme } from '../theme'

const VERDICT_STYLE: Record<Verdict, { color: string; icon: string; blurb: string }> = {
  Profitable: { color: theme.good, icon: '✓', blurb: 'Net margin clears the healthy threshold after all trade spend.' },
  Breakeven: { color: theme.warn, icon: '≈', blurb: 'Positive but thin — net margin is below the healthy threshold.' },
  'In the Red': { color: theme.bad, icon: '✕', blurb: 'Trade spend and COGS exceed forecasted sales. Net is negative.' },
}

export function TradeSpend() {
  const [inputs, setInputs] = useLocalStorage<TradeSpendInputs>(
    'trade_spend_inputs',
    DEFAULT_TRADE_INPUTS,
  )
  const r = useMemo(() => calcTradeSpend(inputs), [inputs])

  const setNum = (k: keyof TradeSpendInputs) => (v: string) =>
    setInputs((prev) => ({ ...prev, [k]: Number(v) || 0 }))

  const setPromo = (k: 'oi' | 'mcb' | 'tpr') => (p: PromoAllowance) =>
    setInputs((prev) => ({ ...prev, [k]: p }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Trade Spend Calculator</h1>
          <p className="text-sm text-muted">
            Model a deal's promotional and one-time spend against forecasted
            sales to gauge directional profitability.
          </p>
        </div>
        <button
          className="btn text-xs"
          onClick={() => setInputs(DEFAULT_TRADE_INPUTS)}
        >
          ↺ Reset
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- Inputs ---------- */}
        <div className="space-y-4">
          <section className="card p-3 space-y-3">
            <div className="text-sm font-semibold">Sales & COGS</div>
            <Money label="Forecasted annual sales" value={inputs.annualSales} onChange={setNum('annualSales')} />
            <Money label="Odyssey COGS (total $)" value={inputs.cogs} onChange={setNum('cogs')} />
          </section>

          <section className="card p-3 space-y-4">
            <div className="text-sm font-semibold">
              Promotional allowances
              <span className="text-muted font-normal"> (% of sales in selected months)</span>
            </div>
            <PromoRow label="O/I (Off-Invoice)" promo={inputs.oi} onChange={setPromo('oi')} />
            <PromoRow label="MCB (Bill-back)" promo={inputs.mcb} onChange={setPromo('mcb')} />
            <PromoRow label="TPR (Temp Price Reduction)" promo={inputs.tpr} onChange={setPromo('tpr')} />
          </section>

          <section className="card p-3 space-y-3">
            <div className="text-sm font-semibold">One-time & fixed spend</div>
            <Money label="One-time marketing spend" value={inputs.oneTimeMarketing} onChange={setNum('oneTimeMarketing')} />
            <Money label="Slotting fees" value={inputs.slotting} onChange={setNum('slotting')} />
            <Money label="Demo / merchandising spend" value={inputs.demoMerch} onChange={setNum('demoMerch')} />
            <BrokerRow
              value={inputs.broker}
              unit={inputs.brokerUnit}
              onValue={setNum('broker')}
              onUnit={(u) => setInputs((p) => ({ ...p, brokerUnit: u }))}
            />
            <Money label="Digital / retail media spend" value={inputs.digitalMedia} onChange={setNum('digitalMedia')} />
            <Money label="Other general bucket (one-time)" value={inputs.other} onChange={setNum('other')} />
          </section>
        </div>

        {/* ---------- Results ---------- */}
        <div className="space-y-4">
          {/* Directional profitability box */}
          <ProfitabilityBox result={r} />

          {/* Summary numbers */}
          <section className="card p-3 space-y-2">
            <div className="text-sm font-semibold">Summary</div>
            <Stat label="Forecasted sales" value={fmtUsd(inputs.annualSales)} />
            <Stat label="Gross profit (sales − COGS)" value={fmtUsd(r.grossProfit)} />
            <Stat
              label="Total trade spend"
              value={fmtUsd(r.totalTradeSpend)}
              sub={inputs.annualSales > 0 ? `${fmtPct(r.tradeSpendRate, 1)} of sales` : undefined}
            />
            <div className="border-t border-ink-700 my-1" />
            <Stat
              label="Net profit"
              value={fmtUsd(r.netProfit)}
              valueColor={r.netProfit >= 0 ? theme.good : theme.bad}
              sub={inputs.annualSales > 0 ? `${fmtPct(r.netMargin, 1)} net margin` : undefined}
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
                      {inputs.annualSales > 0 && li.amount > 0
                        ? fmtPct(li.amount / inputs.annualSales, 1)
                        : ''}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-ink-600 font-semibold">
                  <td className="td">Total trade spend</td>
                  <td className="td text-right">{fmtUsd(r.totalTradeSpend)}</td>
                  <td className="td text-right text-muted">
                    {inputs.annualSales > 0 ? fmtPct(r.tradeSpendRate, 1) : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Where the sales dollar goes */}
          {inputs.annualSales > 0 && <DollarBar result={r} sales={inputs.annualSales} cogs={inputs.cogs} />}
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
        <span className="px-2 py-1.5 bg-ink-900 border border-r-0 border-ink-500 rounded-l-md text-muted">$</span>
        <input
          type="number"
          min={0}
          step={100}
          className="input rounded-l-none w-40 text-right"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  )
}

function PromoRow({
  label,
  promo,
  onChange,
}: {
  label: string
  promo: PromoAllowance
  onChange: (p: PromoAllowance) => void
}) {
  const toggleMonth = (m: number) => {
    const has = promo.months.includes(m)
    onChange({
      ...promo,
      months: has ? promo.months.filter((x) => x !== m) : [...promo.months, m].sort((a, b) => a - b),
    })
  }
  const allOn = promo.months.length === 12
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <div className="flex items-center">
          <input
            type="number"
            min={0}
            step={0.5}
            className="input w-20 text-right"
            value={promo.ratePct}
            onChange={(e) => onChange({ ...promo, ratePct: Number(e.target.value) || 0 })}
          />
          <span className="px-2 py-1.5 bg-ink-900 border border-l-0 border-ink-500 rounded-r-md text-muted">%</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <div className="flex flex-wrap gap-1 flex-1">
          {MONTHS.map((mn, i) => {
            const m = i + 1
            const on = promo.months.includes(m)
            return (
              <button
                key={m}
                onClick={() => toggleMonth(m)}
                className={`text-[10px] w-7 py-0.5 rounded border ${
                  on ? 'bg-accent border-accent text-white' : 'border-ink-500 text-muted hover:text-text'
                }`}
              >
                {mn}
              </button>
            )
          })}
        </div>
        <button
          className="text-[10px] text-accent hover:underline px-1"
          onClick={() => onChange({ ...promo, months: allOn ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })}
        >
          {allOn ? 'Clear' : 'All'}
        </button>
      </div>
    </div>
  )
}

function BrokerRow({
  value,
  unit,
  onValue,
  onUnit,
}: {
  value: number
  unit: BrokerUnit
  onValue: (v: string) => void
  onUnit: (u: BrokerUnit) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">
        Broker fees
        <span className="text-[10px] text-warn"> · basis TBD</span>
      </span>
      <div className="flex items-center">
        {unit === 'usd' && (
          <span className="px-2 py-1.5 bg-ink-900 border border-r-0 border-ink-500 rounded-l-md text-muted">$</span>
        )}
        <input
          type="number"
          min={0}
          step={unit === 'pct' ? 0.5 : 100}
          className={`input w-28 text-right ${unit === 'usd' ? 'rounded-l-none' : 'rounded-r-none'}`}
          value={value}
          onChange={(e) => onValue(e.target.value)}
        />
        <select
          className="input rounded-l-none py-1.5"
          value={unit}
          onChange={(e) => onUnit(e.target.value as BrokerUnit)}
        >
          <option value="pct">% of sales</option>
          <option value="usd">$ flat</option>
        </select>
      </div>
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
