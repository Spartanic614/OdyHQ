import { useMemo, useState } from 'react'
import { useData } from '../data/store'
import { useAuth } from '../auth/AuthProvider'
import { useChainPriorities, useHitList } from '../data/hooks'
import { DataTable, type Column } from '../components/DataTable'
import { ChainDrawer } from '../components/drawers'
import { Pill } from '../components/StatusBadge'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { TableSkeleton, ErrorBanner, EmptyState } from '../components/States'
import { exportCsv } from '../lib/csv'
import { channelGroup } from '../config/methodology'
import { fmtInt } from '../lib/format'
import { tierColors, theme } from '../theme'
import type { ChainPriority, HitListRow } from '../data/selectors'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MEETING_OPTIONS = [
  'Not Contacted',
  'Not Scheduled',
  'Scheduled',
  'Declined',
  'Executed',
]

type Tab = 'tracker' | 'hitlist' | 'mostwanted' | 'authgap'

export function AccountManagement() {
  const { chains, categoryReviews } = useData()
  const [tab, setTab] = useState<Tab>('tracker')
  const [chainId, setChainId] = useState<string | null>(null)
  const [selectedManager, setSelectedManager] = useState<string | null>(null)

  const managerMetrics = useMemo(() => {
    const managers = new Map<string, { accounts: number; universe: number; active: number; scheduled: number; pending: number; completed: number; declined: number }>()

    chains.rows.forEach((c) => {
      const m = c.account_manager || 'Unassigned'
      const existing = managers.get(m) || { accounts: 0, universe: 0, active: 0, scheduled: 0, pending: 0, completed: 0, declined: 0 }
      existing.accounts++
      existing.universe += c.total_universe ?? 0
      if (c.active === 'Active') existing.active++
      managers.set(m, existing)
    })

    categoryReviews.rows.forEach((cr) => {
      const chain = chains.rows.find((c) => c.chain_id === cr.chain_id)
      if (!chain) return
      const m = chain.account_manager || 'Unassigned'
      const existing = managers.get(m)
      if (existing) {
        if (cr.date_scheduled) existing.scheduled++
        else if (cr.meeting_progress === 'Pending') existing.pending++
        else if (cr.meeting_progress === 'Completed') existing.completed++
        else if (cr.meeting_progress === 'Declined') existing.declined++
      }
    })

    return Array.from(managers.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        activePct: data.accounts > 0 ? Math.round((data.active / data.accounts) * 100) : 0,
      }))
      .sort((a, b) => b.universe - a.universe)
  }, [chains.rows])

  // Show manager detail view if selected
  if (selectedManager) {
    return (
      <ManagerDetailView
        manager={selectedManager}
        chains={chains.rows}
        onClose={() => setSelectedManager(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Account Manager Summary</h1>
        <div className="flex gap-1">
          <button
            className={`btn text-sm ${tab === 'tracker' ? 'btn-accent' : ''}`}
            onClick={() => setTab('tracker')}
          >
            Category Review Tracker
          </button>
          <button
            className={`btn text-sm ${tab === 'hitlist' ? 'btn-accent' : ''}`}
            onClick={() => setTab('hitlist')}
          >
            Not-Contacted Hit List
          </button>
          <button
            className={`btn text-sm ${tab === 'mostwanted' ? 'btn-accent' : ''}`}
            onClick={() => setTab('mostwanted')}
          >
            Most Wanted
          </button>
          <button
            className={`btn text-sm ${tab === 'authgap' ? 'btn-accent' : ''}`}
            onClick={() => setTab('authgap')}
          >
            Pineapple Mango Gap
          </button>
        </div>
      </div>

      {/* Category Review Pipeline */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Category Review Pipeline</h2>
        <div className="card p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: 'Scheduled', value: managerMetrics.reduce((sum, m) => sum + m.scheduled, 0), fill: theme.good },
                { name: 'Pending', value: managerMetrics.reduce((sum, m) => sum + m.pending, 0), fill: theme.warn },
                { name: 'Completed', value: managerMetrics.reduce((sum, m) => sum + m.completed, 0), fill: theme.info },
                { name: 'Declined', value: managerMetrics.reduce((sum, m) => sum + m.declined, 0), fill: theme.bad },
              ]}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
              <XAxis type="number" stroke={theme.textMuted} style={{ fontSize: '12px' }} />
              <YAxis dataKey="name" type="category" stroke={theme.textMuted} style={{ fontSize: '12px' }} width={80} />
              <Tooltip contentStyle={{ backgroundColor: '#13161b', border: `1px solid ${theme.border}` }} />
              <Bar dataKey="value" fill={theme.good} radius={[0, 8, 8, 0]}>
                {[
                  { name: 'Scheduled', fill: theme.good },
                  { name: 'Pending', fill: theme.warn },
                  { name: 'Completed', fill: theme.info },
                  { name: 'Declined', fill: theme.bad },
                ].map((item, i) => (
                  <Cell key={`cell-${i}`} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Account Manager Scorecard */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Account Manager Performance</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {managerMetrics.map((manager) => (
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
                <div className="border-t border-white/10 pt-2 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">Scheduled</span>
                    <span style={{ color: theme.good }}>{manager.scheduled}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Pending</span>
                    <span style={{ color: theme.warn }}>{manager.pending}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Completed</span>
                    <span style={{ color: theme.info }}>{manager.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Declined</span>
                    <span style={{ color: theme.bad }}>{manager.declined}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {tab === 'tracker' && <Tracker onPick={setChainId} />}
      {tab === 'hitlist' && <HitList onPick={setChainId} />}
      {tab === 'mostwanted' && <MostWanted onPick={setChainId} />}
      {tab === 'authgap' && <PineappleMangoGap onPick={setChainId} />}

      <ChainDrawer chainId={chainId} onClose={() => setChainId(null)} />
    </div>
  )
}

// ---------------- Category Review Tracker (editable) ----------------
function Tracker({ onPick }: { onPick: (id: string) => void }) {
  const { chains, categoryReviews, loading, updateCategoryReview } = useData()
  const { user } = useAuth()
  const priorities = useChainPriorities()

  const [region, setRegion] = useState('')
  const [channel, setChannel] = useState('')
  const [am, setAm] = useState('')
  const [status, setStatus] = useState('')
  const [tier, setTier] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      priorities
        .filter((p) => !region || p.chain.region === region)
        .filter((p) => !channel || p.chain.channel === channel)
        .filter((p) => !am || p.chain.account_manager === am)
        .filter((p) => !status || p.meetingProgress === status)
        .filter((p) => !tier || p.tier === tier),
    [priorities, region, channel, am, status, tier],
  )

  const onEditStatus = async (chainId: string, value: string) => {
    setSaving(chainId)
    setSaveError(null)
    const { error } = await updateCategoryReview(
      chainId,
      { meeting_progress: value },
      user?.email ?? 'unknown',
    )
    if (error) setSaveError(`${chainId}: ${error}`)
    setSaving(null)
  }

  const columns: Column<ChainPriority>[] = [
    {
      key: 'chain',
      label: 'Chain',
      value: (p) => p.chain.chain_name ?? p.chain.chain_id,
      render: (p) => (
        <button
          className="font-medium text-left hover:text-accent"
          onClick={(e) => {
            e.stopPropagation()
            onPick(p.chain.chain_id)
          }}
        >
          {p.chain.chain_name ?? p.chain.chain_id}
        </button>
      ),
    },
    { key: 'tam', label: 'TAM', align: 'right', value: (p) => p.chain.total_universe, render: (p) => fmtInt(p.chain.total_universe) },
    { key: 'am', label: 'AM', value: (p) => p.chain.account_manager },
    { key: 'channel', label: 'Channel', value: (p) => p.chain.channel },
    { key: 'region', label: 'Region', value: (p) => p.chain.region },
    { key: 'period', label: 'Review Period', value: (p) => p.review?.review_period_2026 ?? null },
    {
      key: 'skugap',
      label: 'SKU Gap',
      align: 'center',
      value: (p) => p.skuGapPct,
      render: (p) =>
        p.skuTracked ? (
          <span>{p.skuNotAuthorized}/{p.skuTracked}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'score',
      label: 'Priority',
      align: 'right',
      value: (p) => p.score,
      render: (p) => <span className="font-semibold">{p.score.toFixed(0)}</span>,
    },
    {
      key: 'tier',
      label: 'Tier',
      align: 'center',
      value: (p) => p.tier,
      render: (p) => <Pill color={tierColors[p.tier]}>{p.tier}</Pill>,
    },
    {
      key: 'status',
      label: 'Meeting Progress',
      value: (p) => p.meetingProgress,
      noExport: false,
      render: (p) => (
        <select
          className="input py-1 text-xs"
          value={p.meetingProgress ?? ''}
          disabled={saving === p.chain.chain_id || !p.review}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onEditStatus(p.chain.chain_id, e.target.value)}
        >
          {!p.review && <option value="">(no review row)</option>}
          {MEETING_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ),
    },
  ]

  if (loading) return <TableSkeleton />
  if (chains.error) return <ErrorBanner table="dim_chain" message={chains.error} />

  return (
    <div className="space-y-2">
      {categoryReviews.error && (
        <ErrorBanner table="fact_category_review" message={categoryReviews.error} />
      )}
      {saveError && <ErrorBanner message={`Save failed — ${saveError}`} />}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.chain.chain_id}
        exportName="category_review_tracker"
        initialSort={{ key: 'score', dir: 'desc' }}
        searchPlaceholder="Search chains…"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SelectFilter label="Region" value={region} onChange={setRegion} options={uniqueValues(chains.rows, (c) => c.region)} />
            <SelectFilter label="Channel" value={channel} onChange={setChannel} options={uniqueValues(chains.rows, (c) => c.channel)} />
            <SelectFilter label="AM" value={am} onChange={setAm} options={uniqueValues(chains.rows, (c) => c.account_manager)} />
            <SelectFilter label="Status" value={status} onChange={setStatus} options={MEETING_OPTIONS} />
            <SelectFilter label="Tier" value={tier} onChange={setTier} options={['A', 'B', 'C']} />
          </div>
        }
      />
    </div>
  )
}

// ---------------- Not-Contacted hit list ----------------
function HitList({ onPick }: { onPick: (id: string) => void }) {
  const hits = useHitList()
  const { loading, chains, prospects } = useData()
  const [am, setAm] = useState('')

  const filtered = useMemo(() => hits.filter((h) => !am || h.owner === am), [hits, am])

  const columns: Column<HitListRow>[] = [
    {
      key: 'name',
      label: 'Account',
      value: (h) => h.name,
      render: (h) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium">{h.name}</span>
          {h.kind === 'prospect' && <Pill color="#a855f7">SPINS</Pill>}
        </span>
      ),
    },
    { key: 'size', label: 'TAM / Units', align: 'right', value: (h) => h.size, render: (h) => fmtInt(h.size) },
    { key: 'channel', label: 'Channel', value: (h) => h.channel },
    { key: 'region', label: 'Region', value: (h) => h.region },
    { key: 'owner', label: 'AM', value: (h) => h.owner },
    { key: 'detail', label: 'Why', value: (h) => h.detail },
  ]

  if (loading) return <TableSkeleton />
  if (chains.error) return <ErrorBanner table="dim_chain" message={chains.error} />
  if (prospects.error) return <ErrorBanner table="dim_prospect" message={prospects.error} />

  return (
    <DataTable
      columns={columns}
      rows={filtered}
      rowKey={(h) => h.id}
      onRowClick={(h) => h.kind === 'chain' && onPick(h.id)}
      exportName="not_contacted_hit_list"
      initialSort={{ key: 'size', dir: 'desc' }}
      searchPlaceholder="Search accounts…"
      toolbar={
        <SelectFilter
          label="AM"
          value={am}
          onChange={setAm}
          options={uniqueValues(hits, (h) => h.owner)}
        />
      }
    />
  )
}

// ---------------- Most Wanted (retailers ranked by outlet count, split by channel) ----------------
function MostWanted({ onPick }: { onPick: (id: string) => void }) {
  const { chains, loading } = useData()
  const [am, setAm] = useState('')
  const [search, setSearch] = useState('')

  // Show inactive accounts with no distribution, sorted by largest outlet count.
  // Focused on Large Format and Natural channels.
  const base = useMemo(
    () =>
      chains.rows
        .filter((c) => c.active === 'Not Active')
        .filter((c) => !c.distributor || c.distributor.trim() === '')
        .filter((c) => {
          const ch = channelGroup(c.channel)
          return ch === 'Large Format' || ch === 'Natural'
        })
        .filter((c) => (c.total_universe ?? 0) > 0)
        .filter((c) => !am || c.account_manager === am)
        .filter((c) =>
          !search.trim()
            ? true
            : (c.chain_name ?? c.chain_id)
                .toLowerCase()
                .includes(search.toLowerCase()),
        )
        .sort((a, b) => (b.total_universe ?? 0) - (a.total_universe ?? 0)),
    [chains.rows, am, search],
  )

  const largeFormat = useMemo(
    () => base.filter((c) => channelGroup(c.channel) === 'Large Format'),
    [base],
  )
  const natural = useMemo(
    () => base.filter((c) => channelGroup(c.channel) === 'Natural'),
    [base],
  )

  if (loading) return <TableSkeleton />
  if (chains.error) return <ErrorBanner table="dim_chain" message={chains.error} />

  return (
    <div className="space-y-3">
      <div className="card p-2 flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold px-1">
          Most Wanted
          <span className="text-muted font-normal"> · top retailers by outlet count</span>
        </div>
        <div className="flex-1" />
        <SelectFilter
          label="AM"
          value={am}
          onChange={setAm}
          options={uniqueValues(chains.rows, (c) => c.account_manager)}
        />
        <input
          className="input w-48"
          placeholder="Search retailers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MostWantedBox title="Large Format" rows={largeFormat} onPick={onPick} />
        <MostWantedBox title="Natural" rows={natural} onPick={onPick} />
      </div>
    </div>
  )
}

function MostWantedBox({
  title,
  rows,
  onPick,
}: {
  title: string
  rows: ReturnType<typeof useData>['chains']['rows']
  onPick: (id: string) => void
}) {
  const max = rows[0]?.total_universe ?? 1
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-2 border-b border-white/10">
        <div className="text-sm font-semibold px-1">{title}</div>
        <div className="flex items-center gap-2">
          <button
            className="btn text-xs"
            disabled={!rows.length}
            onClick={() =>
              exportCsv(
                `most_wanted_${title.toLowerCase().replace(/\s+/g, '_')}`,
                rows.map((c, i) => ({
                  Rank: i + 1,
                  Retailer: c.chain_name ?? c.chain_id,
                  'Outlet Count': c.total_universe,
                  'Account Manager': c.account_manager,
                  Channel: c.channel,
                  Region: c.region,
                })),
              )
            }
          >
            ⤓ CSV
          </button>
          <span className="text-xs text-muted px-1">{rows.length}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={`No ${title} retailers match the current filters.`} />
      ) : (
        <div className="overflow-auto max-h-[68vh] divide-y divide-white/5">
          {rows.map((c, i) => {
            const outlets = c.total_universe ?? 0
            const pct = max > 0 ? (outlets / max) * 100 : 0
            return (
              <button
                key={c.chain_id}
                onClick={() => onPick(c.chain_id)}
                className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex items-center gap-3"
              >
                <span className="text-muted text-sm w-7 text-right tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {c.chain_name ?? c.chain_id}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {[c.channel, c.region, c.account_manager ? `AM ${c.account_manager}` : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${pct}%`, backgroundColor: theme.accent }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular-nums">{fmtInt(outlets)}</div>
                  <div className="text-[10px] text-muted uppercase tracking-wide">
                    outlets
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Pineapple Mango Authorization Gap ----
function PineappleMangoGap({ onPick }: { onPick: (id: string) => void }) {
  const { chains, chainSkuAuth, skus, loading } = useData()
  const [am, setAm] = useState('')
  const [search, setSearch] = useState('')

  // Find Pineapple Mango SKU
  const pmSku = useMemo(
    () => skus.rows.find((s) => (s.flavor ?? '').toLowerCase().includes('pineapple')),
    [skus.rows],
  )
  const pmSkuCode = pmSku?.sku_code

  // Chains with distribution but NO Pineapple Mango authorization
  const gaps = useMemo(() => {
    if (!pmSkuCode) return []

    // Map of chain_id -> auth_status for Pineapple Mango
    const pmAuthByChain = new Map(
      chainSkuAuth.rows
        .filter((r) => r.sku_code === pmSkuCode)
        .map((r) => [r.chain_id, r.auth_status]),
    )

    // Get all chains with distribution, filter by PM not authorized, and Active status only
    return chains.rows
      .filter((c) => (c.total_universe ?? 0) > 0)
      .filter((c) => c.active === 'Active')
      .filter((c) => !am || c.account_manager === am)
      .filter((c) =>
        !search.trim()
          ? true
          : (c.chain_name ?? c.chain_id)
              .toLowerCase()
              .includes(search.toLowerCase()),
      )
      .filter((c) => {
        const auth = pmAuthByChain.get(c.chain_id)
        // Include if NOT_AUTHORIZED or not tracked at all (—)
        return auth !== 'Authorized' && auth !== 'ACTIVE'
      })
      .sort((a, b) => {
        // Sort: Active first, then by total_universe desc
        const aActive = a.active === 'Active' ? 1 : 0
        const bActive = b.active === 'Active' ? 1 : 0
        if (aActive !== bActive) return bActive - aActive
        return (b.total_universe ?? 0) - (a.total_universe ?? 0)
      })
  }, [chains.rows, chainSkuAuth.rows, pmSkuCode, am, search])

  const columns: Column<(typeof gaps)[number]>[] = [
    {
      key: 'name',
      label: 'Account',
      value: (c) => c.chain_name ?? c.chain_id,
    },
    {
      key: 'outlets',
      label: 'Outlets',
      align: 'right',
      value: (c) => c.total_universe ?? 0,
      render: (c) => fmtInt(c.total_universe ?? 0),
    },
    {
      key: 'active',
      label: 'Status',
      value: (c) => c.active ?? '—',
      render: (c) => (
        <Pill color={c.active === 'Active' ? theme.good : theme.warn}>
          {c.active ?? '—'}
        </Pill>
      ),
    },
    {
      key: 'channel',
      label: 'Channel',
      value: (c) => c.channel ?? '—',
    },
    {
      key: 'am',
      label: 'AM',
      value: (c) => c.account_manager ?? '—',
    },
  ]

  if (loading) return <TableSkeleton />
  if (!pmSku) {
    return <EmptyState message="Pineapple Mango SKU not found in database." />
  }

  return (
    <div className="space-y-3">
      {gaps.length === 0 ? (
        <EmptyState message="All accounts with distribution are authorized for Pineapple Mango. 🎉" />
      ) : (
        <>
          <div className="text-sm text-muted">
            <span className="font-semibold text-text">{fmtInt(gaps.length)}</span> account(s) with distribution lack Pineapple Mango
            authorization.
          </div>
          <DataTable
            columns={columns}
            rows={gaps}
            rowKey={(c) => c.chain_id}
            onRowClick={(c) => onPick(c.chain_id)}
            exportName="pineapple_mango_gaps"
            initialSort={{ key: 'outlets', dir: 'desc' }}
            searchPlaceholder="Search accounts…"
            toolbar={
              <div className="flex items-center gap-2">
                <SelectFilter
                  label="AM"
                  value={am}
                  onChange={setAm}
                  options={uniqueValues(chains.rows, (c) => c.account_manager)}
                />
                <input
                  className="input w-48"
                  placeholder="Search account name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
          />
        </>
      )}
    </div>
  )
}

interface ManagerDetailViewProps {
  manager: string
  chains: any[]
  onClose: () => void
}

function ManagerDetailView({ manager, chains, onClose }: ManagerDetailViewProps) {
  const { categoryReviews } = useData()
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
    const reviewed = new Set(categoryReviews.rows.map((cr) => cr.chain_id))
    return managerChains.filter((c) => !reviewed.has(c.chain_id))
  }, [managerChains, categoryReviews.rows])

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
