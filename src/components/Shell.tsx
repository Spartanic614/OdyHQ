import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/store'
import { ErrorBoundary } from './ErrorBoundary'

const NAV = [
  { to: '/accounts', label: 'Account Management' },
  { to: '/distribution', label: 'Distribution' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/merchandising', label: 'Merchandising' },
  { to: '/trade-spend', label: 'Trade Spend' },
  { to: '/margin', label: 'Margin' },
  { to: '/unfi-ar', label: 'UNFI AR Tool' },
  { to: '/vlookup', label: 'VLOOKUP / Match' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/portfolio', label: 'Portfolio' },
]

export function Shell() {
  const { user, signOut } = useAuth()
  const { lastRefresh, refresh, loading } = useData()
  const location = useLocation()

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
          {/* Keyed by route so navigating to another page clears any error. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
