import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { theme } from '../theme'
import { fmtInt, fmtPct, MONTHS } from '../lib/format'
import { SkuCanImage, hasSkuCanArt, skuCanAspect } from '../components/SkuCan'

// ============================================================
// Mock data for a forward-looking Executive Summary concept.
// Every number on this page is illustrative — it exists to show
// what a multi-source volume/distribution rollup could look like,
// not to report real figures.
// ============================================================

type Channel = 'Large Format' | 'Small Format' | 'Natural' | 'Digital' | 'Wholesale'

interface VolumeSource {
  key: string
  label: string
  color: string
  channel: Channel
  ytd: number
  py: number
  distPct: number // ACV / coverage in that source's channel
  chainPct: number // share of that source's volume through chain (vs indy/owned)
  rating: number // weighted distributor performance score, 0-100
}

const SOURCES: VolumeSource[] = [
  { key: 'distributor', label: 'Distributor', color: '#9db4c9', channel: 'Large Format', ytd: 260_000, py: 250_000, distPct: 0.58, chainPct: 0.70, rating: 82 },
  { key: 'natural', label: 'Natural', color: '#79c2b0', channel: 'Natural', ytd: 145_000, py: 128_000, distPct: 0.71, chainPct: 0.45, rating: 76 },
  { key: 'retail', label: 'Retail', color: '#c6cdd6', channel: 'Large Format', ytd: 110_000, py: 112_000, distPct: 0.52, chainPct: 0.85, rating: 88 },
  { key: 'specialty', label: 'Specialty Distribution', color: '#6f8aa0', channel: 'Small Format', ytd: 95_000, py: 82_000, distPct: 0.63, chainPct: 0.40, rating: 71 },
  { key: 'indy_wholesale', label: 'Independent Wholesale', color: '#8f9aa8', channel: 'Wholesale', ytd: 78_000, py: 74_000, distPct: 0.41, chainPct: 0.20, rating: 64 },
  { key: 'amazon', label: 'Amazon', color: '#d4b58c', channel: 'Digital', ytd: 62_000, py: 48_000, distPct: 0.94, chainPct: 1.00, rating: 91 },
  { key: 'ecommerce', label: 'E-Commerce', color: '#b6a7c2', channel: 'Digital', ytd: 41_000, py: 34_000, distPct: 0.88, chainPct: 0.90, rating: 85 },
  { key: 'website', label: 'Website Direct', color: '#a7c4a0', channel: 'Digital', ytd: 28_000, py: 31_000, distPct: 1.00, chainPct: 1.00, rating: 95 },
  { key: 'tiktok', label: 'TikTok', color: '#22d3ee', channel: 'Digital', ytd: 19_000, py: 6_000, distPct: 0.35, chainPct: 1.00, rating: 69 },
]

const CHANNEL_COLOR: Record<Channel, string> = {
  'Large Format': '#9db4c9',
  'Small Format': '#6f8aa0',
  Natural: '#79c2b0',
  Digital: '#22d3ee',
  Wholesale: '#8f9aa8',
}

const CHAIN_PENETRATION_SOURCES = new Set(['distributor', 'natural', 'retail', 'specialty', 'indy_wholesale'])

const KEY_ACCOUNTS = [
  { name: 'Northgate Grocers', channel: 'Large Format' as Channel, ytd: 18_400, growth: 0.06 },
  { name: 'Cascade Co-op Markets', channel: 'Natural' as Channel, ytd: 12_100, growth: 0.14 },
  { name: 'Summit Club Warehouse', channel: 'Large Format' as Channel, ytd: 9_800, growth: -0.03 },
  { name: 'BrightAisle Wholesale', channel: 'Wholesale' as Channel, ytd: 7_200, growth: 0.09 },
  { name: 'Trailhead Specialty Foods', channel: 'Small Format' as Channel, ytd: 6_500, growth: 0.11 },
  { name: 'PeakStream Marketplace', channel: 'Digital' as Channel, ytd: 5_900, growth: 0.38 },
  { name: 'Coastal Fresh Markets', channel: 'Natural' as Channel, ytd: 4_800, growth: 0.22 },
  { name: 'Redwood Wholesale Club', channel: 'Wholesale' as Channel, ytd: 4_200, growth: -0.08 },
  { name: 'Union Square Grocers', channel: 'Large Format' as Channel, ytd: 3_900, growth: 0.05 },
  { name: 'Ivy League Co-op', channel: 'Small Format' as Channel, ytd: 3_400, growth: -0.15 },
]

