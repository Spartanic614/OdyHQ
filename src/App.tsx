import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { DataProvider } from './data/store'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { DemoExecutiveSummary } from './pages/DemoExecutiveSummary'
import { DemoDataFlow } from './pages/DemoDataFlow'
import { AccountManagement } from './pages/AccountManagement'
import { Battlecards } from './pages/Battlecards'
import { Portfolio } from './pages/Portfolio'
import { Distribution } from './pages/Distribution'
import { DsdCoverage } from './pages/DsdCoverage'
import { CalendarPage } from './pages/Calendar'
import { Inventory } from './pages/Inventory'
import { TradeSpend } from './pages/TradeSpend'
import { Margin } from './pages/Margin'

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
          <Route index element={<Navigate to="/demo-executive-summary" replace />} />
          <Route path="demo-executive-summary" element={<DemoExecutiveSummary />} />
          <Route path="demo-data-flow" element={<DemoDataFlow />} />
          <Route path="accounts" element={<AccountManagement />} />
          <Route path="battlecards" element={<Battlecards />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="distribution" element={<Distribution />} />
          <Route path="dsd-coverage" element={<DsdCoverage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="trade-spend" element={<TradeSpend />} />
          <Route path="margin" element={<Margin />} />
          <Route path="*" element={<Navigate to="/demo-executive-summary" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
