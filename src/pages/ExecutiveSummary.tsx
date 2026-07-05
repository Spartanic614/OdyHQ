import { useMemo, useState } from 'react'
import { useData, type Chain, type CategoryReview } from '../data/store'
import { TableSkeleton, ErrorBanner } from '../components/States'
import { theme } from '../theme'

type FilterState = {
  region: string
  channel: string
  accountManager: string
  activeStatus: string
}

interface RegionalMetrics {
  region: string
  accounts: number
  universe: number
  active: number
  scheduledReviews: number
  pendingReviews: number
}

interface ManagerMetrics {
  manager: string
  accounts: number
  universe: number
  activePct: number
  scheduledReviews: number
  pendingReviews: number
  largestOpportunity: number
}

interface Alert {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
}

export function ExecutiveSummary() {
  const { chains, categoryReviews, loading } = useData()
  const [filters, setFilters] = useState<FilterState>({
    region: '',
    channel: '',
    accountManager: '',
    activeStatus: '',
  })

  const filteredChains = useMemo(() => {
    return chains.rows.filter((c) => {
      if (filters.region && c.region !== filters.region) return false
      if (filters.channel && c.channel !== filters.channel) return false
      if (filters.accountManager && c.account_manager !== filters.accountManager) return false
      if (filters.activeStatus && c.active !== filters.activeStatus) return false
      return true
    })
  }, [chains.rows, filters])

  const kpis = useMemo(() => {
    const total = filteredChains.length
    const active = filteredChains.filter((c) => c.active === 'Y').length
    const inactive = total - active
    const universe = filteredChains.reduce((sum, c) => sum + (c.total_universe ?? 0), 0)

    const categoryReviewsScheduled = categoryReviews.rows.filter(
      (cr) =>
        cr.date_scheduled &&
        filteredChains.some((c) => c.chain_id === cr.chain_id),
    ).length

    const meetingsPending = categoryReviews.rows.filter(
      (cr) =>
        cr.meeting_progress === 'Pending' &&
        filteredChains.some((c) => c.chain_id === cr.chain_id),
    ).length

    const declinedReviews = categoryReviews.rows.filter(
      (cr) =>
        cr.meeting_progress === 'Declined' &&
        filteredChains.some((c) => c.chain_id === cr.chain_id),
    ).length

    const completedReviews = categoryReviews.rows.filter(
      (cr) =>
        cr.meeting_progress === 'Completed' &&
        filteredChains.some((c) => c.chain_id === cr.chain_id),
    ).length

    return {
      totalAccounts: total,
      totalUniverse: universe,
      activeAccounts: active,
      inactiveAccounts: inactive,
      categoryReviewsScheduled,
      meetingsPending,
      declinedReviews,
      completedReviews,
      activePct: total > 0 ? Math.round((active / total) * 100) : 0,
      inactivePct: total > 0 ? Math.round((inactive / total) * 100) : 0,
    }
  }, [filteredChains, categoryReviews.rows])

  const channelBreakdown = useMemo(() => {
    const channels = new Map<string, { accounts: number; universe: number; active: number; inactive: number }>()

    filteredChains.forEach((c) => {
      const ch = c.channel || 'Unknown'
      const existing = channels.get(ch) || { accounts: 0, universe: 0, active: 0, inactive: 0 }
      existing.accounts++
      existing.universe += c.total_universe ?? 0
      if (c.active === 'Y') existing.active++
      else existing.inactive++
      channels.set(ch, existing)
    })

    return Array.from(channels.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        activePct: data.accounts > 0 ? Math.round((data.active / data.accounts) * 100) : 0,
      }))
      .sort((a, b) => b.universe - a.universe)
  }, [filteredChains])

  const regionalMetrics = useMemo(() => {
    const regions = new Map<string, RegionalMetrics>()

    filteredChains.forEach((c) => {
      const r = c.region || 'Unknown'
      const existing = regions.get(r) || {
        region: r,
        accounts: 0,
        universe: 0,
        active: 0,
        scheduledReviews: 0,
        pendingReviews: 0,
      }
      existing.accounts++
      existing.universe += c.total_universe ?? 0
      if (c.active === 'Y') existing.active++
      regions.set(r, existing)
    })

    categoryReviews.rows.forEach((cr) => {
      const chain = filteredChains.find((c) => c.chain_id === cr.chain_id)
      if (!chain) return
      const r = chain.region || 'Unknown'
      const existing = regions.get(r)
      if (existing) {
        if (cr.date_scheduled) existing.scheduledReviews++
        if (cr.meeting_progress === 'Pending') existing.pendingReviews++
      }
    })

    return Array.from(regions.values()).sort((a, b) => b.universe - a.universe)
  }, [filteredChains, categoryReviews.rows])

  const managerMetrics = useMemo(() => {
    const managers = new Map<string, ManagerMetrics>()

    filteredChains.forEach((c) => {
      const m = c.account_manager || 'Unassigned'
      const existing = managers.get(m) || {
        manager: m,
        accounts: 0,
        universe: 0,
        activePct: 0,
        scheduledReviews: 0,
        pendingReviews: 0,
        largestOpportunity: 0,
      }
      existing.accounts++
      existing.universe += c.total_universe ?? 0
      if (c.active === 'Y') existing.activePct++
      if ((c.total_universe ?? 0) > existing.largestOpportunity) {
        existing.largestOpportunity = c.total_universe ?? 0
      }
      managers.set(m, existing)
    })

    categoryReviews.rows.forEach((cr) => {
      const chain = filteredChains.find((c) => c.chain_id === cr.chain_id)
      if (!chain) return
      const m = chain.account_manager || 'Unassigned'
      const existing = managers.get(m)
      if (existing) {
        if (cr.date_scheduled) existing.scheduledReviews++
        if (cr.meeting_progress === 'Pending') existing.pendingReviews++
      }
    })

    return Array.from(managers.values()).map((m) => ({
      ...m,
      activePct: m.accounts > 0 ? Math.round((m.activePct / m.accounts) * 100) : 0,
    }))
  }, [filteredChains, categoryReviews.rows])

  const alerts = useMemo(() => {
    const alertsList: Alert[] = []

    // High-value inactive accounts
    const highValueInactive = filteredChains.filter(
      (c) => c.active !== 'Y' && (c.total_universe ?? 0) > 1000,
    )
    if (highValueInactive.length > 0) {
      alertsList.push({
        id: 'high-value-inactive',
        severity: 'high',
        title: `${highValueInactive.length} high-value accounts inactive`,
        description: `${highValueInactive.reduce((sum, c) => sum + (c.total_universe ?? 0), 0).toLocaleString()} doors at risk`,
      })
    }

    // Declined reviews
    const declined = categoryReviews.rows.filter(
      (cr) =>
        cr.meeting_progress === 'Declined' &&
        filteredChains.some((c) => c.chain_id === cr.chain_id),
    )
    if (declined.length > 0) {
      alertsList.push({
        id: 'declined-reviews',
        severity: 'high',
        title: `${declined.length} declined reviews`,
        description: 'Follow-up required on rejected category reviews',
      })
    }

    // Pending meetings
    const pending = categoryReviews.rows.filter(
      (cr) =>
        cr.meeting_progress === 'Pending' &&
        filteredChains.some((c) => c.chain_id === cr.chain_id),
    )
    if (pending.length > 10) {
      alertsList.push({
        id: 'pending-meetings',
        severity: 'medium',
        title: `${pending.length} meetings awaiting scheduling`,
        description: 'Move pending meetings to scheduled status',
      })
    }

    // No reviews scheduled in next 90 days
    const noneScheduled = filteredChains.filter(
      (c) =>
        !categoryReviews.rows.some(
          (cr) => cr.chain_id === c.chain_id && cr.date_scheduled,
        ),
    )
    if (noneScheduled.length > 5) {
      alertsList.push({
        id: 'no-scheduled-reviews',
        severity: 'medium',
        title: `${noneScheduled.length} accounts with no reviews scheduled`,
        description: 'Identify upcoming review opportunities',
      })
    }

    return alertsList
  }, [filteredChains, categoryReviews.rows])

  const largestOpportunities = useMemo(() => {
    return filteredChains
      .sort((a, b) => (b.total_universe ?? 0) - (a.total_universe ?? 0))
      .slice(0, 10)
  }, [filteredChains])

  const upcomingReviews = useMemo(() => {
    return categoryReviews.rows
      .filter((cr) => cr.date_scheduled && filteredChains.some((c) => c.chain_id === cr.chain_id))
      .map((cr) => {
        const chain = filteredChains.find((c) => c.chain_id === cr.chain_id)
        return {
          ...cr,
          chain,
          daysRemaining: Math.ceil(
            (new Date(cr.date_scheduled!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        }
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 8)
  }, [categoryReviews.rows, filteredChains])

  const filterOptions = useMemo(() => {
    return {
      regions: [...new Set(chains.rows.map((c) => c.region).filter(Boolean))].sort(),
      channels: [...new Set(chains.rows.map((c) => c.channel).filter(Boolean))].sort(),
      accountManagers: [...new Set(chains.rows.map((c) => c.account_manager).filter(Boolean))].sort(),
    }
  }, [chains.rows])

  if (loading) return <TableSkeleton />
  if (chains.error) return <ErrorBanner table="dim_chain" message={chains.error} />

  return (
    <div className="space-y-6 p-6">
      {/* Header & Narrative */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Executive Summary</h1>
        <div className="card p-4 bg-gradient-to-r from-accent/10 to-info/10 border border-accent/20">
          <p className="text-sm leading-relaxed">
            Odyssey currently manages <span className="font-semibold">{kpis.totalAccounts} national accounts</span> representing{' '}
            <span className="font-semibold">{kpis.totalUniverse.toLocaleString()} potential doors</span>. {kpis.activePct}% of accounts
            are active. <span className="font-semibold">{channelBreakdown[0]?.name}</span> drives the largest opportunity with{' '}
            <span className="font-semibold">{channelBreakdown[0]?.universe.toLocaleString()}</span> doors.{' '}
            <span className="font-semibold">{kpis.categoryReviewsScheduled}</span> category reviews are scheduled, while{' '}
            <span className="font-semibold">
              {filteredChains.filter((c) => c.active !== 'Y' && (c.total_universe ?? 0) > 1000).length}
            </span>{' '}
            high-value accounts ({'>'}1,000 doors) remain inactive—the greatest near-term growth opportunity.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="card p-3 border-l-4"
              style={{
                borderLeftColor: alert.severity === 'high' ? theme.bad : theme.warn,
                backgroundColor:
                  alert.severity === 'high' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(234, 179, 8, 0.05)',
              }}
            >
              <div className="font-semibold text-sm">{alert.title}</div>
              <div className="text-xs text-muted">{alert.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <select
          className="input py-1 text-sm"
          value={filters.region}
          onChange={(e) => setFilters({ ...filters, region: e.target.value })}
        >
          <option value="">All Regions</option>
          {filterOptions.regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          className="input py-1 text-sm"
          value={filters.channel}
          onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
        >
          <option value="">All Channels</option>
          {filterOptions.channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="input py-1 text-sm"
          value={filters.accountManager}
          onChange={(e) => setFilters({ ...filters, accountManager: e.target.value })}
        >
          <option value="">All Managers</option>
          {filterOptions.accountManagers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          className="input py-1 text-sm"
          value={filters.activeStatus}
          onChange={(e) => setFilters({ ...filters, activeStatus: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="Y">Active</option>
          <option value="N">Inactive</option>
        </select>

        <button
          onClick={() => setFilters({ region: '', channel: '', accountManager: '', activeStatus: '' })}
          className="text-xs text-muted hover:text-text ml-auto"
        >
          Clear Filters
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        <KpiCard label="Total Accounts" value={kpis.totalAccounts} />
        <KpiCard label="Total Universe" value={kpis.totalUniverse} suffix="Doors" />
        <KpiCard label="Active Accounts" value={kpis.activeAccounts} detail={`${kpis.activePct}%`} />
        <KpiCard label="Inactive Accounts" value={kpis.inactiveAccounts} detail={`${kpis.inactivePct}%`} />
        <KpiCard label="Reviews Scheduled" value={kpis.categoryReviewsScheduled} color={theme.info} />
        <KpiCard label="Meetings Pending" value={kpis.meetingsPending} color={theme.warn} />
        <KpiCard label="Declined Reviews" value={kpis.declinedReviews} color={theme.bad} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Active vs Inactive Donut */}
        <div className="card p-4 space-y-3">
          <div className="font-semibold text-sm">Active vs Inactive</div>
          <DonutChart
            data={[
              { name: 'Active', value: kpis.activeAccounts, color: theme.good },
              { name: 'Inactive', value: kpis.inactiveAccounts, color: '#4b5563' },
            ]}
            centerText={`${kpis.activePct}%\nActive`}
          />
        </div>

        {/* Channel Mix Donut */}
        <div className="card p-4 space-y-3">
          <div className="font-semibold text-sm">Channel Mix</div>
          <DonutChart
            data={channelBreakdown.map((c) => ({
              name: c.name,
              value: c.accounts,
              color: ['#10b981', '#3b82f6', '#f59e0b', '#6b7280'][
                channelBreakdown.indexOf(c) % 4
              ] as string,
            }))}
            centerText={`${kpis.totalAccounts}\nAccounts`}
          />
        </div>

        {/* Meeting Status Donut */}
        <div className="card p-4 space-y-3">
          <div className="font-semibold text-sm">Meeting Status</div>
          <DonutChart
            data={[
              { name: 'Scheduled', value: kpis.categoryReviewsScheduled, color: theme.good },
              { name: 'Pending', value: kpis.meetingsPending, color: theme.warn },
              { name: 'Declined', value: kpis.declinedReviews, color: theme.bad },
            ]}
            centerText={`${kpis.categoryReviewsScheduled + kpis.meetingsPending + kpis.declinedReviews}\nReviews`}
          />
        </div>
      </div>

      {/* Channel Breakdown */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Channel Breakdown</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {channelBreakdown.map((channel) => (
            <div key={channel.name} className="card p-4 space-y-3">
              <div className="font-semibold text-base">{channel.name}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Accounts</span>
                  <span className="font-medium">{channel.accounts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Universe</span>
                  <span className="font-medium">{channel.universe.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Active</span>
                  <span className="font-medium" style={{ color: theme.good }}>
                    {channel.active} ({channel.activePct}%)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regional Performance */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Regional Performance</h2>
        <div className="card p-4 space-y-3">
          {regionalMetrics.map((region) => (
            <div key={region.region} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <div className="font-semibold">{region.region}</div>
                <div className="text-xs text-muted">
                  {region.accounts} accts • {region.universe.toLocaleString()} doors • {Math.round((region.active / region.accounts) * 100)}% active
                </div>
              </div>
              <div className="flex gap-2 h-6">
                <div className="flex-1 bg-white/5 rounded relative overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(region.universe / (Math.max(...regionalMetrics.map((r) => r.universe)) || 1)) * 100}%`,
                      backgroundColor: theme.info,
                    }}
                  />
                </div>
                <div className="text-xs text-muted w-16 text-right py-1">
                  {region.scheduledReviews} scheduled, {region.pendingReviews} pending
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Pipeline Funnel</h2>
        <PipelineFunnel
          identified={kpis.totalAccounts}
          scheduled={kpis.categoryReviewsScheduled}
          pending={kpis.meetingsPending}
          declined={kpis.declinedReviews}
          completed={kpis.completedReviews}
        />
      </div>

      {/* Account Manager Scorecard */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Account Manager Scorecard</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {managerMetrics
            .sort((a, b) => b.universe - a.universe)
            .slice(0, 6)
            .map((manager) => (
              <div key={manager.manager} className="card p-4 space-y-3">
                <div className="font-semibold text-sm truncate">{manager.manager}</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Accounts</span>
                    <span className="font-medium">{manager.accounts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Universe</span>
                    <span className="font-medium">{manager.universe.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Active %</span>
                    <span className="font-medium" style={{ color: theme.good }}>
                      {manager.activePct}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Reviews Won</span>
                    <span className="font-medium">{manager.scheduledReviews}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Pending</span>
                    <span className="font-medium" style={{ color: theme.warn }}>
                      {manager.pendingReviews}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Largest Opportunities */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Largest Opportunities</h2>
        <div className="card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700">
                <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Chain</th>
                <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Channel</th>
                <th className="text-right py-2 px-2 text-xs text-muted font-semibold">Universe</th>
                <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Status</th>
                <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Region</th>
              </tr>
            </thead>
            <tbody>
              {largestOpportunities.map((chain) => (
                <tr
                  key={chain.chain_id}
                  className={`border-b border-ink-700 hover:bg-white/5 ${
                    chain.active !== 'Y' && (chain.total_universe ?? 0) > 1000 ? 'bg-red-950/20' : ''
                  }`}
                >
                  <td className="py-2 px-2">{chain.chain_name}</td>
                  <td className="py-2 px-2 text-muted text-xs">{chain.channel}</td>
                  <td className="py-2 px-2 text-right font-medium">{(chain.total_universe ?? 0).toLocaleString()}</td>
                  <td className="py-2 px-2">
                    <span style={{ color: chain.active === 'Y' ? theme.good : theme.bad }}>
                      {chain.active === 'Y' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-muted text-xs">{chain.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Reviews */}
      {upcomingReviews.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Upcoming Category Reviews</h2>
          <div className="card p-4">
            <div className="space-y-3">
              {upcomingReviews.map((review) => (
                <div
                  key={`${review.chain_id}`}
                  className="flex items-center justify-between p-3 bg-white/5 rounded border border-ink-700"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-sm">{review.chain?.chain_name}</div>
                    <div className="text-xs text-muted">
                      {review.chain?.region} • {review.chain?.channel}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="font-medium">{new Date(review.date_scheduled!).toLocaleDateString()}</div>
                      <div className="text-xs text-muted">{review.daysRemaining} days away</div>
                    </div>
                    <div
                      className="w-12 h-8 rounded flex items-center justify-center text-xs font-semibold"
                      style={{
                        backgroundColor:
                          review.meeting_progress === 'Scheduled' ? `${theme.good}20` : `${theme.warn}20`,
                        color:
                          review.meeting_progress === 'Scheduled' ? theme.good : theme.warn,
                      }}
                    >
                      {review.meeting_progress === 'Scheduled' ? '✓' : '⧗'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  suffix,
  detail,
  color,
}: {
  label: string
  value: number
  suffix?: string
  detail?: string
  color?: string
}) {
  return (
    <div className="card p-4 space-y-2">
      <div className="text-xs text-muted font-semibold uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold`} style={color ? { color } : {}}>
        {value.toLocaleString()}
      </div>
      {suffix && <div className="text-xs text-muted">{suffix}</div>}
      {detail && <div className="text-sm font-medium" style={{ color: theme.info }}>{detail}</div>}
    </div>
  )
}

function DonutChart({
  data,
  centerText,
}: {
  data: Array<{ name: string; value: number; color: string }>
  centerText: string
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = 40
  const circumference = 2 * Math.PI * radius

  let cumulativeValue = 0
  const segments = data.map((d) => {
    const percentage = d.value / total
    const strokeDashoffset = circumference * (1 - percentage)
    const rotation = (cumulativeValue / total) * 360
    cumulativeValue += d.value
    return { ...d, strokeDashoffset, rotation }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#1f2937" strokeWidth="20" />
        {segments.map((segment, i) => (
          <circle
            key={i}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="20"
            strokeDasharray={circumference * (segment.value / total)}
            strokeDashoffset={-circumference * (cumulativeValue / total - segment.value / total)}
            style={{
              opacity: 0.9,
            }}
          />
        ))}
        <text x="80" y="80" textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold fill-text" fontSize="12">
          {centerText.split('\n').map((line, i) => (
            <tspan key={i} x="80" dy={i === 0 ? 0 : '14'}>
              {line}
            </tspan>
          ))}
        </text>
      </svg>
      <div className="flex flex-wrap gap-2 justify-center">
        {data.map((d) => (
          <div key={d.name} className="text-xs flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelineFunnel({
  identified,
  scheduled,
  pending,
  declined,
  completed,
}: {
  identified: number
  scheduled: number
  pending: number
  declined: number
  completed: number
}) {
  const stages = [
    { label: 'All Accounts', value: identified, color: theme.neutral },
    { label: 'Reviews Scheduled', value: scheduled, color: theme.info },
    { label: 'Pending Meetings', value: pending, color: theme.warn },
    { label: 'Declined', value: declined, color: theme.bad },
    { label: 'Completed', value: completed, color: theme.good },
  ]

  const maxWidth = 100

  return (
    <div className="card p-4 space-y-4">
      {stages.map((stage, i) => {
        const percentage = (stage.value / identified) * 100
        const conversionFromPrev = i === 0 ? 100 : (stage.value / stages[i - 1].value) * 100

        return (
          <div key={stage.label} className="space-y-2">
            <div className="flex justify-between items-baseline">
              <div className="font-semibold text-sm">{stage.label}</div>
              <div className="text-xs text-muted">
                {stage.value} ({percentage.toFixed(0)}%){i > 0 && ` • ${conversionFromPrev.toFixed(0)}% conversion`}
              </div>
            </div>
            <div className="bg-white/5 rounded-full h-8 overflow-hidden flex items-center" style={{ width: `${percentage}%` }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: '100%',
                  backgroundColor: stage.color,
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