const SEVERITY_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: theme.bad,
  medium: theme.warn,
  low: theme.good,
}

const INVENTORY_CALLOUTS: { location: string; sku: string; detail: string; severity: 'high' | 'medium' | 'low' }[] = [
  { location: 'Rocklin DC', sku: 'Tropical Breeze', detail: '4 days of cover — reorder now', severity: 'high' },
  { location: 'Independent Wholesale (DSD)', sku: 'Mandarin Orange', detail: 'Stockout risk within 6 days', severity: 'high' },
  { location: 'Ridgefield DC', sku: 'Blue Raspberry', detail: '9 days of cover — monitor', severity: 'medium' },
  { location: 'Chesterfield DC', sku: 'Pineapple Mango', detail: 'Overstocked — 11 weeks of cover', severity: 'low' },
]

const UPCOMING_REVIEWS = [
  { account: 'Northgate Grocers', date: 'Jul 14' },
  { account: 'Union Square Grocers', date: 'Jul 22' },
  { account: 'Redwood Wholesale Club', date: 'Aug 3' },
]

const TOP_DSDS = [
  { name: 'Timberline Beverage Co.', market: 'Pacific Northwest', volume: 8_400, distPct: 0.82 },
  { name: 'Bluegrass Direct', market: 'Kentucky / Tennessee', volume: 6_900, distPct: 0.76 },
  { name: 'Coastal Carolina Distributing', market: 'The Carolinas', volume: 6_200, distPct: 0.71 },
  { name: 'Prairie Sun Beverage', market: 'Upper Midwest', volume: 5_700, distPct: 0.68 },
  { name: 'Desert Ridge Distributors', market: 'Southwest', volume: 5_100, distPct: 0.64 },
  { name: 'Granite State Beverage', market: 'New England', volume: 4_600, distPct: 0.59 },
]

const SKUS = [
  { name: 'Pineapple Mango', share: 0.22, index: { 'Large Format': 1.3, Digital: 0.7 } as Partial<Record<Channel, number>> },
  { name: 'Blue Raspberry', share: 0.16, index: {} },
  { name: 'Pink Lemonade', share: 0.12, index: {} },
  { name: 'Strawberry Watermelon', share: 0.10, index: {} },
  { name: 'Dragon Fruit Lemonade', share: 0.11, index: { Wholesale: 1.3 } },
  { name: 'Blackberry Lemonade', share: 0.09, index: {} },
  { name: 'Passion Fruit Guava', share: 0.08, index: {} },
  { name: 'Tropical Breeze', share: 0.07, index: { Digital: 1.6, 'Large Format': 0.7 } },
  { name: 'Mandarin Orange', share: 0.05, index: { Natural: 1.5 } },
]

// Relative share of annual volume per month (sums to 1) — used to spread
// each source's YTD total into a monthly shape, and to project the
// remainder of the year at the same seasonal trend.
const SEASONALITY = [0.070, 0.068, 0.075, 0.078, 0.082, 0.088, 0.090, 0.086, 0.083, 0.082, 0.090, 0.108]
const sumSlice = (arr: number[], from: number, to: number) => arr.slice(from, to).reduce((a, b) => a + b, 0)

function daysInMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate()
}

// "Today" expressed as a fraction of the year's seasonal weight elapsed —
// i.e. how far through the year we are, weighted by typical monthly volume
// rather than raw days. Scaling YTD by 1/elapsedWeight gives a full-year
// pace estimate that's consistent with this year's actual trend so far.
function elapsedSeasonalWeight(now: Date) {
  const m = now.getMonth()
  const dim = daysInMonth(now.getFullYear(), m)
  return sumSlice(SEASONALITY, 0, m) + SEASONALITY[m] * (now.getDate() / dim)
}

