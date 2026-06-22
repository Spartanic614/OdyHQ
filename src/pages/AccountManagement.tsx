import { useMemo, useState } from 'react'
import { useData } from '../data/store'
import { useAuth } from '../auth/AuthProvider'
import { useChainPriorities, useHitList } from '../data/hooks'
import { DataTable, type Column } from '../components/DataTable'
import { ChainDrawer } from '../components/drawers'
import { Pill } from '../components/StatusBadge'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { TableSkeleton, ErrorBanner } from '../components/States'
import { fmtInt } from '../lib/format'
import { tierColors } from '../theme'
import type { ChainPriority, HitListRow } from '../data/selectors'

const MEETING_OPTIONS = [
  'Not Contacted',
  'Not Scheduled',
  'Scheduled',
  'Declined',
  'Executed',
]

type Tab = 'tracker' | 'hitlist'

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
        </div>
      </div>

      {tab === 'tracker' ? (
        <Tracker onPick={setChainId} />
      ) : (
        <HitList onPick={setChainId} />
      )}

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
      rows={hits}
      rowKey={(h) => h.id}
      onRowClick={(h) => h.kind === 'chain' && onPick(h.id)}
      exportName="not_contacted_hit_list"
      initialSort={{ key: 'size', dir: 'desc' }}
      searchPlaceholder="Search accounts…"
    />
  )
}
