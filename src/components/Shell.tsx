import { useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/store'
import { useLocalStorage } from '../lib/useLocalStorage'
import { ErrorBoundary } from './ErrorBoundary'

const DEFAULT_NAV = [
  { to: '/accounts', label: 'Account Management' },
  { to: '/battlecards', label: 'Battlecards' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/distribution', label: 'Distribution' },
  { to: '/dsd-coverage', label: 'DSD Coverage' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/trade-spend', label: 'Trade Spend' },
  { to: '/margin', label: 'Margin' },
  { to: '/calendar', label: 'Calendar' },
]

// Reorder DEFAULT_NAV per a saved list of `to` paths — unknown/removed paths
// are dropped, newly added pages are appended so they still show up.
function applyOrder(order: string[]): typeof DEFAULT_NAV {
  const byTo = new Map(DEFAULT_NAV.map((n) => [n.to, n]))
  const ordered = order.map((to) => byTo.get(to)).filter((n): n is (typeof DEFAULT_NAV)[number] => !!n)
  const seen = new Set(ordered.map((n) => n.to))
  const rest = DEFAULT_NAV.filter((n) => !seen.has(n.to))
  return [...ordered, ...rest]
}

export function Shell() {
  const { user, signOut } = useAuth()
  const { lastRefresh, refresh, loading } = useData()
  const location = useLocation()

  const [order, setOrder] = useLocalStorage<string[]>(
    'nav_order',
    DEFAULT_NAV.map((n) => n.to),
  )
  const nav = useMemo(() => applyOrder(order), [order])

  const [dragTo, setDragTo] = useState<string | null>(null)
  const [overTo, setOverTo] = useState<string | null>(null)
  const draggingRef = useRef(false)

  const onDrop = (targetTo: string) => {
    if (!dragTo || dragTo === targetTo) return
    setOrder((prev) => {
      const cur = applyOrder(prev).map((n) => n.to)
      const from = cur.indexOf(dragTo)
      const to = cur.indexOf(targetTo)
      if (from < 0 || to < 0) return prev
      const next = [...cur]
      next.splice(from, 1)
      next.splice(to, 0, dragTo)
      return next
    })
  }

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 glass-nav border-r border-white/10 flex flex-col">
        <div className="px-4 py-3 border-b border-white/10 space-y-2">
          <div className="bg-white rounded p-2">
            <img
              src="/Odyssey_Logo_FUNCTIONAL.png"
              alt="Odyssey Functional Energy"
              className="h-16 w-auto"
            />
          </div>
          <div className="text-[11px] text-muted tracking-wide">
            AI Mothership
          </div>
        </div>
        <nav className="flex-1 overflow-auto py-2">
          {nav.map((n) => (
            <div
              key={n.to}
              draggable
              onDragStart={(e) => {
                draggingRef.current = true
                setDragTo(n.to)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                draggingRef.current = false
                setDragTo(null)
                setOverTo(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (draggingRef.current) setOverTo(n.to)
              }}
              onDragLeave={() => setOverTo((cur) => (cur === n.to ? null : cur))}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(n.to)
                setOverTo(null)
              }}
              className={`group relative ${overTo === n.to && dragTo !== n.to ? 'bg-accent/10' : ''}`}
            >
              <NavLink
                to={n.to}
                className={({ isActive }) =>
                  `block px-4 py-2 text-sm border-l-2 transition-colors cursor-grab active:cursor-grabbing ${
                    isActive
                      ? 'border-accent bg-white/10 text-text'
                      : 'border-transparent text-muted hover:text-text hover:bg-white/5'
                  } ${dragTo === n.to ? 'opacity-40' : ''}`
                }
              >
                {n.label}
              </NavLink>
            </div>
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
