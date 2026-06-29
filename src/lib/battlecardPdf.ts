// ============================================================
// Account Battlecard PDF — a clean, printable one-pager per chain, built from
// the loaded data. jsPDF is dynamically imported so it stays out of the main
// bundle (loads only when the user exports).
// ============================================================
import type { jsPDF } from 'jspdf'

export interface BattlecardSku {
  code: string
  flavor: string
  status: 'Authorized' | 'Not Authorized' | '—'
}

export interface BattlecardData {
  chainName: string
  channel: string | null
  region: string | null
  state: string | null
  accountManager: string | null
  distributor: string | null
  greenSpoonManager: string | null
  infraNcg: string | null
  transitionalToDsd: string | null
  active: string | null
  totalUniverse: number | null
  currentSrp: number | null
  caseCost: number | null
  edlp: string | null
  reviewPeriod: string | null
  meetingProgress: string | null
  dateScheduled: string | null
  in2025: string | null
  in2026: string | null
  tier: string
  score: number
  skus: BattlecardSku[]
  skuAuthorized: number
  skuTracked: number
  anchorDcs: string[]
}

const usd = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const intf = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))
const dash = (s: string | null) => (s && s.trim() ? s.trim() : '—')

const GRAPHITE: [number, number, number] = [27, 31, 38]
const MUTED: [number, number, number] = [120, 128, 140]
const LINE: [number, number, number] = [214, 218, 224]
const GOOD: [number, number, number] = [34, 160, 110]
const BAD: [number, number, number] = [210, 70, 90]

export async function buildBattlecardDoc(d: BattlecardData): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const M = 50
  const right = W - M
  let y = 56

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.setCharSpace(2)
  doc.text('ODYSSEY MOTHERSHIP · ACCOUNT BATTLECARD', M, y)
  doc.setCharSpace(0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Generated ${new Date().toLocaleString('en-US')}`, right, y, { align: 'right' })

  y += 28
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...GRAPHITE)
  doc.text(d.chainName, M, y)

  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text(
    [d.channel, d.region, d.state].filter(Boolean).join('  ·  ') || '—',
    M,
    y,
  )
  doc.setFont('helvetica', 'bold')
  doc.text(`Tier ${d.tier}  ·  Priority ${d.score.toFixed(0)}`, right, y, { align: 'right' })

  y += 16
  doc.setDrawColor(...LINE)
  doc.line(M, y, right, y)
  y += 22

  // Two-column key/value grid helper
  const colW = (right - M) / 2
  const kv = (label: string, value: string, col: 0 | 1, row: number) => {
    const x = M + col * colW
    const yy = y + row * 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), x, yy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...GRAPHITE)
    doc.text(value, x, yy + 12)
  }

  const section = (title: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.setCharSpace(1.5)
    doc.text(title.toUpperCase(), M, y)
    doc.setCharSpace(0)
    y += 14
  }

  // Account
  section('Account')
  kv('Account Manager', dash(d.accountManager), 0, 0)
  kv('Distributor', dash(d.distributor), 1, 0)
  kv('Green Spoon Mgr', dash(d.greenSpoonManager), 0, 1)
  kv('INFRA / NCG', dash(d.infraNcg), 1, 1)
  kv('Transitional to DSD', dash(d.transitionalToDsd), 0, 2)
  kv('Active', dash(d.active), 1, 2)
  y += 3 * 16 + 12

  // Commercials
  section('Commercials')
  kv('Total Outlets', intf(d.totalUniverse), 0, 0)
  kv('Current SRP', usd(d.currentSrp), 1, 0)
  kv('Case Cost', usd(d.caseCost), 0, 1)
  kv('EDLP', dash(d.edlp), 1, 1)
  y += 2 * 16 + 12

  // Category Review
  section('2026 Category Review')
  kv('Review Period', dash(d.reviewPeriod), 0, 0)
  kv('Meeting Progress', dash(d.meetingProgress), 1, 0)
  kv('Date Scheduled', dash(d.dateScheduled), 0, 1)
  kv('In 2025 Set', dash(d.in2025), 1, 1)
  kv('In 2026 Set', dash(d.in2026), 0, 2)
  y += 3 * 16 + 12

  // SKU authorization
  section(`SKU Authorization — ${d.skuAuthorized}/${d.skuTracked} authorized`)
  doc.setFontSize(10)
  const skuColW = (right - M) / 2
  d.skus.forEach((s, i) => {
    const col = i % 2
    const rowIdx = Math.floor(i / 2)
    const x = M + col * skuColW
    const yy = y + rowIdx * 15
    const ok = s.status === 'Authorized'
    const none = s.status === '—'
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(none ? MUTED : ok ? GOOD : BAD))
    // ASCII markers — jsPDF standard fonts lack check/cross glyphs.
    doc.text(ok ? '+' : none ? '-' : 'x', x, yy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAPHITE)
    doc.text(s.flavor, x + 14, yy)
  })
  y += Math.ceil(d.skus.length / 2) * 15 + 14

  // Anchored DCs
  section('Anchored DCs (unlock leverage)')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRAPHITE)
  const anchorText = d.anchorDcs.length ? d.anchorDcs.join(',  ') : 'None designated'
  const lines = doc.splitTextToSize(anchorText, right - M)
  doc.text(lines, M, y)

  return doc
}
