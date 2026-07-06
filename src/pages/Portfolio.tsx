import { useMemo, useState } from 'react'
import { useData, type Sku } from '../data/store'
import { SkuCanImage, hasSkuCanArt, skuCanAspect } from '../components/SkuCan'
import { Pill } from '../components/StatusBadge'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { CopyButton } from '../components/CopyButton'
import { DataTable, type Column } from '../components/DataTable'
import { TableSkeleton, EmptyState, ErrorBanner } from '../components/States'
import { exportCsv } from '../lib/csv'
import { fmtUsd, fmtDate } from '../lib/format'
import { theme } from '../theme'
import { AUTH_NOT_AUTHORIZED } from '../config/methodology'

type SortKey = 'alpha' | 'launch'
type ViewMode = 'grid' | 'list'

interface SkuMeta extends Sku {
  channels: string[]
  authorizedChainCount: number
  trackedChainCount: number
}

const STATUS_COLOR: Record<string, string> = {
  Core: theme.good,
  'Limited Time': theme.warn,
  Seasonal: theme.info,
  Innovation: theme.accent,
  Discontinued: theme.bad,
}

// Product progression order (matching marketing image)
const PROGRESSION_ORDER = [
  'Pineapple Mango',
  'Blue Raspberry',
  'Pink Lemonade',
  'Strawberry Watermelon',
  'Dragon Fruit Lemonade',
  'Blackberry Lemonade',
  'Passion Fruit Guava',
  'Tropical Breeze',
  'Mandarin Orange',
]

const NEW_WINDOW_DAYS = 180

function isNew(launchDate: string | null): boolean {
  if (!launchDate) return false
  const d = new Date(launchDate)
  if (isNaN(d.getTime())) return false
  const days = (Date.now() - d.getTime()) / 86_400_000
  return days >= 0 && days <= NEW_WINDOW_DAYS
}

