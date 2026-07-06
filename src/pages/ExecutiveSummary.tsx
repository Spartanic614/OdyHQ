import { useMemo, useState } from 'react'
import { useData } from '../data/store'
import { theme, tierColors } from '../theme'
import { fmtInt } from '../lib/format'
import { TableSkeleton, ErrorBanner } from '../components/States'
import { channelGroup } from '../config/methodology'

export function ExecutiveSummary() {
  const { chains, categoryReviews, loading } = useData()
  const [selectedManager, setSelectedManager] = useState<string | null>(null)

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

  const regionMetrics = useMemo(() => {
    const regions = new Map<string, { accounts: number; universe: number; active: number }>()

    chains.rows.forEach((c) => {
      const r = c.region || 'Unknown'
      const existing = regions.get(r) || { accounts: 0, universe: 0, active: 0 }
      existing.accounts++
      existing.universe += c.total_universe ?? 0
      if (c.active === 'Active') existing.active++
      regions.set(r, existing)
    })

    return Array.from(regions.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        activePct: data.accounts > 0 ? Math.round((data.active / data.accounts) * 100) : 0,
      }))
      .sort((a, b) => b.accounts - a.accounts)
  }, [chains.rows])

  const managerMetrics = useMemo(() => {
    const managers = new Map<string, { accounts: number; universe: number; active: number }>()

    chains.rows.forEach((c) => {
      const m = c.account_manager || 'Unassigned'
      const existing = managers.get(m) || { accounts: 0, universe: 0, active: 0 }
      existing.accounts++
      existing.universe += c.total_universe ?? 0
      if (c.active === 'Active') existing.active++
      managers.set(m, existing)
    })

    return Array.from(managers.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        activePct: data.accounts > 0 ? Math.round((data.active / data.accounts) * 100) : 0,
      }))
      .sort((a, b) => b.universe - a.universe)
  }, [chains.rows])

  const highValueInactive = useMemo(() => {
    return chains.rows.filter((c) => c.active === 'Not Active' && (c.total_universe ?? 0) >= 1000).length
  }, [chains.rows])

  const noReviewScheduled = useMemo(() => {
    const scheduled = new Set(categoryReviews.rows.filter((cr) => cr.date_scheduled).map((cr) => cr.chain_id))
    return chains.rows.filter((c) => !scheduled.has(c.chain_id)).length
  }, [chains.rows, categoryReviews.rows])

  if (loading) return <TableSkeleton />
  if (chains.error) return <ErrorBanner table="dim_chain" message={chains.error} />

  // Show manager detail view if selected
  if (selectedManager) {
    return (
      <ManagerDetailView
        manager={selectedManager}
        chains={chains.rows}
        categoryReviews={categoryReviews.rows}
        onClose={() => setSelectedManager(null)}
      />
    )
  }

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

      {/* Regional Performance */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">By Region</h2>
        <div className="card p-4">
          <div className="space-y-3">
            {regionMetrics.map((region) => (
              <div key={region.name} className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <div className="font-semibold">{region.name}</div>
                  <div className="text-xs text-muted">{region.accounts} accts • {fmtInt(region.universe)} outlets</div>
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={region.activePct} color={theme.good} />
                  <span className="w-10 text-right font-medium">{region.activePct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manager Scorecard */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Account Manager Performance</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {managerMetrics.slice(0, 6).map((manager) => (
            <button
              key={manager.name}
              onClick={() => setSelectedManager(manager.name)}
              className="card p-4 space-y-3 hover:bg-white/10 transition-colors text-left"
            >
              <div className="font-semibold text-sm truncate">{manager.name}</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Accounts</span>
                  <span className="font-medium">{manager.accounts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Outlets</span>
                  <span className="font-medium">{fmtInt(manager.universe)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Active</span>
                  <span className="font-medium" style={{ color: theme.good }}>
                    {manager.activePct}%
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* MICRO: Specific actions and alerts */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Action Items</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <AlertCard
            title="High-Value Inactive"
            value={highValueInactive}
            description="+1,000 outlet accounts inactive"
            color={tierColors.A}
          />
          <AlertCard
            title="No Review Scheduled"
            value={noReviewScheduled}
            description="accounts pending engagement"
            color={tierColors.B}
          />
          <AlertCard
            title="Meetings Pending"
            value={metrics.pending}
            description="awaiting confirmation"
            color={theme.warn}
          />
          <AlertCard title="Declined Reviews" value={metrics.declined} description="follow-up needed" color={theme.bad} />
        </div>
      </section>

      {/* Review Pipeline */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Category Review Pipeline</h2>
        <div className="card p-4">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <PipelineStage label="Scheduled" value={metrics.scheduled} color={theme.good} />
            <PipelineStage label="Pending" value={metrics.pending} color={theme.warn} />
            <PipelineStage label="Completed" value={metrics.completed} color={theme.info} />
            <PipelineStage label="Declined" value={metrics.declined} color={theme.bad} />
          </div>
        </div>
      </section>
    </div>
  )
}

interface ManagerDetailViewProps {
  manager: string
  chains: any[]
  categoryReviews: any[]
  onClose: () => void
}

function ManagerDetailView({ manager, chains, categoryReviews, onClose }: ManagerDetailViewProps) {
  const managerChains = useMemo(() => chains.filter((c) => c.account_manager === manager), [chains, manager])

  const top5Active = useMemo(() => {
    return managerChains
      .filter((c) => c.active === 'Active')
      .sort((a, b) => (b.total_universe ?? 0) - (a.total_universe ?? 0))
      .slice(0, 5)
  }, [managerChains])

  const mostWanted = useMemo(() => {
    return managerChains
      .filter((c) => c.active === 'Not Active' && (!c.distributor || c.distributor.trim() === ''))
      .sort((a, b) => (b.total_universe ?? 0) - (a.total_universe ?? 0))
      .slice(0, 5)
  }, [managerChains])

  const noReviewYet = useMemo(() => {
    const reviewed = new Set(categoryReviews.map((cr) => cr.chain_id))
    return managerChains.filter((c) => !reviewed.has(c.chain_id))
  }, [managerChains, categoryReviews])

  const channelBreakdown = useMemo(() => {
    const channels = new Map<string, { count: number; outlets: number; active: number }>()
    managerChains.forEach((c) => {
      const ch = channelGroup(c.channel) || 'Unknown'
      const existing = channels.get(ch) || { count: 0, outlets: 0, active: 0 }
      existing.count++
      existing.outlets += c.total_universe ?? 0
      if (c.active === 'Active') existing.active++
      channels.set(ch, existing)
    })
    return Array.from(channels.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.outlets - a.outlets)
  }, [managerChains])

  const summary = useMemo(() => {
    const total = managerChains.length
    const active = managerChains.filter((c) => c.active === 'Active').length
    const outlets = managerChains.reduce((sum, c) => sum + (c.total_universe ?? 0), 0)
    const activeOutlets = managerChains
      .filter((c) => c.active === 'Active')
      .reduce((sum, c) => sum + (c.total_universe ?? 0), 0)
    const topChannel = channelBreakdown[0]

    return {
      totalAccounts: total,
      activeAccounts: active,
      inactiveAccounts: total - active,
      totalOutlets: outlets,
      activeOutlets,
      activePct: total > 0 ? Math.round((active / total) * 100) : 0,
      topChannel: topChannel?.name || 'N/A',
      topChannelOutlets: topChannel?.outlets || 0,
    }
  }, [managerChains, channelBreakdown])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between sticky top-0 bg-gradient-to-b from-[#0a0c0f] to-transparent pb-4 z-10">
        <h1 className="text-2xl font-semibold text-text">{manager}</h1>
        <button
          onClick={onClose}
          className="btn text-sm"
        >
          ← Back
        </button>
      </div>

      {/* Business Summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Business Summary</h2>
        <div className="card p-4 space-y-4">
          <p className="text-sm text-muted">
            {manager} manages <span className="font-semibold text-text">{summary.totalAccounts} accounts</span> across{' '}
            <span className="font-semibold text-text">{fmtInt(summary.totalOutlets)} outlets</span>. Currently active in{' '}
            <span style={{ color: theme.good }} className="font-semibold">
              {summary.activeAccounts} chains ({summary.activePct}%)
            </span>
            , with <span className="font-semibold">{summary.inactiveAccounts}</span> inactive opportunities. The portfolio
            is dominated by <span className="font-semibold">{summary.topChannel}</span> with{' '}
            <span className="font-semibold">{fmtInt(summary.topChannelOutlets)}</span> outlets.
          </p>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Kpi label="Total Accounts" value={summary.totalAccounts} />
            <Kpi label="Active" value={summary.activeAccounts} color={theme.good} />
            <Kpi label="Inactive" value={summary.inactiveAccounts} color={theme.bad} />
            <Kpi label="Total Outlets" value={fmtInt(summary.totalOutlets)} />
          </div>
        </div>
      </section>

      {/* Top 5 Active Accounts */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Top 5 Active Accounts (by Outlets)</h2>
        <div className="card overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-ink-800">
                <tr>
                  <th className="th">Chain</th>
                  <th className="th text-right">Outlets</th>
                  <th className="th">Region</th>
                  <th className="th">Channel</th>
                </tr>
              </thead>
              <tbody>
                {top5Active.length > 0 ? (
                  top5Active.map((c) => (
                    <tr key={c.chain_id} className="bg-good/5">
                      <td className="td font-medium">{c.chain_name || c.chain_id}</td>
                      <td className="td text-right font-semibold">{fmtInt(c.total_universe ?? 0)}</td>
                      <td className="td text-muted">{c.region}</td>
                      <td className="td text-muted">{c.channel}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="td text-muted" colSpan={4}>
                      No active accounts
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Most Wanted Accounts */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Most Wanted Accounts (Top 5 Inactive, No Distribution)</h2>
        <div className="card overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-ink-800">
                <tr>
                  <th className="th">Chain</th>
                  <th className="th text-right">Outlets</th>
                  <th className="th">Region</th>
                  <th className="th">Channel</th>
                </tr>
              </thead>
              <tbody>
                {mostWanted.length > 0 ? (
                  mostWanted.map((c) => (
                    <tr key={c.chain_id} className="bg-warn/5">
                      <td className="td font-medium">{c.chain_name || c.chain_id}</td>
                      <td className="td text-right font-semibold">{fmtInt(c.total_universe ?? 0)}</td>
                      <td className="td text-muted">{c.region}</td>
                      <td className="td text-muted">{c.channel}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="td text-muted" colSpan={4}>
                      No high-value inactive accounts
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* No Review Yet */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Accounts Without Category Reviews</h2>
        <div className="card overflow-hidden">
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-ink-800">
                <tr>
                  <th className="th">Chain</th>
                  <th className="th text-right">Outlets</th>
                  <th className="th">Status</th>
                  <th className="th">Channel</th>
                </tr>
              </thead>
              <tbody>
                {noReviewYet.length > 0 ? (
                  noReviewYet.map((c) => (
                    <tr key={c.chain_id}>
                      <td className="td font-medium">{c.chain_name || c.chain_id}</td>
                      <td className="td text-right">{fmtInt(c.total_universe ?? 0)}</td>
                      <td className="td">
                        <span style={{ color: c.active === 'Active' ? theme.good : theme.bad }}>
                          {c.active}
                        </span>
                      </td>
                      <td className="td text-muted">{c.channel}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="td text-muted" colSpan={4}>
                      All accounts have category reviews scheduled or completed! 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Channel Breakdown */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Portfolio by Channel</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {channelBreakdown.map((ch) => (
            <div key={ch.name} className="card p-4 space-y-2">
              <div className="font-semibold text-sm">{ch.name}</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Accounts</span>
                  <span className="font-medium">{ch.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Outlets</span>
                  <span className="font-medium">{fmtInt(ch.outlets)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Active</span>
                  <span className="font-medium" style={{ color: theme.good }}>
                    {ch.active}
                  </span>
                </div>
              </div>
            </div>
          ))}
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

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 max-w-[120px]">
      <div className="w-full h-2 bg-white/5 rounded overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function AlertCard({
  title,
  value,
  description,
  color,
}: {
  title: string
  value: number
  description: string
  color: string
}) {
  return (
    <div className="card p-4 space-y-2" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="text-xs text-muted uppercase tracking-wider font-semibold">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted">{description}</div>
    </div>
  )
}

function PipelineStage({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center space-y-2">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
