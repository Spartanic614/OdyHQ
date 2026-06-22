// Loading skeletons, error banners, and empty states (§9).

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-ink-600 rounded ${className}`} />
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return <Skeleton className="h-24 w-full" />
}

export function ErrorBanner({
  table,
  message,
  onRetry,
}: {
  table?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="card border-bad/50 bg-bad/10 p-3 flex items-start justify-between gap-3">
      <div className="text-sm">
        <div className="font-semibold text-bad">
          Failed to load{table ? ` “${table}”` : ''}
        </div>
        <div className="text-muted mt-0.5">{message}</div>
      </div>
      {onRetry && (
        <button className="btn shrink-0" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center text-muted py-10 text-sm">{message}</div>
  )
}
