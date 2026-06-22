import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useData } from '../data/store'
import {
  useHitList,
  useOverviewKpis,
  useSkuOpportunities,
  useUnlockCandidates,
} from '../data/hooks'
import { KpiCard } from '../components/KpiCard'
import { CardSkeleton, TableSkeleton } from '../components/States'
import { fmtInt, fmtPct } from '../lib/format'
import { chartPalette, theme } from '../theme'
import { uniqueValues } from '../components/Filters'

export function Overview() {
  const { loading, dcs, chains } = useData()
  const kpis = useOverviewKpis()
  const hits = useHitList()
  const opps = useSkuOpportunities()
  const unlock = useUnlockCandidates()

  const volumeByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of dcs.rows) {
      const k = d.type ?? 'Unknown'
      m.set(k, (m.get(k) ?? 0) + (d.l52w_volume ?? 0))
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }))
  }, [dcs.rows])

  const channelMix = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of chains.rows) {
      const k = c.channel ?? 'Unknown'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }))
  }, [chains.rows])

  const regionSplit = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of chains.rows) {
      const k = c.region ?? 'Unknown'
      m.set(k, (m.get(k) ?? 0) + (c.total_universe ?? 0))
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }))
  }, [chains.rows])

  const topDcs = useMemo(
    () =>
      [...dcs.rows]
        .sort((a, b) => (b.l52w_volume ?? 0) - (a.l52w_volume ?? 0))
        .slice(0, 10)
        .map((d) => ({ name: d.dc_name ?? d.dc_code, value: d.l52w_volume ?? 0 })),
    [dcs.rows],
  )

  if (loading)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton />
      </div>
    )

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="TAM (Total Universe)" value={fmtInt(kpis.tam)} />
        <KpiCard label="L52W Volume" value={fmtInt(kpis.l52wVolume)} />
        <KpiCard label="Active DCs" value={fmtInt(kpis.activeDcs)} sub={`of ${dcs.rows.length}`} />
        <KpiCard
          label="SKU Auth Coverage"
          value={fmtPct(kpis.skuAuthCoveragePct)}
          accent={theme.good}
        />
        <KpiCard
          label="Chains Not Contacted"
          value={fmtInt(kpis.chainsNotContacted)}
          accent={theme.bad}
        />
        <KpiCard
          label="Unlock Candidates"
          value={fmtInt(kpis.unlockCandidates)}
          accent={theme.accent}
        />
      </div>

      {/* Action Center — three ranked top-5 lists with deep links */}
      <div className="grid gap-3 lg:grid-cols-3">
        <ActionList
          title="Biggest Not-Contacted Retailers"
          to="/accounts"
          items={hits.slice(0, 5).map((h) => ({
            label: h.name,
            value: fmtInt(h.size),
          }))}
        />
        <ActionList
          title="Biggest SKU Whitespace"
          subtitle="High-volume DC × Not Authorized"
          to="/distribution"
          items={opps.slice(0, 5).map((o) => ({
            label: `${o.dc.dc_name ?? o.dc.dc_code} · ${o.sku.flavor ?? o.sku.sku_code}`,
            value: fmtInt(o.weight),
          }))}
        />
        <ActionList
          title="Top DC Unlock Opportunities"
          to="/distribution"
          items={unlock.slice(0, 5).map((u) => ({
            label: u.dc.dc_name ?? u.dc.dc_code,
            value: u.newAtKehe ? 'New@KeHE' : u.status,
          }))}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Volume by Distributor Type">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={volumeByType}>
              <XAxis dataKey="name" tick={{ fill: theme.textMuted, fontSize: 11 }} />
              <YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff10' }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {volumeByType.map((_, i) => (
                  <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Channel Makeup (chains)">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={channelMix}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label={(e) => e.name}
              >
                {channelMix.map((_, i) => (
                  <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="TAM by Region">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={regionSplit}>
              <XAxis dataKey="name" tick={{ fill: theme.textMuted, fontSize: 11 }} />
              <YAxis tick={{ fill: theme.textMuted, fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff10' }} />
              <Bar dataKey="value" fill={theme.accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 DCs by Volume">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topDcs} layout="vertical" margin={{ left: 30 }}>
              <XAxis type="number" tick={{ fill: theme.textMuted, fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: theme.textMuted, fontSize: 10 }}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff10' }} />
              <Bar dataKey="value" fill={theme.good} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="text-xs text-muted">
        {uniqueValues(chains.rows, (c) => c.account_manager).length} account managers ·{' '}
        {dcs.rows.length} DCs · {chains.rows.length} chains tracked.
      </div>
    </div>
  )
}

const tooltipStyle = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  fontSize: 12,
  color: theme.text,
}

function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {children}
    </div>
  )
}

function ActionList({
  title,
  subtitle,
  to,
  items,
}: {
  title: string
  subtitle?: string
  to: string
  items: { label: string; value: string }[]
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
        </div>
        <Link to={to} className="text-xs text-accent hover:underline">
          View →
        </Link>
      </div>
      <ol className="mt-2 space-y-1">
        {items.length === 0 && (
          <li className="text-sm text-muted">Nothing flagged.</li>
        )}
        {items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">
              <span className="text-muted mr-1">{i + 1}.</span>
              {it.label}
            </span>
            <span className="font-medium shrink-0">{it.value}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
