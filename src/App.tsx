import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { DataProvider } from './data/store'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { AccountManagement } from './pages/AccountManagement'
import { Distribution } from './pages/Distribution'
import { CalendarPage } from './pages/Calendar'
import { Portfolio } from './pages/Portfolio'
import { Inventory } from './pages/Inventory'
import { Merchandising } from './pages/Merchandising'
import { TradeSpend } from './pages/TradeSpend'
import { Margin } from './pages/Margin'
import { ComingSoon } from './pages/ComingSoon'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted">
        Loading…
      </div>
    )
  }

  // Auth gate — unauthenticated users only ever see the login screen.
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <DataProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Overview />} />
          <Route path="accounts" element={<AccountManagement />} />
          <Route path="distribution" element={<Distribution />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="merchandising" element={<Merchandising />} />
          <Route path="trade-spend" element={<TradeSpend />} />
          <Route path="margin" element={<Margin />} />
          <Route
            path="soon/promomash"
            element={<ComingSoon title="PromoMash" blurb="Promo planning integration." />}
          />
          <Route
            path="soon/dsd-map"
            element={
              <ComingSoon
                title="DSD County Map"
                blurb="County choropleth (FIPS data exists)."
              />
            }
          />
          <Route
            path="soon/merch"
            element={<ComingSoon title="Merch One-Pagers" blurb="Merchandising sheets." />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
