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

export function ExecutiveSummary() {
  const { chains, categoryReviews, loading } = useData()
  const [filters, setFilters] = useState<FilterState>({
    region: '',
    channel: '',
    accountManager: '',
    activeStatus: '',
  })

  // Filter chains based on current filters
  const filteredChains = useMemo(() => {
    return chains.rows.filter((c) => {
      if (filters.region && c.region !== filters.region) return false
      if (filters.channel && c.channel !== filters.channel) return false
      if (filters.accountManager && c.account_manager !== filters.accountManager) return false
      if (filters.activeStatus && c.active !== filters.activeStatus) return false
      return true
    })
  }, [chains.rows, filters])

  // Calculate KPIs
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

    return {
      totalAccounts: total,
      totalUniverse: universe,
      activeAccounts: active,
      inactiveAccounts: inactive,
      categoryReviewsScheduled,
      meetingsPending,
      declinedReviews,
      activePct: total > 0 ? Math.round((active / total) * 100) : 0,
      inactivePct: total > 0 ? Math.round((inactive / total) * 100) : 0,
    }
  }, [filteredChains, categoryReviews.rows])

  // Channel breakdown
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

    return Array.from(channels.entries()).map(([name, data]) => ({
      name,
      ...data,
      activePct: data.accounts > 0 ? Math.round((data.active / data.accounts) * 100) : 0,
      inactivePct: data.accounts > 0 ? Math.round((data.inactive / data.accounts) * 100) : 0,
    }))
  }, [filteredChains])

  // Get filter options
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
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Executive Summary</h1>
        <p className="text-muted">Odyssey Account Management Dashboard</p>
      </div>

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

      {/* Executive KPI Row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        <KpiCard
          label="Total Accounts"
          value={kpis.totalAccounts}
          format="number"
        />
        <KpiCard
          label="Total Universe"
          value={kpis.totalUniverse}
          format="number"
          suffix="Doors"
        />
        <KpiCard
          label="Active Accounts"
          value={kpis.activeAccounts}
          format="number"
          detail={`${kpis.activePct}%`}
        />
        <KpiCard
          label="Inactive Accounts"
          value={kpis.inactiveAccounts}
          format="number"
          detail={`${kpis.inactivePct}%`}
        />
        <KpiCard
          label="Reviews Scheduled"
          value={kpis.categoryReviewsScheduled}
          format="number"
          color={theme.info}
        />
        <KpiCard
          label="Meetings Pending"
          value={kpis.meetingsPending}
          format="number"
          color={theme.warn}
        />
        <KpiCard
          label="Declined Reviews"
          value={kpis.declinedReviews}
          format="number"
          color={theme.bad}
        />
      </div>

      {/* Channel Breakdown */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Channel Breakdown</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="flex justify-between">
                  <span className="text-muted">Inactive</span>
                  <span className="font-medium" style={{ color: theme.bad }}>
                    {channel.inactive} ({channel.inactivePct}%)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Largest Opportunities Table */}
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
              {filteredChains
                .sort((a, b) => (b.total_universe ?? 0) - (a.total_universe ?? 0))
                .slice(0, 10)
                .map((chain) => (
                  <tr
                    key={chain.chain_id}
                    className={`border-b border-ink-700 hover:bg-white/5 ${
                      chain.active !== 'Y' && (chain.total_universe ?? 0) > 1000 ? 'bg-red-950/20' : ''
                    }`}
                  >
                    <td className="py-2 px-2">{chain.chain_name}</td>
                    <td className="py-2 px-2 text-muted">{chain.channel}</td>
                    <td className="py-2 px-2 text-right font-medium">{(chain.total_universe ?? 0).toLocaleString()}</td>
                    <td className="py-2 px-2">
                      <span
                        style={{
                          color: chain.active === 'Y' ? theme.good : theme.bad,
                        }}
                      >
                        {chain.active === 'Y' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-muted">{chain.region}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  format,
  suffix,
  detail,
  color,
}: {
  label: string
  value: number
  format: 'number'
  suffix?: string
  detail?: string
  color?: string
}) {
  return (
    <div className="card p-4 space-y-2">
      <div className="text-xs text-muted font-semibold uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold ${color ? '' : ''}`} style={color ? { color } : {}}>
        {value.toLocaleString()}
      </div>
      {suffix && <div className="text-xs text-muted">{suffix}</div>}
      {detail && <div className="text-sm font-medium" style={{ color: theme.info }}>{detail}</div>}
    </div>
  )
}
