export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="card p-6 mt-4 text-center">
        <div className="text-3xl mb-2">🛠️</div>
        <div className="font-medium">Coming soon</div>
        <p className="text-sm text-muted mt-1">{blurb}</p>
        <p className="text-xs text-muted mt-3">Phase 2 — not yet built.</p>
      </div>
    </div>
  )
}
