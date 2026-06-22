import { AUTH_NOT_AUTHORIZED } from '../config/methodology'

// Auth status — color is ALWAYS paired with an icon + label (never color-only).
export function AuthBadge({ status }: { status: string | null }) {
  const notAuth = status === AUTH_NOT_AUTHORIZED
  const authorized = status != null && !notAuth
  if (!status)
    return <span className="text-muted text-xs">— n/a</span>
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
        authorized
          ? 'bg-good/15 text-good'
          : 'bg-bad/15 text-bad'
      }`}
    >
      <span aria-hidden>{authorized ? '✓' : '✗'}</span>
      {status}
    </span>
  )
}

export function Pill({
  children,
  color = '#64748b',
}: {
  children: React.ReactNode
  color?: string
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {children}
    </span>
  )
}
