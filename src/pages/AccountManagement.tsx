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

const MEETING_OPTIONS = [
  'Not Contacted',
  'Not Scheduled',
  'Scheduled',
  'Declined',
  'Executed',
]

type Tab = 'tracker' | 'hitlist' | 'mostwanted' | 'authgap'

export function AccountManagement() {
  const [tab, setTab] = useState<Tab>('tracker')
  const [chainId, setChainId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Account Management Mothership</h1>
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

  // Outlet count = dim_chain.total_universe; channel split via channelGroup().
  // Rank by: 1. Active status (Active first), 2. Total Universe (descending).
  const base = useMemo(
    () =>
      chains.rows
        .filter((c) => (c.total_universe ?? 0) > 0)
        .filter((c) => !am || c.account_manager === am)
        .filter((c) =>
          !search.trim()
            ? true
            : (c.chain_name ?? c.chain_id)
                .toLowerCase()
                .includes(search.toLowerCase()),
        )
        .sort((a, b) => {
          // Active status priority: 'Active' first, then 'Not Active' or null.
          const aActive = a.active === 'Active' ? 1 : 0
          const bActive = b.active === 'Active' ? 1 : 0
          if (aActive !== bActive) return bActive - aActive
          // Within same status, sort by total_universe descending.
          return (b.total_universe ?? 0) - (a.total_universe ?? 0)
        }),
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

    // Get all chains with distribution, filter by PM not authorized
    return chains.rows
      .filter((c) => (c.total_universe ?? 0) > 0)
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
