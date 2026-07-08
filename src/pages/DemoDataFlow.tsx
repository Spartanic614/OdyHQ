import { theme } from '../theme'

// ============================================================
// Conceptual diagram — every system below operates in its own
// silo today. Illustrates what centralizing them into Mothership
// HQ via each system's destination API would look like.
// ============================================================

const SYSTEMS = [
  { name: 'Channel Master', color: '#9db4c9' },
  { name: 'Natural Distributor', color: '#79c2b0' },
  { name: 'Amazon', color: '#d4b58c' },
  { name: 'Specialty Distribution', color: '#6f8aa0' },
  { name: 'Website', color: '#a7c4a0' },
  { name: 'Direct Retail', color: '#c6cdd6' },
  { name: 'Independent Wholesale', color: '#8f9aa8' },
  { name: 'E-Commerce', color: '#b6a7c2' },
  { name: 'TikTok', color: '#22d3ee' },
]

export function DemoDataFlow() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Demo - Data Flow</h1>
          <span
            className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full"
            style={{ color: theme.warn, backgroundColor: `${theme.warn}1a`, border: `1px solid ${theme.warn}55` }}
          >
            Concept
          </span>
        </div>
        <p className="text-sm text-muted">
          Every system below operates in its own silo today. This shows what it looks like once each one syncs
          into Mothership HQ via its own destination API — one centralized, cross-referenced source of truth.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {SYSTEMS.map((s) => (
          <div key={s.name} className="card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="font-medium text-sm truncate">{s.name}</span>
            </div>
            <span
              className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{ color: theme.info, backgroundColor: `${theme.info}1a`, border: `1px solid ${theme.info}44` }}
            >
              API →
            </span>
          </div>
        ))}
      </div>

      <FunnelArrows />

      <div
        className="card p-8 text-center space-y-3"
        style={{
          borderColor: `${theme.accent}66`,
          boxShadow: `0 0 0 1px ${theme.accent}33, 0 20px 60px -20px ${theme.accent}40`,
        }}
      >
        <div className="text-3xl font-extrabold tracking-tight">Mothership HQ</div>
        <div className="text-sm text-muted">One centralized, cross-referenced source of truth for every channel.</div>
        <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
          {['Centralized', 'Cross-Referenced', 'Always in Sync'].map((tag) => (
            <span
              key={tag}
              className="text-[10px] uppercase tracking-wide font-semibold px-2.5 py-1 rounded-full"
              style={{ color: theme.text, backgroundColor: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.border}` }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function FunnelArrows() {
  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <div className="hidden sm:flex gap-16 md:gap-24 lg:gap-32">
        <DownArrow />
        <DownArrow />
        <DownArrow />
      </div>
      <div className="sm:hidden">
        <DownArrow />
      </div>
      <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: theme.info }}>
        Syncing via API
      </div>
      <DownArrow size={22} />
    </div>
  )
}

function DownArrow({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v15m0 0l-6-6m6 6l6-6"
        stroke={theme.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
