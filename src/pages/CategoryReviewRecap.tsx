import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { parseCategoryReviewData, summarizeCategoryReviews, CORE_222_FLAVORS } from '../lib/categoryReviewRecap'
import { useLocalStorage } from '../lib/useLocalStorage'
import { hasSkuCanArt, SkuCanImage, skuCanAspect } from '../components/SkuCan'
import { channelGroup } from '../config/methodology'
import { fmtInt, fmtPct } from '../lib/format'
import { theme, chartPalette } from '../theme'

const STATUS_COLOR: Record<string, string> = {
  Complete: theme.good,
  'Not Completed': theme.warn,
}

// "Conventional" here is the same Large Format group used app-wide (see
// channelGroup) — the button just uses the label the business calls it.
const MOST_WANTED_CHANNELS = [
  { label: 'Conventional', group: 'Large Format' },
  { label: 'Natural', group: 'Natural' },
] as const

const tooltipStyle = { backgroundColor: '#13161b', border: `1px solid ${theme.border}`, fontSize: '12px' }

const PLACEHOLDER = `Paste the raw dataset here — a tab-separated block with a header row, e.g. copied straight out of Excel or Google Sheets.

Expects columns like: Chain, Active/Not Active, Region, State, Total Universe, Account Manager, Channel, Broker, Category Review Period, Category Review Status, Date Scheduled, Distributor, Notes, 2025/2026 Energy Set, then one column per SKU with an Authorized / Not Authorized / Declined status.`

