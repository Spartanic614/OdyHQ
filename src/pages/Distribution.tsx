import { useMemo, useState } from 'react'
import { useData } from '../data/store'
import { useSkuOpportunities, useUnlockCandidates } from '../data/hooks'
import { DataTable, type Column } from '../components/DataTable'
import { DcDrawer, ChainDrawer } from '../components/drawers'
import { AuthBadge, Pill } from '../components/StatusBadge'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { TableSkeleton, ErrorBanner, EmptyState } from '../components/States'
import { SkuCanImage, hasSkuCanArt, skuCanAspect } from '../components/SkuCan'
import { fmtInt } from '../lib/format'
import { tierColors, theme } from '../theme'
import type { SkuOpportunity } from '../data/selectors'
import { AUTH_NOT_AUTHORIZED } from '../config/methodology'

type Tab = 'heatmap' | 'opportunity' | 'unlock'

export function Distribution() {
  const [tab, setTab] = useState<Tab>('heatmap')
  const [dcCode, setDcCode] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Distribution Mothership</h1>
        <div className="flex gap-1">
          <TabBtn active={tab === 'heatmap'} onClick={() => setTab('heatmap')}>
            SKU Heatmap
          </TabBtn>
          <TabBtn active={tab === 'opportunity'} onClick={() => setTab('opportunity')}>
            SKU Opportunity
          </TabBtn>
          <TabBtn active={tab === 'unlock'} onClick={() => setTab('unlock')}>
            Anchor → DC Unlock
          </TabBtn>
        </div>
      </div>

      {tab === 'heatmap' && <Heatmap onPick={setDcCode} />}
      {tab === 'opportunity' && <SkuOpportunityTable onPick={setDcCode} />}
      {tab === 'unlock' && (
        <UnlockBoard onPickDc={setDcCode} onPickChain={setChainId} />
      )}

      <DcDrawer dcCode={dcCode} onClose={() => setDcCode(null)} />
      <ChainDrawer chainId={chainId} onClose={() => setChainId(null)} />
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`btn text-sm ${active ? 'btn-accent' : ''}`}
    >
      {children}
    </button>
  )
}

