import { useMemo, useState } from 'react'
import { useData, type Chain, type ChainSkuAuth, type Sku } from '../data/store'
import { useChainPriorities } from '../data/hooks'
import { Pill } from '../components/StatusBadge'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { TableSkeleton, ErrorBanner, EmptyState } from '../components/States'
import { fmtInt, fmtUsd } from '../lib/format'
import { tierColors, theme } from '../theme'
import { AUTH_NOT_AUTHORIZED } from '../config/methodology'
import { buildBattlecardDoc, type BattlecardData, type BattlecardSku } from '../lib/battlecardPdf'

type BattlecardsTab = 'individual' | 'health'

export function Battlecards() {
  const { chains, categoryReviews, chainSkuAuth, skus, dcs, anchors, loading } = useData()
  const priorities = useChainPriorities()

  const [tab, setTab] = useState<BattlecardsTab>('health')
  const [chainId, setChainId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [am, setAm] = useState('')
  const [exporting, setExporting] = useState(false)

  // Default to the highest-priority chain once data loads.
  const effectiveId = chainId || priorities[0]?.chain.chain_id || ''

  const priority = priorities.find((p) => p.chain.chain_id === effectiveId)
  const chain = priority?.chain ?? chains.rows.find((c) => c.chain_id === effectiveId)
  const review = categoryReviews.rows.find((r) => r.chain_id === effectiveId)

  // SKU authorization for this chain.
  const skuRows: BattlecardSku[] = useMemo(() => {
    const byCode = new Map(
      chainSkuAuth.rows
        .filter((r) => r.chain_id === effectiveId)
        .map((r) => [r.sku_code, r.auth_status]),
    )
    return [...skus.rows]
      .sort((a, b) => (a.flavor ?? a.sku_code).localeCompare(b.flavor ?? b.sku_code))
      .map((s) => {
        const status = byCode.get(s.sku_code)
        return {
          code: s.sku_code,
          flavor: s.flavor ?? s.sku_code,
          status:
            status == null
              ? ('—' as const)
              : status === AUTH_NOT_AUTHORIZED
                ? ('Not Authorized' as const)
                : ('Authorized' as const),
        }
      })
  }, [chainSkuAuth.rows, skus.rows, effectiveId])

  const skuTracked = skuRows.filter((s) => s.status !== '—').length
  const skuAuthorized = skuRows.filter((s) => s.status === 'Authorized').length

  // DCs anchored by this chain.
  const dcNames = useMemo(
    () => new Map(dcs.rows.map((d) => [d.dc_code, d.dc_name ?? d.dc_code])),
    [dcs.rows],
  )
  const anchorDcs = useMemo(
    () =>
      anchors.rows
        .filter((a) => a.anchor_chain_id === effectiveId)
        .map((a) => dcNames.get(a.dc_code) ?? a.dc_code),
    [anchors.rows, effectiveId, dcNames],
  )

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return priorities
      .filter((p) => !am || p.chain.account_manager === am)
      .filter((p) => !q || (p.chain.chain_name ?? p.chain.chain_id).toLowerCase().includes(q))
      .slice(0, 60)
  }, [priorities, search, am])

  const exportPdf = async () => {
    if (!chain) return
    setExporting(true)
    try {
      const data: BattlecardData = {
        chainName: chain.chain_name ?? chain.chain_id,
        channel: chain.channel,
        region: chain.region,
        state: chain.state,
        accountManager: chain.account_manager,
        distributor: chain.distributor,
        greenSpoonManager: chain.green_spoon_manager,
        infraNcg: chain.infra_ncg,
        transitionalToDsd: chain.transitional_to_dsd,
        active: chain.active,
        totalUniverse: chain.total_universe,
        currentSrp: chain.current_srp,
        caseCost: chain.case_cost,
        edlp: chain.edlp,
        reviewPeriod: review?.review_period_2026 ?? null,
        meetingProgress: review?.meeting_progress ?? null,
        dateScheduled: review?.date_scheduled ?? null,
        in2025: review?.odyssey_in_2025 ?? null,
        in2026: review?.odyssey_in_2026 ?? null,
        tier: priority?.tier ?? '—',
        score: priority?.score ?? 0,
        skus: skuRows,
        skuAuthorized,
        skuTracked,
        anchorDcs,
      }
      const doc = await buildBattlecardDoc(data)
      const slug = (chain.chain_name ?? chain.chain_id).toLowerCase().replace(/[^a-z0-9]+/g, '_')
      doc.save(`battlecard_${slug}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <TableSkeleton />
  if (chains.error) return <ErrorBanner table="dim_chain" message={chains.error} />
  if (!chains.rows.length) return <EmptyState message="No chains loaded yet." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Account Battlecards</h1>
          <p className="text-sm text-muted">
            {tab === 'health'
              ? 'All accounts at a glance. Color-coded by tier and SKU auth health.'
              : 'A meeting-ready one-pager per account. Pick a chain, review, export to PDF.'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            className={`btn text-sm ${tab === 'health' ? 'btn-accent' : ''}`}
            onClick={() => setTab('health')}
          >
            Health Scorecard
          </button>
          <button
            className={`btn text-sm ${tab === 'individual' ? 'btn-accent' : ''}`}
            onClick={() => setTab('individual')}
          >
            Battlecard
          </button>
          {tab === 'individual' && (
            <button className="btn btn-accent text-sm" onClick={exportPdf} disabled={!chain || exporting}>
              {exporting ? 'Exporting…' : '⤓ Export PDF'}
            </button>
          )}
        </div>
      </div>

      {tab === 'health' && <HealthScorecard chains={chains.rows} priorities={priorities} chainSkuAuth={chainSkuAuth.rows} skus={skus.rows} onSelectChain={(id) => { setChainId(id); setTab('individual') }} />}

      {tab === 'individual' && (
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Chain picker */}
        <div className="card p-2 space-y-2 h-fit">
          <SelectFilter
            label="Account Manager"
            value={am}
            onChange={setAm}
            options={uniqueValues(chains.rows, (c) => c.account_manager)}
          />
          <input
            className="input w-full"
            placeholder="Search accounts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[70vh] overflow-auto divide-y divide-white/5">
            {matches.map((p) => (
              <button
                key={p.chain.chain_id}
                onClick={() => setChainId(p.chain.chain_id)}
                className={`w-full text-left px-2 py-1.5 rounded hover:bg-white/5 flex items-center gap-2 ${
                  p.chain.chain_id === effectiveId ? 'bg-white/10' : ''
                }`}
              >
                <Pill color={tierColors[p.tier]}>{p.tier}</Pill>
                <span className="flex-1 min-w-0 truncate text-sm">
                  {p.chain.chain_name ?? p.chain.chain_id}
                </span>
                <span className="text-[11px] text-muted tabular-nums">{fmtInt(p.chain.total_universe)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Battlecard */}
        {chain ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-2xl font-bold">{chain.chain_name ?? chain.chain_id}</div>
                  <div className="text-sm text-muted mt-0.5">
                    {[chain.channel, chain.region, chain.state].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {priority && <Pill color={tierColors[priority.tier]}>Tier {priority.tier}</Pill>}
                  {priority && (
                    <span className="text-sm text-muted">
                      Priority <span className="font-semibold text-text">{priority.score.toFixed(0)}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <Kpi label="Total outlets" value={fmtInt(chain.total_universe)} />
                <Kpi label="Current SRP" value={fmtUsd(chain.current_srp)} />
                <Kpi label="Case cost" value={fmtUsd(chain.case_cost)} />
                <Kpi label="EDLP" value={chain.edlp ?? '—'} />
              </div>
            </div>

            {/* Account meta + review */}
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Account">
                <Field label="Account Manager" value={chain.account_manager} />
                <Field label="Distributor" value={chain.distributor} />
                <Field label="Green Spoon Mgr" value={chain.green_spoon_manager} />
                <Field label="INFRA / NCG" value={chain.infra_ncg} />
                <Field label="Transitional to DSD" value={chain.transitional_to_dsd} />
                <Field label="Active" value={chain.active} />
              </Panel>
              <Panel title="2026 Category Review">
                <Field label="Review Period" value={review?.review_period_2026 ?? null} />
                <Field label="Meeting Progress" value={review?.meeting_progress ?? null} />
                <Field label="Date Scheduled" value={review?.date_scheduled ?? null} />
                <Field label="In 2025 Energy Set" value={review?.odyssey_in_2025 ?? null} />
                <Field label="In 2026 Energy Set" value={review?.odyssey_in_2026 ?? null} />
              </Panel>
            </div>

            {/* SKU authorization */}
            <Panel
              title={`SKU Authorization — ${skuAuthorized}/${skuTracked} authorized${
                skuTracked ? ` · ${skuTracked - skuAuthorized} whitespace` : ''
              }`}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {skuRows.map((s) => {
                  const ok = s.status === 'Authorized'
                  const none = s.status === '—'
                  const color = none ? theme.textMuted : ok ? theme.good : theme.bad
                  return (
                    <div
                      key={s.code}
                      className="flex items-center gap-2 text-sm rounded px-2 py-1"
                      style={{ backgroundColor: `${color}14` }}
                    >
                      <span style={{ color }} aria-hidden>
                        {ok ? '✓' : none ? '·' : '✗'}
                      </span>
                      <span className="truncate">{s.flavor}</span>
                    </div>
                  )
                })}
              </div>
            </Panel>

            {/* Anchors */}
            <Panel title="Anchored DCs (unlock leverage)">
              {anchorDcs.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {anchorDcs.map((n, i) => (
                    <span key={i} className="text-xs rounded px-2 py-1 bg-white/5">
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">No DCs designate this chain as an anchor.</div>
              )}
            </Panel>
          </div>
        ) : (
          <EmptyState message="Select an account to view its battlecard." />
        )}
      </div>
      )}
    </div>
  )
}

function HealthScorecard({ chains, priorities, chainSkuAuth, skus, onSelectChain }: { chains: Chain[]; priorities: ReturnType<typeof useChainPriorities>; chainSkuAuth: ChainSkuAuth[]; skus: Sku[]; onSelectChain: (id: string) => void }) {
  if (!priorities.length) {
    return <EmptyState message="Loading account data…" />
  }

  const [am, setAm] = useState('')
  const [search, setSearch] = useState('')

  const pmSku = skus.find((s) => (s.flavor ?? '').toLowerCase().includes('pineapple'))

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return priorities
      .filter((p) => !am || p.chain.account_manager === am)
      .filter((p) => !q || (p.chain.chain_name ?? p.chain.chain_id).toLowerCase().includes(q))
      .map((p) => {
        const skuAuth = chainSkuAuth.filter((r) => r.chain_id === p.chain.chain_id)
        const tracked = skuAuth.length
        const authorized = skuAuth.filter((r) => r.auth_status === 'Authorized').length
        const authRate = tracked > 0 ? authorized / tracked : 0
        const pmAuth = pmSku ? chainSkuAuth.find((r) => r.chain_id === p.chain.chain_id && r.sku_code === pmSku.sku_code)?.auth_status === 'Authorized' : null
        return {
          chain: p.chain,
          tier: p.tier,
          score: p.score,
          authRate,
          tracked,
          authorized,
          pmAuth,
        }
      })
  }, [priorities, am, search, chainSkuAuth, pmSku])

  const authRateColor = (rate: number) =>
    rate >= 0.8 ? theme.good : rate >= 0.5 ? theme.warn : theme.bad

  return (
    <div className="space-y-3">
      <div className="card p-2 flex flex-wrap items-center gap-2">
        <SelectFilter
          label="AM"
          value={am}
          onChange={setAm}
          options={uniqueValues(chains, (c) => c.account_manager)}
        />
        <input
          className="input flex-1 min-w-48"
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-muted px-1">{fmtInt(rows.length)}</span>
      </div>

      <div className="overflow-auto max-h-[70vh]">
        {rows.length === 0 ? (
          <div className="card p-6 text-center text-muted">
            No accounts match your filters.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-ink-800">
              <tr>
                <th className="th">Account</th>
                <th className="th">Tier</th>
                <th className="th text-right">Score</th>
                <th className="th text-right">SKU Auth %</th>
                <th className="th text-center">PM Auth</th>
                <th className="th">AM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr
                  key={r.chain.chain_id}
                  onClick={() => onSelectChain(r.chain.chain_id)}
                  className="hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="td font-medium truncate">{r.chain.chain_name ?? r.chain.chain_id}</td>
                  <td className="td">
                    <Pill color={tierColors[r.tier]}>Tier {r.tier}</Pill>
                  </td>
                  <td className="td text-right tabular-nums">{r.score.toFixed(0)}</td>
                  <td className="td text-right tabular-nums" style={{ color: authRateColor(r.authRate) }}>
                    {(r.authRate * 100).toFixed(0)}%
                  </td>
                  <td className="td text-center">
                    {r.pmAuth === null ? '—' : r.pmAuth ? '✓' : '✗'}
                  </td>
                  <td className="td text-muted text-xs">{r.chain.account_manager || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted uppercase tracking-wide">{label}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-right">{value && value.trim() ? value : '—'}</span>
    </div>
  )
}