export function CategoryReviewRecap() {
  const [raw, setRaw] = useLocalStorage<string>('category_review_recap_raw', '')
  const [editing, setEditing] = useState(!raw)
  const [amFilter, setAmFilter] = useState('All')
  const [mostWantedChannel, setMostWantedChannel] = useState<(typeof MOST_WANTED_CHANNELS)[number]['label']>(
    'Conventional',
  )

  const { chains: allChains, skuColumns } = useMemo(() => parseCategoryReviewData(raw), [raw])

  const accountManagers = useMemo(
    () => Array.from(new Set(allChains.map((c) => c.accountManager))).sort(),
    [allChains],
  )

  const chains = useMemo(
    () => (amFilter === 'All' ? allChains : allChains.filter((c) => c.accountManager === amFilter)),
    [allChains, amFilter],
  )

  const s = useMemo(() => summarizeCategoryReviews(chains), [chains])

  const mostWantedGroup = MOST_WANTED_CHANNELS.find((c) => c.label === mostWantedChannel)!.group
  const mostWanted = useMemo(
    () =>
      chains
        .filter((c) => channelGroup(c.channel) === mostWantedGroup)
        .filter((c) => c.reviewStatus !== 'Complete')
        .sort((a, b) => (b.totalUniverse || 0) - (a.totalUniverse || 0))
        .slice(0, 12),
    [chains, mostWantedGroup],
  )

  const hasData = allChains.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Category Review Recap</h1>
          <p className="text-sm text-muted">
            Paste a raw category review export below — every number on this page is computed live from it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <button className="btn text-xs" onClick={() => setEditing((v) => !v)}>
              {editing ? '▲ Hide paste box' : '✎ Edit data'}
            </button>
          )}
          {hasData && (
            <button
              className="btn text-xs"
              onClick={() => {
                setRaw('')
                setEditing(true)
              }}
            >
              ↺ Clear
            </button>
          )}
        </div>
      </div>

      {(editing || !hasData) && (
        <div className="card p-3 space-y-2">
          <textarea
            className="input w-full font-mono text-xs"
            style={{ minHeight: 220, resize: 'vertical' }}
            placeholder={PLACEHOLDER}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{hasData ? `Parsed ${allChains.length} chains · ${skuColumns.length} SKU columns` : 'Waiting for data…'}</span>
            {hasData && (
              <button className="text-accent hover:underline" onClick={() => setEditing(false)}>
                Done editing
              </button>
            )}
          </div>
        </div>
      )}

      {!hasData && (
        <div className="card p-10 text-center text-muted">
          Paste your raw category review dataset above to generate the dashboard.
        </div>
      )}

      {hasData && (
        <>
          {/* Account manager filter — applies to every section below */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Account Manager</span>
            <button
              className={`btn text-xs ${amFilter === 'All' ? 'btn-accent' : ''}`}
              onClick={() => setAmFilter('All')}
            >
              All
            </button>
            {accountManagers.map((am) => (
              <button
                key={am}
                className={`btn text-xs ${amFilter === am ? 'btn-accent' : ''}`}
                onClick={() => setAmFilter(am)}
              >
                {am}
              </button>
            ))}
          </div>

          {/* KPI strip */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Stat label="Total Chains" value={fmtInt(s.totalChains)} detail={`${fmtInt(s.activeChains)} active`} color={theme.text} />
            <Stat
              label="Active Rate"
              value={fmtPct(s.totalChains > 0 ? s.activeChains / s.totalChains : 0, 0)}
              detail={`${fmtInt(s.notActiveChains)} not active`}
              color={theme.good}
            />
            <Stat label="Active Universe" value={fmtInt(s.activeUniverseSum)} detail={`${fmtInt(s.totalUniverseSum)} total outlets`} color={theme.info} />
            <Stat
              label="Reviews Completed"
              value={fmtPct(s.completionRate, 0)}
              detail={`${fmtInt(s.completedChains)} of ${fmtInt(s.totalChains)} — column Q = "Complete" only`}
              color={theme.good}
            />
            <Stat
              label="SKU Authorization Rate"
              value={fmtPct(s.overallAuthRate, 0)}
              detail="across decided SKU × chain pairs"
              color={theme.accent}
            />
          </div>

          {/* Review status breakdown */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Category Review Completion</h2>
            <div className="card p-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={s.statusCounts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
                  <XAxis dataKey="status" stroke={theme.textMuted} style={{ fontSize: '11px' }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke={theme.textMuted} style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtInt(v)} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="count" position="top" formatter={(v: number) => fmtInt(v)} style={{ fill: theme.text, fontSize: 11, fontWeight: 600 }} />
                    {s.statusCounts.map((row) => (
                      <Cell key={row.status} fill={STATUS_COLOR[row.status] ?? theme.neutral} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Breakdown charts */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Breakdowns</h2>
            <div className="grid gap-3 lg:grid-cols-3">
              <GroupChart title="By Account Manager" rows={s.byAccountManager} />
              <GroupChart title="By Channel" rows={s.byChannel} />
              <GroupChart title="By Distributor" rows={s.byDistributor} />
            </div>
          </section>

          {/* Needs attention / upcoming */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Accounts</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="card p-4 space-y-3">
                <div className="text-sm font-semibold" style={{ color: theme.warn }}>
                  ⚠ Needs Attention — largest active accounts without a scheduled review
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted">
                      <th className="text-left font-medium pb-1.5">Chain</th>
                      <th className="text-left font-medium pb-1.5">AM</th>
                      <th className="text-right font-medium pb-1.5">Universe</th>
                      <th className="text-left font-medium pb-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.needsAttention.map((c) => (
                      <tr key={c.chain} className="border-t border-white/5">
                        <td className="py-1.5">{c.chain}</td>
                        <td className="py-1.5 text-muted">{c.accountManager}</td>
                        <td className="py-1.5 text-right font-medium">{c.totalUniverse != null ? fmtInt(c.totalUniverse) : '—'}</td>
                        <td className="py-1.5 text-muted">{c.reviewStatusRaw || '—'}</td>
                      </tr>
                    ))}
                    {s.needsAttention.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-muted">
                          Nothing needs attention.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="card p-4 space-y-3">
                <div className="text-sm font-semibold" style={{ color: theme.info }}>
                  📅 Upcoming Scheduled Reviews
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted">
                      <th className="text-left font-medium pb-1.5">Chain</th>
                      <th className="text-left font-medium pb-1.5">AM</th>
                      <th className="text-left font-medium pb-1.5">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.upcoming.map((c) => (
                      <tr key={c.chain} className="border-t border-white/5">
                        <td className="py-1.5">{c.chain}</td>
                        <td className="py-1.5 text-muted">{c.accountManager}</td>
                        <td className="py-1.5 font-medium" style={{ color: theme.info }}>
                          {c.dateScheduled || '—'}
                        </td>
                      </tr>
                    ))}
                    {s.upcoming.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-center text-muted">
                          No scheduled reviews found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Most Wanted */}
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold">Most Wanted</h2>
              <div className="flex items-center gap-1">
                {MOST_WANTED_CHANNELS.map(({ label }) => (
                  <button
                    key={label}
                    className={`btn text-xs ${mostWantedChannel === label ? 'btn-accent' : ''}`}
                    onClick={() => setMostWantedChannel(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="card p-4 space-y-1">
              <div className="text-xs text-muted mb-2">
                Biggest {mostWantedChannel.toLowerCase()} accounts still without a completed review, by outlet count.
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left font-medium pb-1.5">Chain</th>
                    <th className="text-left font-medium pb-1.5">AM</th>
                    <th className="text-right font-medium pb-1.5">Universe</th>
                    <th className="text-left font-medium pb-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mostWanted.map((c) => (
                    <tr key={c.chain} className="border-t border-white/5">
                      <td className="py-1.5">{c.chain}</td>
                      <td className="py-1.5 text-muted">{c.accountManager}</td>
                      <td className="py-1.5 text-right font-medium">{c.totalUniverse != null ? fmtInt(c.totalUniverse) : '—'}</td>
                      <td className="py-1.5 text-muted">{c.reviewStatusRaw || '—'}</td>
                    </tr>
                  ))}
                  {mostWanted.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-muted">
                        No {mostWantedChannel.toLowerCase()} accounts pending.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Full 222 authorization gaps */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Full 222 Authorization Gaps</h2>
            <div className="card p-4 space-y-1">
              <div className="text-xs text-muted mb-2">
                Active accounts missing at least one core 222mg flavor ({CORE_222_FLAVORS.join(', ')}).
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left font-medium pb-1.5">Chain</th>
                    <th className="text-left font-medium pb-1.5">AM</th>
                    <th className="text-right font-medium pb-1.5">Universe</th>
                    <th className="text-left font-medium pb-1.5">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {s.core222Gaps.map(({ chain: c, missing }) => (
                    <tr key={c.chain} className="border-t border-white/5">
                      <td className="py-1.5">{c.chain}</td>
                      <td className="py-1.5 text-muted">{c.accountManager}</td>
                      <td className="py-1.5 text-right font-medium">{c.totalUniverse != null ? fmtInt(c.totalUniverse) : '—'}</td>
                      <td className="py-1.5" style={{ color: theme.bad }}>
                        {missing.join(', ')}
                      </td>
                    </tr>
                  ))}
                  {s.core222Gaps.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-muted">
                        Every active account has the full 222 line authorized.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* SKU authorization scoreboard */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">SKU Authorization Scoreboard</h2>
            <div className="card p-4 space-y-2.5">
              {s.skuStats.map((row) => {
                const pct = Math.round(row.rate * 100)
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    {hasSkuCanArt(row.label) ? (
                      <div
                        className="relative rounded overflow-hidden border bg-black shrink-0"
                        style={{ width: 24, aspectRatio: skuCanAspect(row.label), borderColor: theme.border, containerType: 'inline-size' }}
                      >
                        <SkuCanImage flavor={row.label} dimmed={false} />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded bg-white/5 border border-white/10 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="truncate">{row.label}</span>
                        <span className="font-semibold ml-2">
                          {pct}% <span className="text-muted font-normal">({row.authorized}/{row.authorized + row.notAuthorized + row.declined})</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: theme.good }} />
                        <div
                          className="h-full"
                          style={{
                            width: `${row.authorized + row.notAuthorized + row.declined > 0 ? (row.declined / (row.authorized + row.notAuthorized + row.declined)) * 100 : 0}%`,
                            backgroundColor: theme.bad,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, detail, color }: { label: string; value: string; detail: string; color?: string }) {
  return (
    <div className="card p-4 space-y-2">
      <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-2xl font-bold" style={{ color: color ?? theme.text }}>
          {value}
        </div>
        <div className="text-xs text-muted text-right">{detail}</div>
      </div>
    </div>
  )
}

function GroupChart({
  title,
  rows,
}: {
  title: string
  rows: { name: string; total: number; active: number }[]
}) {
  const top = rows.slice(0, 8)
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={top} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f38" />
          <XAxis type="number" stroke={theme.textMuted} style={{ fontSize: '11px' }} />
          <YAxis dataKey="name" type="category" stroke={theme.textMuted} style={{ fontSize: '11px' }} width={100} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtInt(v)} />
          <Bar dataKey="total" radius={[0, 8, 8, 0]} isAnimationActive={false}>
            <LabelList dataKey="total" position="right" formatter={(v: number) => fmtInt(v)} style={{ fill: theme.text, fontSize: 11, fontWeight: 600 }} />
            {top.map((row, i) => (
              <Cell key={row.name} fill={chartPalette[i % chartPalette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