export function Portfolio() {
  const { skus, chainSkuAuth, chains, loading } = useData()
  const [search, setSearch] = useState('')
  const [line, setLine] = useState('')
  const [status, setStatus] = useState('')
  const [channelAuth, setChannelAuth] = useState('')
  const [sort, setSort] = useState<SortKey>('alpha')
  const [view, setView] = useState<ViewMode>('grid')
  const [selected, setSelected] = useState<SkuMeta | null>(null)

  const chainById = useMemo(
    () => new Map(chains.rows.map((c) => [c.chain_id, c])),
    [chains.rows],
  )

  const skuMeta: SkuMeta[] = useMemo(() => {
    return skus.rows.map((s) => {
      const authRows = chainSkuAuth.rows.filter((r) => r.sku_code === s.sku_code)
      const authorized = authRows.filter(
        (r) => r.auth_status != null && r.auth_status !== AUTH_NOT_AUTHORIZED,
      )
      const channelSet = new Set<string>()
      for (const r of authorized) {
        const ch = chainById.get(r.chain_id)?.channel
        if (ch) channelSet.add(ch)
      }
      return {
        ...s,
        channels: [...channelSet].sort(),
        authorizedChainCount: authorized.length,
        trackedChainCount: authRows.length,
      }
    })
  }, [skus.rows, chainSkuAuth.rows, chainById])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = skuMeta.filter((s) => {
      if (q) {
        const hay = [
          s.flavor,
          s.product_name,
          s.retail_upc,
          s.gtin,
          s.sku_code,
          s.unfi_west_item,
          s.unfi_east_item,
          s.kehe_item_number,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (line && s.mg !== line) return false
      if (status && s.product_status !== status) return false
      if (channelAuth === 'Authorized' && s.authorizedChainCount === 0) return false
      if (channelAuth === 'Unauthorized' && s.authorizedChainCount > 0) return false
      return true
    })
    rows = [...rows].sort((a, b) => {
      if (sort === 'launch') {
        const ad = a.launch_date ? new Date(a.launch_date).getTime() : -Infinity
        const bd = b.launch_date ? new Date(b.launch_date).getTime() : -Infinity
        return bd - ad
      }
      return (a.flavor ?? a.sku_code).localeCompare(b.flavor ?? b.sku_code)
    })
    return rows
  }, [skuMeta, search, line, status, channelAuth, sort])

  const lineOptions = uniqueValues(skus.rows, (s) => s.mg)
  const statusOptions = uniqueValues(skus.rows, (s) => s.product_status)

  const handleExport = () => {
    exportCsv(
      'odyssey_portfolio',
      filtered.map((s) => ({
        SKU: s.sku_code,
        Flavor: s.flavor,
        'Product Name': s.product_name,
        Line: s.mg,
        Pack: s.pack,
        'Package Size': s.package_size,
        UPC: s.retail_upc,
        GTIN: s.gtin,
        'UNFI West Item #': s.unfi_west_item,
        'UNFI East Item #': s.unfi_east_item,
        'KeHE Item #': s.kehe_item_number,
        SRP: s.srp,
        'Dist Case Cost': s.dist_case_cost,
        'Case Dimensions': s.case_dimensions,
        'Case Weight': s.case_weight,
        'Pallet Config': s.pallet_config,
        'Shelf Life': s.shelf_life,
        Status: s.product_status,
        'Launch Date': s.launch_date,
        'Channels Authorized': s.channels.join('; '),
        'Chains Authorized': s.authorizedChainCount,
        'Chains Tracked': s.trackedChainCount,
      })),
    )
  }

  if (loading) return <TableSkeleton />
  if (skus.error) return <ErrorBanner table="dim_sku" message={skus.error} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Portfolio Offerings</h1>
          <p className="text-sm text-muted">
            The full Odyssey product catalog — specs, logistics, and channel authorization in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-ink-700">
            <button
              className={`px-2.5 py-1.5 text-sm ${view === 'grid' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
              onClick={() => setView('grid')}
            >
              ▦ Grid
            </button>
            <button
              className={`px-2.5 py-1.5 text-sm ${view === 'list' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
              onClick={() => setView('list')}
            >
              ☰ List
            </button>
          </div>
          <button className="btn text-sm" onClick={handleExport} disabled={!filtered.length}>
            ⤓ Export CSV
          </button>
        </div>
      </div>

      <div className="card p-2 flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-48"
          placeholder="Search flavor, UPC, or GTIN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectFilter label="Line" value={line} onChange={setLine} options={lineOptions} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={statusOptions} />
        <SelectFilter
          label="Channel"
          value={channelAuth}
          onChange={setChannelAuth}
          options={['Authorized', 'Unauthorized']}
        />
        <label className="inline-flex items-center gap-1 text-xs text-muted">
          Sort
          <select
            className="input py-1"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="alpha">Alphabetical</option>
            <option value="launch">Newest First</option>
          </select>
        </label>
        <span className="text-xs text-muted px-1 ml-auto">{filtered.length} SKUs</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No SKUs match the current filters." />
      ) : view === 'grid' ? (
        <div className="grid gap-2 grid-cols-9 pb-4">
          {filtered
            .sort((a, b) => {
              const aIdx = PROGRESSION_ORDER.indexOf(a.flavor ?? '')
              const bIdx = PROGRESSION_ORDER.indexOf(b.flavor ?? '')
              if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
              if (aIdx >= 0) return -1
              if (bIdx >= 0) return 1
              return 0
            })
            .map((s) => {
              const skuNum = s.sku_code?.replace(/[^\d]/g, '') // Extract just the numbers
              const isVarietyPack = skuNum === '222' || skuNum === '85'
              const varietyPackImage = skuNum === '222' ? '/222%20Variety%20Pack.jpg' : skuNum === '85' ? '/85%20Variety%20Pack.png' : null
              return (
                <div key={s.sku_code} className="w-full">
                  <button
                    onClick={() => setSelected(s)}
                    className="group text-left card p-2 space-y-1.5 hover:-translate-y-0.5 transition-transform duration-150 h-full w-full"
                  >
                    <div
                      className="relative rounded-md overflow-hidden border bg-black flex items-center justify-center"
                      style={{
                        aspectRatio: isVarietyPack ? '3/4' : skuCanAspect(s.flavor ?? s.sku_code),
                        backgroundColor: '#000000',
                        borderColor: '#1f2937',
                        containerType: 'inline-size',
                      }}
                    >
                      {isVarietyPack && varietyPackImage ? (
                        <img src={varietyPackImage} alt={`${skuNum === '222' ? '2' : '3'} Flavor Pack`} className="w-full h-full object-contain" />
                      ) : hasSkuCanArt(s.flavor ?? s.sku_code) ? (
                        <SkuCanImage flavor={s.flavor ?? s.sku_code} dimmed={false} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center px-1 text-center">
                          <span className="text-[9px] text-muted">{s.flavor}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-[9px] text-muted text-center truncate">{s.flavor || `${skuNum === '222' ? '2' : '3'} Flavor Pack`}</div>
                  </button>
                </div>
              )
            })}
        </div>
      ) : (
        <PortfolioTable rows={filtered} onRowClick={setSelected} />
      )}

      {selected && <ProductModal sku={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function PortfolioTable({
  rows,
  onRowClick,
}: {
  rows: SkuMeta[]
  onRowClick: (s: SkuMeta) => void
}) {
  const columns: Column<SkuMeta>[] = [
    {
      key: 'image',
      label: '',
      noExport: true,
      className: 'w-14',
      render: (s) => {
        const flavor = s.flavor ?? s.sku_code
        return (
          <div
            className="relative rounded overflow-hidden border"
            style={{
              width: 32,
              aspectRatio: skuCanAspect(flavor),
              backgroundColor: theme.surfaceAlt,
              borderColor: theme.border,
              containerType: 'inline-size',
            }}
          >
            {hasSkuCanArt(flavor) && <SkuCanImage flavor={flavor} dimmed={false} />}
          </div>
        )
      },
    },
    { key: 'flavor', label: 'Flavor', value: (s) => s.flavor ?? s.sku_code },
    { key: 'product_name', label: 'Product Name', value: (s) => s.product_name },
    { key: 'pack', label: 'Pack', value: (s) => s.pack },
    { key: 'retail_upc', label: 'UPC', value: (s) => s.retail_upc },
    { key: 'gtin', label: 'GTIN', value: (s) => s.gtin },
    { key: 'srp', label: 'SRP', align: 'right', value: (s) => s.srp, render: (s) => fmtUsd(s.srp) },
    {
      key: 'status',
      label: 'Status',
      value: (s) => s.product_status,
      render: (s) =>
        s.product_status ? (
          <Pill color={STATUS_COLOR[s.product_status] ?? theme.neutral}>{s.product_status}</Pill>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'auth',
      label: 'Authorized',
      align: 'right',
      value: (s) => s.authorizedChainCount,
      render: (s) =>
        s.trackedChainCount > 0 ? `${s.authorizedChainCount}/${s.trackedChainCount}` : '—',
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(s) => s.sku_code}
      onRowClick={onRowClick}
      searchable={false}
      exportName="odyssey_portfolio"
      emptyMessage="No SKUs match the current filters."
    />
  )
}

function ProductModal({ sku, onClose }: { sku: SkuMeta; onClose: () => void }) {
  const flavor = sku.flavor ?? sku.sku_code
  const statusColor = sku.product_status ? STATUS_COLOR[sku.product_status] ?? theme.neutral : null

  const specs: [string, React.ReactNode][] = [
    ['Product Name', sku.product_name ?? '—'],
    ['Package Size', sku.package_size ?? '—'],
    ['Pack Configuration', sku.pack ?? '—'],
    ['Caffeine', sku.mg ?? '—'],
    [
      'UPC',
      sku.retail_upc ? (
        <span className="inline-flex items-center gap-2">
          {sku.retail_upc} <CopyButton value={sku.retail_upc} label="UPC" />
        </span>
      ) : (
        '—'
      ),
    ],
    [
      'GTIN',
      sku.gtin ? (
        <span className="inline-flex items-center gap-2">
          {sku.gtin} <CopyButton value={sku.gtin} label="GTIN" />
        </span>
      ) : (
        '—'
      ),
    ],
    [
      'UNFI West Item #',
      sku.unfi_west_item ? (
        <span className="inline-flex items-center gap-2">
          {sku.unfi_west_item} <CopyButton value={sku.unfi_west_item} label="UNFI West item #" />
        </span>
      ) : (
        '—'
      ),
    ],
    [
      'UNFI East Item #',
      sku.unfi_east_item ? (
        <span className="inline-flex items-center gap-2">
          {sku.unfi_east_item} <CopyButton value={sku.unfi_east_item} label="UNFI East item #" />
        </span>
      ) : (
        '—'
      ),
    ],
    [
      'KeHE Item #',
      sku.kehe_item_number ? (
        <span className="inline-flex items-center gap-2">
          {sku.kehe_item_number} <CopyButton value={sku.kehe_item_number} label="KeHE item #" />
        </span>
      ) : (
        '—'
      ),
    ],
    ['SRP', fmtUsd(sku.srp)],
    ['Distributor Case Cost', fmtUsd(sku.dist_case_cost)],
    ['Case Dimensions', sku.case_dimensions ?? '—'],
    ['Case Weight', sku.case_weight ?? '—'],
    ['Pallet Configuration', sku.pallet_config ?? '—'],
    ['Shelf Life', sku.shelf_life ?? '—'],
    ['Launch Date', fmtDate(sku.launch_date)],
    ['Channels Authorized', sku.channels.length ? sku.channels.join(', ') : '—'],
    [
      'Chain Authorization',
      sku.trackedChainCount > 0
        ? `${sku.authorizedChainCount} of ${sku.trackedChainCount} tracked chains`
        : '—',
    ],
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card max-w-2xl w-full max-h-[85vh] overflow-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold">{flavor}</div>
            {sku.product_name && <div className="text-sm text-muted">{sku.product_name}</div>}
          </div>
          <button className="btn text-sm" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div
            className="relative rounded-lg overflow-hidden border"
            style={{
              aspectRatio: skuCanAspect(flavor),
              backgroundColor: theme.surfaceAlt,
              borderColor: theme.border,
              containerType: 'inline-size',
            }}
          >
            {hasSkuCanArt(flavor) ? (
              <SkuCanImage flavor={flavor} dimmed={false} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
                <span className="text-sm text-muted">{flavor}</span>
              </div>
            )}
            <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
              {isNew(sku.launch_date) && <Pill color={theme.info}>New</Pill>}
              {statusColor && <Pill color={statusColor}>{sku.product_status}</Pill>}
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {specs.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="text-xs text-muted">{label}</span>
                <span className="text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {sku.notes && (
          <div className="border-t border-ink-700 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              Notes
            </div>
            <div className="text-sm">{sku.notes}</div>
          </div>
        )}

        {sku.sell_sheet_url && (
          <div className="border-t border-ink-700 pt-3">
            <a
              href={sku.sell_sheet_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent hover:underline"
            >
              ↗ View Sell Sheet
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
