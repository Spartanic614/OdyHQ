import { PORTFOLIO_SKUS, portfolioCropFor } from '../config/skuPortfolio'
import { SkuCanImage, skuCanAspect } from './SkuCan'
import { theme } from '../theme'
import type { BattlecardSku } from '../lib/battlecardPdf'

export function SkuPortfolioGrid({
  skuRows,
  authorized,
  tracked,
}: {
  skuRows: BattlecardSku[]
  authorized: number
  tracked: number
}) {
  const pictured = skuRows.filter((s) => portfolioCropFor(s.flavor))
  const unpictured = skuRows.filter((s) => !portfolioCropFor(s.flavor))
  // Preserve exact portfolio-image order for pictured SKUs; append the rest.
  const ordered = [
    ...PORTFOLIO_SKUS.map((p) => pictured.find((s) => s.flavor === p.flavor)).filter(
      (s): s is BattlecardSku => !!s,
    ),
    ...unpictured,
  ]

  const pct = tracked > 0 ? Math.round((authorized / tracked) * 100) : 0

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          SKU Authorization
        </div>
        <div className="text-sm">
          <span className="font-semibold text-text">{authorized}</span>
          <span className="text-muted"> / {tracked} Authorized</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: theme.good }}
        />
      </div>

      {/* Always a single row — cards share available width evenly, then
          scroll horizontally once they hit their minimum legible size. */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {ordered.map((s) => (
          <SkuCard key={s.code} sku={s} />
        ))}
      </div>
    </div>
  )
}

function SkuCard({ sku }: { sku: BattlecardSku }) {
  const crop = portfolioCropFor(sku.flavor)
  const authorized = sku.status === 'Authorized'
  const tracked = sku.status !== '—'
  const dimmed = !authorized

  const statusLabel = authorized ? 'Authorized' : tracked ? 'Not Authorized' : 'No Data'

  return (
    <div className="group relative flex-1 basis-0 min-w-[64px] sm:min-w-[76px] snap-start">
      <div
        className="relative rounded-lg overflow-hidden border transition-all duration-150 group-hover:-translate-y-0.5"
        style={{
          aspectRatio: skuCanAspect(sku.flavor),
          backgroundColor: theme.surfaceAlt,
          borderColor: authorized ? `${theme.good}55` : theme.border,
          boxShadow: authorized
            ? `0 0 0 1px ${theme.good}33, 0 4px 14px -6px ${theme.good}40`
            : undefined,
          containerType: 'inline-size',
        }}
      >
        {crop ? (
          <SkuCanImage flavor={sku.flavor} dimmed={dimmed} />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-center px-1.5"
            style={{
              filter: dimmed ? 'grayscale(1)' : 'none',
              opacity: dimmed ? 0.4 : 0.85,
            }}
          >
            <span className="text-[10px] leading-tight text-muted">{sku.flavor}</span>
          </div>
        )}

        {/* Status badge */}
        <div
          className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] leading-none"
          style={{
            backgroundColor: authorized ? `${theme.good}` : `${theme.bg}cc`,
            color: authorized ? theme.bg : theme.textMuted,
            border: authorized ? 'none' : `1px solid ${theme.border}`,
          }}
          aria-hidden
        >
          {authorized ? '✓' : tracked ? '✕' : '·'}
        </div>
      </div>

      {/* Tooltip */}
      <div
        className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-xs opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-10"
        style={{ backgroundColor: theme.surfaceAlt, border: `1px solid ${theme.border}` }}
      >
        <div className="font-medium text-text">{sku.flavor}</div>
        <div className="text-muted">{statusLabel}</div>
      </div>
    </div>
  )
}
