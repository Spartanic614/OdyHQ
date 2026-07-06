import { useMemo } from 'react'
import { useData } from '../data/store'
import { theme } from '../theme'
import { fmtInt } from '../lib/format'
import { TableSkeleton, ErrorBanner } from '../components/States'
import { channelGroup } from '../config/methodology'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function ExecutiveSummary() {
  const { chains, categoryReviews, loading } = useData()

  const metrics = useMemo(() => {
    const total = chains.rows.length
    const active = chains.rows.filter((c) => c.active === 'Active').length
    const inactive = chains.rows.filter((c) => c.active === 'Not Active').length
    const universe = chains.rows.reduce((sum, c) => sum + (c.total_universe ?? 0), 0)

    const scheduled = categoryReviews.rows.filter((cr) => cr.date_scheduled).length
    const pending = categoryReviews.rows.filter((cr) => cr.meeting_progress === 'Pending').length
    const declined = categoryReviews.rows.filter((cr) => cr.meeting_progress === 'Declined').length
    const completed = categoryReviews.rows.filter((cr) => cr.meeting_progress === 'Completed').length

    return {
      totalAccounts: total,
      activeAccounts: active,
      inactiveAccounts: inactive,
      activePct: total > 0 ? Math.round((active / total) * 100) : 0,
      totalUniverse: universe,
      scheduled,
      pending,
      declined,
      completed,
    }
  }, [chains.rows, categoryReviews.rows])

  const channelMetrics = useMemo(() => {
    const channels = new Map<string, { accounts: number; universe: number; active: number }>()

    chains.rows.forEach((c) => {
      const ch = channelGroup(c.channel) || 'Unknown'
      const existing = channels.get(ch) || { accounts: 0, universe: 0, active: 0 }
      existing.accounts++
      existing.universe += c.total_universe ?? 0
      if (c.active === 'Active') existing.active++
      channels.set(ch, existing)
    })

    return Array.from(channels.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        activePct: data.accounts > 0 ? Math.round((data.active / data.accounts) * 100) : 0,
      }))
      .sort((a, b) => b.universe - a.universe)
  }, [chains.rows])


  if (loading) return <TableSkeleton />
  if (chains.error) return <ErrorBanner table="dim_chain" message={chains.error} />

  return (
    <div className="space-y-6">
      {/* MACRO: High-level overview */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Portfolio Overview</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Accounts"
            value={metrics.totalAccounts}
            detail={`${fmtInt(metrics.totalUniverse)} outlets`}
            color={theme.info}
          />
          <StatCard label="Active" value={metrics.activeAccounts} detail={`${metrics.activePct}%`} color={theme.good} />
          <StatCard label="Inactive" value={metrics.inactiveAccounts} detail="at risk" color={theme.bad} />
          <StatCard label="Category Reviews" value={metrics.scheduled} detail="scheduled" color={theme.warn} />
        </div>
      </section>

      {/* Channel Breakdown */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">By Channel</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {channelMetrics.map((ch) => (
            <div key={ch.name} className="card p-4 space-y-3">
              <div className="font-semibold text-sm">{ch.name}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Total Chains</span>
                  <span className="font-medium">{ch.accounts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Our Chains</span>
                  <span className="font-medium" style={{ color: theme.good }}>
                    {ch.active}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Penetration</span>
                  <span className="font-semibold" style={{ color: theme.good }}>
                    {ch.activePct}%
                  </span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-muted text-xs">Outlets</span>
                  <span className="font-medium text-xs">{fmtInt(ch.universe)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Charts Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Analytics Dashboard</h2>
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
          {/* Channel Breakdown Bar Chart */}
          <div className="card p-4">
            <div className="text-sm font-semibold mb-3">Accounts by Channel</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={channelMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
                <XAxis dataKey="name" stroke={theme.textMuted} style={{ fontSize: '12px' }} />
                <YAxis stroke={theme.textMuted} style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#13161b', border: `1px solid ${theme.border}` }}
                  labelStyle={{ color: theme.text }}
                />
                <Bar dataKey="accounts" fill={theme.good} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active vs Inactive Pie Chart */}
          <div className="card p-4">
            <div className="text-sm font-semibold mb-3">Status Distribution</div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active', value: metrics.activeAccounts },
                    { name: 'Inactive', value: metrics.inactiveAccounts },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill={theme.good} />
                  <Cell fill={theme.bad} />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#13161b', border: `1px solid ${theme.border}` }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Penetration by Channel */}
          <div className="card p-4">
            <div className="text-sm font-semibold mb-3">Channel Penetration</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={channelMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
                <XAxis dataKey="name" stroke={theme.textMuted} style={{ fontSize: '12px' }} />
                <YAxis stroke={theme.textMuted} style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#13161b', border: `1px solid ${theme.border}` }}
                  labelStyle={{ color: theme.text }}
                  formatter={(value) => `${value}%`}
                />
                <Bar dataKey="activePct" fill={theme.accent} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: number | string
  detail: string
  color?: string
}) {
  return (
    <div className="card p-4 space-y-2">
      <div className="text-xs text-muted uppercase tracking-wider font-semibold">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs" style={{ color: color || theme.textMuted }}>
          {detail}
        </div>
      </div>
    </div>
  )
}
