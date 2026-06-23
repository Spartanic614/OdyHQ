import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/store'

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/accounts', label: 'Account Management' },
  { to: '/distribution', label: 'Distribution' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/merchandising', label: 'Merchandising' },
  { to: '/trade-spend', label: 'Trade Spend' },
  { to: '/margin', label: 'Margin' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/portfolio', label: 'Portfolio' },
]

const PHASE2 = [
  { to: '/soon/promomash', label: 'PromoMash' },
  { to: '/soon/dsd-map', label: 'DSD County Map' },
  { to: '/soon/merch', label: 'Merch One-Pagers' },
]

export function Shell() {
  const { user, signOut } = useAuth()
  const { lastRefresh, refresh, loading } = useData()

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 glass-nav border-r border-white/10 flex flex-col">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-lg font-bold tracking-tight brand">
            Odyssey Mothership
          </div>
          <div className="text-[11px] text-muted tracking-wide">
            Sales decision tool
          </div>
        </div>
        <nav className="flex-1 overflow-auto py-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm border-l-2 transition-colors ${
                  isActive
                    ? 'border-accent bg-white/10 text-text'
                    : 'border-transparent text-muted hover:text-text hover:bg-white/5'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
          <div className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-wider text-muted">
            Phase 2
          </div>
          {PHASE2.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `block px-4 py-1.5 text-xs border-l-2 transition-colors ${
                  isActive
                    ? 'border-ink-500 bg-white/5 text-muted'
                    : 'border-transparent text-muted/60 hover:text-muted hover:bg-white/5'
                }`
              }
            >
              {n.label}
              <span className="ml-1 text-[9px] opacity-60">soon</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 shrink-0 border-b border-white/10 glass-nav flex items-center gap-3 px-4">
          <div className="flex-1" />
          <button
            className="btn text-xs"
            onClick={refresh}
            disabled={loading}
            title="Reload data from Supabase"
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <span className="text-xs text-muted">
            {lastRefresh
              ? `Updated ${lastRefresh.toLocaleTimeString('en-US')}`
              : '—'}
          </span>
          <span className="text-xs text-muted border-l border-ink-700 pl-3">
            {user?.email}
          </span>
          <button className="btn text-xs" onClick={() => signOut()}>
            Sign out
          </button>
        </header>

        <main className="flex-1 overflow-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