function monthlyForSource(s: VolumeSource, elapsedWeight: number): number[] {
  const annualPace = elapsedWeight > 0 ? s.ytd / elapsedWeight : 0
  return SEASONALITY.map((w) => annualPace * w)
}

const round = (n: number) => Math.round(n)

export function DemoExecutiveSummary() {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(SOURCES.map((s) => s.key)))

  const toggle = (key: string) =>
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const active = useMemo(() => SOURCES.filter((s) => enabled.has(s.key)), [enabled])

  const totals = useMemo(() => {
    const ytd = active.reduce((sum, s) => sum + s.ytd, 0)
    const py = active.reduce((sum, s) => sum + s.py, 0)
    const growth = py > 0 ? ytd / py - 1 : 0
    const distPct = ytd > 0 ? active.reduce((sum, s) => sum + s.ytd * s.distPct, 0) / ytd : 0

    const penSources = active.filter((s) => CHAIN_PENETRATION_SOURCES.has(s.key))
    const penYtd = penSources.reduce((sum, s) => sum + s.ytd, 0)
    const penetration = penYtd > 0 ? penSources.reduce((sum, s) => sum + s.ytd * s.distPct, 0) / penYtd : 0

    return { ytd, py, growth, distPct, penetration }
  }, [active])

  const byChannel = useMemo(() => {
    const map = new Map<Channel, { channel: Channel; ytd: number; py: number; distWeighted: number }>()
    active.forEach((s) => {
      const cur = map.get(s.channel) || { channel: s.channel, ytd: 0, py: 0, distWeighted: 0 }
      cur.ytd += s.ytd
      cur.py += s.py
      cur.distWeighted += s.ytd * s.distPct
      map.set(s.channel, cur)
    })
    return Array.from(map.values())
      .map((c) => {
        const distPct = c.ytd > 0 ? c.distWeighted / c.ytd : 0
        return { ...c, distPct, distPctRounded: round(distPct * 100) }
      })
      .sort((a, b) => b.ytd - a.ytd)
  }, [active])

  const byDistributor = useMemo(
    () =>
      [...active]
        .sort((a, b) => b.ytd - a.ytd)
        .map((s) => ({ ...s, distPctRounded: round(s.distPct * 100) })),
    [active],
  )

  const forecast = useMemo(() => {
    const now = new Date()
    const currentMonthIdx = now.getMonth()
    const dayOfMonth = now.getDate()
    const dim = daysInMonth(now.getFullYear(), currentMonthIdx)
    const elapsedWeight = elapsedSeasonalWeight(now)

    const perSource = active.map((s) => monthlyForSource(s, elapsedWeight))
    const monthly = MONTHS.map((name, m) => {
      const value = perSource.reduce((sum, arr) => sum + arr[m], 0)
      const status = m < currentMonthIdx ? 'done' : m === currentMonthIdx ? 'today' : 'ahead'
      return { month: name, value: round(value), status }
    })

    const currentMonthTotal = monthly[currentMonthIdx].value
    const dailyRunRate = currentMonthTotal / dim
    const trendingActual = round(dailyRunRate * dayOfMonth)

    return {
      monthly,
      monthLabel: MONTHS[currentMonthIdx],
      dayOfMonth,
      daysInMonth: dim,
      trendingActual,
      dailyRunRate: round(dailyRunRate),
      currentMonthTotal,
    }
  }, [active])

  const driversAndDrags = useMemo(() => {
    const sorted = [...KEY_ACCOUNTS].sort((a, b) => b.growth - a.growth)
    const drivers = sorted.slice(0, 3)
    const drags = [...sorted].sort((a, b) => a.growth - b.growth).slice(0, 3)
    return { drivers, drags }
  }, [])

  const dailySummary = useMemo(() => {
    const growthWord = totals.growth >= 0 ? 'up' : 'down'
    const topDriver = driversAndDrags.drivers[0]
    const topDrag = driversAndDrags.drags[0]
    const parts = [
      `Volume is trending to ${fmtInt(forecast.currentMonthTotal)} units in ${forecast.monthLabel}, ${growthWord} ${fmtPct(Math.abs(totals.growth), 1)} vs PY.`,
    ]
    if (topDriver) parts.push(`${topDriver.name} leads growth at +${fmtPct(topDriver.growth, 0)},`)
    if (topDrag) parts.push(`while ${topDrag.name} is down ${fmtPct(Math.abs(topDrag.growth), 0)}.`)
    parts.push(
      `Distribution sits at ${fmtPct(totals.distPct, 0)} with ${fmtPct(totals.penetration, 0)} chain penetration.`,
    )
    return parts.join(' ')
  }, [totals, forecast, driversAndDrags])

  const skuPerformance = useMemo(() => {
    const channels = byChannel.map((c) => c.channel)
    const perSku = SKUS.map((sku) => {
      const byCh: Partial<Record<Channel, number>> = {}
      channels.forEach((ch) => {
        byCh[ch] = 0 // filled after normalization pass below
      })
      return { name: sku.name, share: sku.share, index: sku.index, byChannel: byCh, total: 0 }
    })

    channels.forEach((ch) => {
      const channelTotal = byChannel.find((c) => c.channel === ch)?.ytd ?? 0
      const weights = SKUS.map((sku) => sku.share * (sku.index[ch] ?? 1))
      const weightSum = weights.reduce((a, b) => a + b, 0) || 1
      perSku.forEach((row, i) => {
        row.byChannel[ch] = channelTotal * (weights[i] / weightSum)
        row.total += row.byChannel[ch] ?? 0
      })
    })

    return perSku.map((row) => ({ ...row, total: round(row.total) })).sort((a, b) => b.total - a.total)
  }, [byChannel])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Demo - Executive Summary</h1>
            <span
              className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full"
              style={{ color: theme.warn, backgroundColor: `${theme.warn}1a`, border: `1px solid ${theme.warn}55` }}
            >
              Sample Data
            </span>
          </div>
          <p className="text-sm text-muted">
            Concept view of a multi-source volume &amp; distribution rollup. Toggle sources below to see every
            number react live.
          </p>
        </div>
      </div>

      {/* Daily Summary / Action Items */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="card p-5 flex flex-col justify-center">
          <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">
            Daily Briefing —{' '}
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <p className="text-2xl md:text-3xl font-semibold leading-snug">{dailySummary}</p>
        </div>

        <div className="card p-4 space-y-4">
          <div>
            <div className="text-sm font-semibold mb-2">Inventory Callouts by DC/DSD</div>
            <div className="space-y-2">
              {INVENTORY_CALLOUTS.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: SEVERITY_COLOR[c.severity] }}
                  />
                  <div>
                    <span className="font-medium">{c.location}</span>
                    <span className="text-muted"> · {c.sku} — </span>
                    <span style={{ color: SEVERITY_COLOR[c.severity] }}>{c.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 pt-3">
            <div className="text-sm font-semibold mb-2">Upcoming Category Reviews</div>
            <div className="space-y-1.5">
              {UPCOMING_REVIEWS.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span>{r.account}</span>
                  <span className="text-muted font-medium">{r.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Source toggle */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted uppercase tracking-wide font-semibold pr-1">Volume Sources</span>
        {SOURCES.map((s) => {
          const on = enabled.has(s.key)
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-all"
              style={{
                borderColor: on ? s.color : theme.border,
                backgroundColor: on ? `${s.color}22` : 'transparent',
                color: on ? theme.text : theme.textMuted,
                opacity: on ? 1 : 0.55,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          )
        })}
        <div className="flex gap-2 ml-auto">
          <button className="btn text-xs" onClick={() => setEnabled(new Set(SOURCES.map((s) => s.key)))}>
            All
          </button>
          <button className="btn text-xs" onClick={() => setEnabled(new Set())}>
            None
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Volume (YTD)" value={fmtInt(totals.ytd)} detail={`PY ${fmtInt(totals.py)}`} color={theme.text} />
        <Stat
          label="YoY Growth"
          value={fmtPct(totals.growth, 1)}
          detail={totals.growth >= 0 ? 'ahead of PY' : 'behind PY'}
          color={totals.growth >= 0 ? theme.good : theme.bad}
        />
        <Stat label="Distribution" value={fmtPct(totals.distPct, 0)} detail="volume-weighted ACV" color={theme.info} />
        <Stat
          label="Chain Penetration"
          value={fmtPct(totals.penetration, 0)}
          detail="brick &amp; mortar sources"
          color={theme.accent}
        />
      </div>

      {/* Volume by Channel / Distributor */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Volume</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard title="Volume by Channel">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
                <XAxis dataKey="channel" stroke={theme.textMuted} style={{ fontSize: '11px' }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis stroke={theme.textMuted} style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtInt(v)} />
                <Bar dataKey="ytd" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="ytd" position="top" formatter={(v: number) => fmtInt(v)} style={{ fill: theme.text, fontSize: 11, fontWeight: 600 }} />
                  {byChannel.map((c) => (
                    <Cell key={c.channel} fill={CHANNEL_COLOR[c.channel]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Volume by Distributor">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byDistributor} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
                <XAxis type="number" stroke={theme.textMuted} style={{ fontSize: '11px' }} />
                <YAxis dataKey="label" type="category" stroke={theme.textMuted} style={{ fontSize: '11px' }} width={140} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtInt(v)} />
                <Bar dataKey="ytd" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                  <LabelList dataKey="ytd" position="right" formatter={(v: number) => fmtInt(v)} style={{ fill: theme.text, fontSize: 11, fontWeight: 600 }} />
                  {byDistributor.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                {forecast.monthLabel} {forecast.dayOfMonth} · Trending Actual
              </div>
              <div className="text-6xl font-extrabold leading-none mt-1" style={{ color: theme.good }}>
                {fmtInt(forecast.trendingActual)}
              </div>
              <div className="text-xs text-muted mt-2">
                Updates daily from trend · day {forecast.dayOfMonth} of {forecast.daysInMonth}
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Daily Run Rate</div>
                <div className="text-xl font-bold">{fmtInt(forecast.dailyRunRate)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">{forecast.monthLabel} Projected</div>
                <div className="text-xl font-bold">{fmtInt(forecast.currentMonthTotal)}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Monthly Forecast</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={forecast.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
                <XAxis dataKey="month" stroke={theme.textMuted} style={{ fontSize: '11px' }} />
                <YAxis stroke={theme.textMuted} style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtInt(v)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="value" position="top" formatter={(v: number) => fmtInt(v)} style={{ fill: theme.text, fontSize: 10, fontWeight: 600 }} />
                  {forecast.monthly.map((m, i) => (
                    <Cell
                      key={i}
                      fill={m.status === 'today' ? theme.good : theme.accent}
                      fillOpacity={m.status === 'done' ? 0.9 : m.status === 'today' ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="text-xs text-muted mt-1">
              Solid = completed months · bright = this month · faded = forecast
            </div>
          </div>
        </div>
      </section>

      {/* Distribution */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Distribution</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard title="Distribution by Channel">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
                <XAxis dataKey="channel" stroke={theme.textMuted} style={{ fontSize: '11px' }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis stroke={theme.textMuted} style={{ fontSize: '12px' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtPct(v / 100, 0)} />
                <Bar dataKey="distPctRounded" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                  <LabelList
                    dataKey="distPctRounded"
                    position="top"
                    formatter={(v: number) => `${v}%`}
                    style={{ fill: theme.text, fontSize: 11, fontWeight: 600 }}
                  />
                  {byChannel.map((c) => (
                    <Cell key={c.channel} fill={CHANNEL_COLOR[c.channel]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Distribution by Distributor">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDistributor} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
                <XAxis type="number" stroke={theme.textMuted} style={{ fontSize: '11px' }} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="label" type="category" stroke={theme.textMuted} style={{ fontSize: '11px' }} width={140} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtPct(v / 100, 0)} />
                <Bar dataKey="distPctRounded" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                  <LabelList
                    dataKey="distPctRounded"
                    position="right"
                    formatter={(v: number) => `${v}%`}
                    style={{ fill: theme.text, fontSize: 11, fontWeight: 600 }}
                  />
                  {byDistributor.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="card p-4 space-y-3">
          <div className="text-sm font-semibold">Top Performing DSDs</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted">
                <th className="text-left font-medium pb-1.5">DSD</th>
                <th className="text-left font-medium pb-1.5">Independent Market</th>
                <th className="text-right font-medium pb-1.5">Volume</th>
                <th className="text-right font-medium pb-1.5">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {TOP_DSDS.map((d) => (
                <tr key={d.name} className="border-t border-white/5">
                  <td className="py-1.5 font-medium">{d.name}</td>
                  <td className="py-1.5 text-muted">{d.market}</td>
                  <td className="py-1.5 text-right font-medium">{fmtInt(d.volume)}</td>
                  <td className="py-1.5 text-right font-semibold" style={{ color: theme.info }}>
                    {fmtPct(d.distPct, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Key Accounts / Drivers & Drags */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Accounts</h2>
        <div className="card p-4 space-y-3">
          <div className="text-sm font-semibold">Key Accounts (Top 10)</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted">
                <th className="text-left font-medium pb-1.5">Account</th>
                <th className="text-left font-medium pb-1.5">Channel</th>
                <th className="text-right font-medium pb-1.5">Volume</th>
                <th className="text-right font-medium pb-1.5">Growth</th>
              </tr>
            </thead>
            <tbody>
              {KEY_ACCOUNTS.map((a) => (
                <tr key={a.name} className="border-t border-white/5">
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5 text-muted">{a.channel}</td>
                  <td className="py-1.5 text-right font-medium">{fmtInt(a.ytd)}</td>
                  <td className="py-1.5 text-right font-semibold" style={{ color: a.growth >= 0 ? theme.good : theme.bad }}>
                    {a.growth >= 0 ? '+' : ''}
                    {fmtPct(a.growth, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="card p-4 space-y-2">
            <div className="text-sm font-semibold" style={{ color: theme.good }}>
              ▲ Top Drivers
            </div>
            {driversAndDrags.drivers.map((a) => (
              <div key={a.name} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[a.channel] }} />
                  {a.name}
                </span>
                <span className="font-semibold" style={{ color: theme.good }}>
                  +{fmtPct(a.growth, 0)}
                </span>
              </div>
            ))}
          </div>
          <div className="card p-4 space-y-2">
            <div className="text-sm font-semibold" style={{ color: theme.bad }}>
              ▼ Top Drags
            </div>
            {driversAndDrags.drags.map((a) => (
              <div key={a.name} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[a.channel] }} />
                  {a.name}
                </span>
                <span className="font-semibold" style={{ color: a.growth >= 0 ? theme.textMuted : theme.bad }}>
                  {a.growth >= 0 ? '+' : ''}
                  {fmtPct(a.growth, 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SKU Performance */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">SKU Performance</h2>
        <div className="card p-4 space-y-3">
          <div className="text-sm font-semibold">Total</div>
          <div className="space-y-2.5">
            {skuPerformance.map((row) => {
              const maxTotal = skuPerformance[0]?.total || 1
              const pct = Math.max(0, Math.min(100, (row.total / maxTotal) * 100))
              return (
                <div key={row.name} className="flex items-center gap-3">
                  <div
                    className="relative rounded overflow-hidden border bg-black shrink-0"
                    style={{
                      width: 32,
                      aspectRatio: hasSkuCanArt(row.name) ? skuCanAspect(row.name) : '180 / 551',
                      borderColor: theme.border,
                      containerType: 'inline-size',
                    }}
                  >
                    {hasSkuCanArt(row.name) && <SkuCanImage flavor={row.name} dimmed={false} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="truncate">{row.name}</span>
                      <span className="font-semibold ml-2">{fmtInt(row.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: theme.accent }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

const tooltipStyle = { backgroundColor: '#13161b', border: `1px solid ${theme.border}`, fontSize: '12px' }

function Stat({ label, value, detail, color }: { label: string; value: string; detail: string; color?: string }) {
  return (
    <div className="card p-4 space-y-2">
      <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-2xl font-bold" style={{ color: color ?? theme.text }}>
          {value}
        </div>
        <div className="text-xs text-muted text-right">{detail}</div>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  )
}
