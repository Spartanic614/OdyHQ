import { useMemo } from 'react'
import {
  calcMargin,
  DEFAULT_MARGIN_INPUT,
  type Basis,
  type MarginInput,
} from '../lib/margin'
import { useLocalStorage } from '../lib/useLocalStorage'
import { fmtUsd, fmtPct } from '../lib/format'
import { theme } from '../theme'

export function Margin() {
  const [input, setInput] = useLocalStorage<MarginInput>(
    'margin_input',
    DEFAULT_MARGIN_INPUT,
  )
  const r = useMemo(() => calcMargin(input), [input])

  const set = (k: keyof MarginInput) => (v: number) =>
    setInput((prev) => ({ ...prev, [k]: v }))

  const marginColor =
    r.marginPct == null ? theme.textMuted : r.marginPct >= 0 ? theme.good : theme.bad
  const basisLabel = input.basis === 'unit' ? 'unit' : 'case'

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Margin Calculator</h1>
        <p className="text-sm text-muted">
          Enter cost and price to see gross margin, markup, and profit — per
          unit or per case.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Inputs */}
        <section className="card p-4 space-y-4">
          <div className="space-y-1.5">
            <div className="text-xs uppercase tracking-wide text-muted">Basis</div>
            <Segmented
              value={input.basis}
              onChange={(b) => setInput((p) => ({ ...p, basis: b }))}
            />
          </div>

          <MoneyField
            label={`Cost (per ${basisLabel})`}
            value={input.cost}
            onChange={set('cost')}
          />
          <MoneyField
            label={`Price (per ${basisLabel})`}
            value={input.price}
            onChange={set('price')}
          />
          <NumField
            label="Units per case"
            value={input.unitsPerCase}
            onChange={set('unitsPerCase')}
            step={1}
          />
          <button
            className="btn text-xs"
            onClick={() => setInput(DEFAULT_MARGIN_INPUT)}
          >
            ↺ Reset
          </button>
        </section>

        {/* Headline result */}
        <section
          className="card p-5 flex flex-col items-center justify-center text-center"
          style={{ borderColor: `${marginColor}55`, backgroundColor: `${marginColor}10` }}
        >
          <div className="text-xs uppercase tracking-wide text-muted">
            Gross Margin
          </div>
          <div className="text-5xl font-bold mt-1" style={{ color: marginColor }}>
            {r.marginPct == null ? '—' : fmtPct(r.marginPct, 1)}
          </div>
          <div className="text-sm text-muted mt-2">
            Markup{' '}
            <span className="text-text font-medium">
              {r.markupPct == null ? '—' : fmtPct(r.markupPct, 1)}
            </span>
          </div>
          <div className="text-sm mt-1">
            Profit{' '}
            <span className="font-semibold" style={{ color: marginColor }}>
              {fmtUsd(input.basis === 'unit' ? r.profitUnit : r.profitCase)}
            </span>{' '}
            / {basisLabel}
          </div>
        </section>
      </div>

      {/* Cost → price composition bar */}
      {r.priceUnit > 0 && (
        <section className="card p-4 space-y-2">
          <div className="text-sm font-semibold">Price composition</div>
          <CompositionBar
            cost={input.basis === 'unit' ? r.costUnit : r.costCase}
            price={input.basis === 'unit' ? r.priceUnit : r.priceCase}
          />
        </section>
      )}

      {/* Per-unit / per-case breakdown */}
      <section className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-800">
            <tr>
              <th className="th">Metric</th>
              <th className="th text-right">Per Unit</th>
              <th className="th text-right">Per Case ({input.unitsPerCase})</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Cost" unit={fmtUsd(r.costUnit)} cs={fmtUsd(r.costCase)} />
            <Row label="Price" unit={fmtUsd(r.priceUnit)} cs={fmtUsd(r.priceCase)} />
            <Row
              label="Profit"
              unit={fmtUsd(r.profitUnit)}
              cs={fmtUsd(r.profitCase)}
              color={marginColor}
              bold
            />
            <Row
              label="Margin %"
              unit={r.marginPct == null ? '—' : fmtPct(r.marginPct, 1)}
              cs={r.marginPct == null ? '—' : fmtPct(r.marginPct, 1)}
            />
            <Row
              label="Markup %"
              unit={r.markupPct == null ? '—' : fmtPct(r.markupPct, 1)}
              cs={r.markupPct == null ? '—' : fmtPct(r.markupPct, 1)}
            />
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Segmented({
  value,
  onChange,
}: {
  value: Basis
  onChange: (b: Basis) => void
}) {
  const opts: { v: Basis; label: string }[] = [
    { v: 'unit', label: 'Per Unit' },
    { v: 'case', label: 'Per Case' },
  ]
  return (
    <div className="inline-flex p-0.5 rounded-lg border border-white/10 bg-white/5">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            value === o.v ? 'btn-accent' : 'text-muted hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function CompositionBar({ cost, price }: { cost: number; price: number }) {
  const profit = Math.max(0, price - cost)
  const total = Math.max(price, cost) || 1
  const segs = [
    { label: 'Cost', value: Math.min(cost, total), color: theme.neutral },
    { label: 'Profit', value: profit, color: theme.good },
  ].filter((s) => s.value > 0)
  const loss = price < cost
  return (
    <>
      <div className="flex h-5 rounded overflow-hidden">
        {loss ? (
          <div className="w-full" style={{ backgroundColor: theme.bad }} />
        ) : (
          segs.map((s) => (
            <div
              key={s.label}
              style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
              title={`${s.label}: ${fmtUsd(s.value)}`}
            />
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <Legend color={theme.neutral} label={`Cost ${fmtUsd(cost)}`} />
        {loss ? (
          <span style={{ color: theme.bad }}>
            Selling below cost ({fmtUsd(price - cost)})
          </span>
        ) : (
          <Legend color={theme.good} label={`Profit ${fmtUsd(profit)}`} />
        )}
        <span className="text-text">Price {fmtUsd(price)}</span>
      </div>
    </>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function Row({
  label,
  unit,
  cs,
  color,
  bold,
}: {
  label: string
  unit: string
  cs: string
  color?: string
  bold?: boolean
}) {
  return (
    <tr className="border-t border-white/5">
      <td className="td text-muted">{label}</td>
      <td className={`td text-right ${bold ? 'font-semibold' : ''}`} style={color ? { color } : undefined}>
        {unit}
      </td>
      <td className={`td text-right ${bold ? 'font-semibold' : ''}`} style={color ? { color } : undefined}>
        {cs}
      </td>
    </tr>
  )
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <div className="flex items-center">
        <span className="px-2.5 py-1.5 bg-ink-900 border border-r-0 border-white/10 rounded-l-lg text-muted">
          $
        </span>
        <input
          type="number"
          min={0}
          step={0.01}
          className="input rounded-l-none w-full text-right"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
      </div>
    </label>
  )
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type="number"
        min={1}
        step={step}
        className="input w-full text-right"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  )
}
