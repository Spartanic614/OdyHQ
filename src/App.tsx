import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { DataProvider } from './data/store'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { AccountManagement } from './pages/AccountManagement'
import { Battlecards } from './pages/Battlecards'
import { Distribution } from './pages/Distribution'
import { DsdCoverage } from './pages/DsdCoverage'
import { CalendarPage } from './pages/Calendar'
import { Portfolio } from './pages/Portfolio'
import { Inventory } from './pages/Inventory'
import { Merchandising } from './pages/Merchandising'
import { TradeSpend } from './pages/TradeSpend'
import { Margin } from './pages/Margin'
import { UnfiArTool } from './pages/UnfiArTool'
import { Vlookup } from './pages/Vlookup'

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
          <Route index element={<Navigate to="/accounts" replace />} />
          <Route path="accounts" element={<AccountManagement />} />
          <Route path="battlecards" element={<Battlecards />} />
          <Route path="distribution" element={<Distribution />} />
          <Route path="dsd-coverage" element={<DsdCoverage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="merchandising" element={<Merchandising />} />
          <Route path="trade-spend" element={<TradeSpend />} />
          <Route path="margin" element={<Margin />} />
          <Route path="unfi-ar" element={<UnfiArTool />} />
          <Route path="vlookup" element={<Vlookup />} />
          <Route path="*" element={<Navigate to="/accounts" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
