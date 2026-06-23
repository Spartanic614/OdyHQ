import type { ReactNode } from 'react'

export function DetailDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-xl glass-nav border-l border-white/10 h-full overflow-auto shadow-2xl">
        <div className="sticky top-0 glass-nav border-b border-white/10 px-5 py-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
          </div>
          <button className="btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="p-5 space-y-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5">{children ?? '—'}</div>
    </div>
  )
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
}

export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text border-b border-ink-700 pb-1 mb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}