// ---------------- Heatmap: DC (rows, by volume) × SKU (cols) ----------------
function Heatmap({ onPick }: { onPick: (dc: string) => void }) {
  const { dcs, skus, dcSkuAuth, loading } = useData()
  const [type, setType] = useState('')
  const [territory, setTerritory] = useState('')
  const [contact, setContact] = useState('')

  const authMap = useMemo(() => {
    const m = new Map<string, { status: string | null; moq: number | null }>()
    for (const r of dcSkuAuth.rows)
      m.set(`${r.dc_code}|${r.sku_code}`, { status: r.auth_status, moq: r.moq })
    return m
  }, [dcSkuAuth.rows])

  const filteredDcs = useMemo(
    () =>
      [...dcs.rows]
        .filter((d) => !type || d.type === type)
        .filter((d) => !territory || d.territory === territory)
        .filter((d) => !contact || d.odyssey_contact === contact)
        .sort((a, b) => (b.l52w_volume ?? 0) - (a.l52w_volume ?? 0)),
    [dcs.rows, type, territory, contact],
  )

  const sortedSkus = useMemo(
    () => [...skus.rows].sort((a, b) => a.sku_code.localeCompare(b.sku_code)),
    [skus.rows],
  )

  if (loading) return <TableSkeleton />
  if (dcSkuAuth.error)
    return <ErrorBanner table="fact_dc_sku_auth" message={dcSkuAuth.error} />
  if (!filteredDcs.length) return <EmptyState message="No DCs match filters." />

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-2 border-b border-ink-700">
        <SelectFilter
          label="Type"
          value={type}
          onChange={setType}
          options={uniqueValues(dcs.rows, (d) => d.type)}
        />
        <SelectFilter
          label="Territory"
          value={territory}
          onChange={setTerritory}
          options={uniqueValues(dcs.rows, (d) => d.territory)}
        />
        <SelectFilter
          label="Contact"
          value={contact}
          onChange={setContact}
          options={uniqueValues(dcs.rows, (d) => d.odyssey_contact)}
        />
        <div className="flex-1" />
        <Legend />
      </div>
      <div className="overflow-auto max-h-[72vh]">
        <table className="border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="th sticky left-0 bg-ink-800 z-30 min-w-[180px]">
                DC (by volume)
              </th>
              {sortedSkus.map((s) => (
                <th
                  key={s.sku_code}
                  className="th bg-ink-800 whitespace-nowrap"
                  title={s.flavor ?? s.sku_code}
                >
                  {s.flavor ?? s.sku_code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredDcs.map((d) => (
              <tr key={d.dc_code} className="hover:bg-ink-700/40">
                <td
                  className="td sticky left-0 bg-ink-800 cursor-pointer hover:text-accent z-10"
                  onClick={() => onPick(d.dc_code)}
                >
                  <div className="font-medium truncate max-w-[180px]">
                    {d.dc_name ?? d.dc_code}
                  </div>
                  <div className="text-muted">vol {fmtInt(d.l52w_volume)}</div>
                </td>
                {sortedSkus.map((s) => {
                  const cell = authMap.get(`${d.dc_code}|${s.sku_code}`)
                  return (
                    <td
                      key={s.sku_code}
                      className="text-center border-t border-ink-700"
                      title={
                        cell?.moq != null ? `MOQ ${cell.moq}` : undefined
                      }
                    >
                      <Cell
                        status={cell?.status ?? undefined}
                        flavor={s.flavor ?? s.sku_code}
                        skuCode={s.sku_code}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Cell({ status, flavor, skuCode }: { status?: string; flavor: string; skuCode: string }) {
  if (status == null)
    return <span className="inline-block w-5 text-ink-500">·</span>

  const notAuth = status === AUTH_NOT_AUTHORIZED
  const authorized = !notAuth

  const skuNum = skuCode?.replace(/[^\d]/g, '')
  const varietyPackImage =
    skuNum === '222' ? '/222%20Variety%20Pack.jpg' : skuNum === '85' ? '/85%20Variety%20Pack.png' : null

  if (varietyPackImage) {
    return (
      <span
        className="inline-block rounded overflow-hidden align-middle bg-black"
        title={`${flavor} — ${authorized ? 'Authorized' : 'Not Authorized'}`}
        style={{
          width: 22,
          aspectRatio: '3/4',
          boxShadow: authorized ? `0 0 0 1px ${theme.good}88` : `0 0 0 1px ${theme.border}`,
        }}
      >
        <img
          src={varietyPackImage}
          alt={flavor}
          className="w-full h-full object-contain"
          style={{ filter: authorized ? 'none' : 'grayscale(1)', opacity: authorized ? 1 : 0.35 }}
        />
      </span>
    )
  }

  if (!hasSkuCanArt(flavor)) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 text-[11px] font-bold"
        style={{
          color: notAuth ? theme.bad : theme.good,
          backgroundColor: notAuth ? `${theme.bad}22` : `${theme.good}1a`,
        }}
      >
        {notAuth ? '✗' : '✓'}
      </span>
    )
  }

  return (
    <span
      className="inline-block rounded overflow-hidden align-middle"
      title={`${flavor} — ${authorized ? 'Authorized' : 'Not Authorized'}`}
      style={{
        position: 'relative',
        width: 22,
        aspectRatio: skuCanAspect(flavor),
        containerType: 'inline-size',
        boxShadow: authorized ? `0 0 0 1px ${theme.good}88` : `0 0 0 1px ${theme.border}`,
      }}
    >
      <SkuCanImage flavor={flavor} dimmed={!authorized} />
    </span>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted pr-2">
      <span>
        <span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ backgroundColor: theme.good }} />
        Full color = Authorized
      </span>
      <span>
        <span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ backgroundColor: theme.textMuted }} />
        Grayscale = Not Authorized
      </span>
      <span className="text-ink-500">· n/a</span>
    </div>
  )
}

// ---------------- SKU opportunity ranking ----------------
function SkuOpportunityTable({ onPick }: { onPick: (dc: string) => void }) {
  const opps = useSkuOpportunities()
  const { dcSkuAuth, loading } = useData()

  const columns: Column<SkuOpportunity>[] = [
    {
      key: 'dc',
      label: 'DC',
      value: (o) => o.dc.dc_name ?? o.dc.dc_code,
      render: (o) => (
        <span className="font-medium">{o.dc.dc_name ?? o.dc.dc_code}</span>
      ),
    },
    { key: 'type', label: 'Type', value: (o) => o.dc.type },
    { key: 'territory', label: 'Territory', value: (o) => o.dc.territory },
    {
      key: 'sku',
      label: 'SKU (Not Authorized)',
      value: (o) => o.sku.flavor ?? o.sku.sku_code,
      render: (o) => (
        <span className="inline-flex items-center gap-2">
          {o.sku.flavor ?? o.sku.sku_code}
          <AuthBadge status={AUTH_NOT_AUTHORIZED} />
        </span>
      ),
    },
    {
      key: 'weight',
      label: 'DC Volume (weight)',
      align: 'right',
      value: (o) => o.weight,
      render: (o) => <span className="font-semibold">{fmtInt(o.weight)}</span>,
    },
    {
      key: 'moq',
      label: 'MOQ',
      align: 'right',
      value: (o) => o.moq,
    },
  ]

  if (loading) return <TableSkeleton />
  if (dcSkuAuth.error)
    return <ErrorBanner table="fact_dc_sku_auth" message={dcSkuAuth.error} />

  return (
    <DataTable
      columns={columns}
      rows={opps}
      rowKey={(o) => `${o.dc.dc_code}|${o.sku.sku_code}`}
      onRowClick={(o) => onPick(o.dc.dc_code)}
      exportName="sku_opportunity"
      initialSort={{ key: 'weight', dir: 'desc' }}
      searchPlaceholder="Search DC or SKU…"
    />
  )
}

// ---------------- Anchor → DC unlock board ----------------
function UnlockBoard({
  onPickDc,
  onPickChain,
}: {
  onPickDc: (dc: string) => void
  onPickChain: (id: string) => void
}) {
  const candidates = useUnlockCandidates()
  const { loading, dcs } = useData()

  if (loading) return <TableSkeleton />
  if (dcs.error) return <ErrorBanner table="dim_dc" message={dcs.error} />
  if (!candidates.length)
    return <EmptyState message="No unlock candidates (no dormant or New@KeHE-eligible DCs)." />

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {candidates.map((c) => (
        <div key={c.dc.dc_code} className="card p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <button
              className="text-left font-medium hover:text-accent"
              onClick={() => onPickDc(c.dc.dc_code)}
            >
              {c.dc.dc_name ?? c.dc.dc_code}
            </button>
            <div className="flex flex-col items-end gap-1">
              {c.newAtKehe && <Pill color={theme.accent}>New @ KeHE</Pill>}
              <Pill color={c.status === 'Dormant' ? tierColors.A : tierColors.C}>
                {c.status} · vol {fmtInt(c.dc.l52w_volume)}
              </Pill>
            </div>
          </div>
          <div className="text-xs text-muted">
            {c.dc.type ?? '—'} · {c.dc.territory ?? '—'}
          </div>
          <div className="border-t border-ink-700 pt-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">
              Required anchor(s)
            </div>
            {c.anchors.length === 0 ? (
              <div className="text-xs text-muted">No anchor designated.</div>
            ) : (
              <div className="space-y-1.5">
                {c.anchors.map((a, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      {a.chainId ? (
                        <button
                          className="text-left hover:text-accent truncate"
                          onClick={() => onPickChain(a.chainId!)}
                        >
                          {a.chainName}
                        </button>
                      ) : (
                        <span className="truncate">{a.chainName}</span>
                      )}
                      <Pill color={a.contacted ? theme.good : theme.bad}>
                        {a.contacted ? '✓' : '✗'}{' '}
                        {a.meetingProgress ?? 'Not Contacted'}
                      </Pill>
                    </div>
                    <div className="text-[11px] text-muted">
                      AM {a.accountManager ?? '—'} · SKU gap{' '}
                      {a.skuNotAuthorized}/{a.skuTracked}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
