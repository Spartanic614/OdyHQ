// ============================================================
// Trade Spend Summary PDF — a clean, printable one-pager built from the
// entered data. jsPDF is dynamically imported so it stays out of the main
// bundle (loads only when the user exports).
// ============================================================
import type { jsPDF } from 'jspdf'
import type { TradeSpendInputs, Verdict } from './tradeSpend'
import { calcTradeSpend } from './tradeSpend'

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

// rgb tuples (print-friendly light theme)
const GRAPHITE: [number, number, number] = [27, 31, 38]
const MUTED: [number, number, number] = [120, 128, 140]
const LINE: [number, number, number] = [214, 218, 224]
const VERDICT_RGB: Record<Verdict, [number, number, number]> = {
  Profitable: [34, 160, 110],
  Breakeven: [200, 150, 30],
  'In the Red': [210, 70, 90],
}

export async function buildTradeSpendDoc(
  inputs: TradeSpendInputs,
): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf')
  const r = calcTradeSpend(inputs)
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  const W = doc.internal.pageSize.getWidth()
  const M = 50 // margin
  const right = W - M
  let y = 58

  // ---- Header ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.setCharSpace(2)
  doc.text('ODYSSEY MOTHERSHIP', M, y)
  doc.setCharSpace(0)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Generated ${new Date().toLocaleString('en-US')}`,
    right,
    y,
    { align: 'right' },
  )

  y += 26
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...GRAPHITE)
  doc.text('Trade Spend Summary', M, y)

  if (inputs.retailer.trim()) {
    y += 20
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...GRAPHITE)
    doc.text(inputs.retailer.trim(), M, y)
  }

  if (inputs.dealName.trim()) {
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...MUTED)
    doc.text(inputs.dealName.trim(), M, y)
  }

  // ---- Verdict box ----
  y += 22
  const boxH = 58
  const vc = r.verdict ? VERDICT_RGB[r.verdict] : MUTED
  doc.setDrawColor(...vc)
  doc.setLineWidth(1)
  doc.roundedRect(M, y, W - M * 2, boxH, 6, 6, 'S')
  doc.setFillColor(...vc)
  doc.rect(M, y, 5, boxH, 'F') // accent bar

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('DIRECTIONAL PROFITABILITY', M + 18, y + 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...vc)
  doc.text(r.verdict ?? '—', M + 18, y + 40)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...GRAPHITE)
  doc.text(
    `Net ${usd(r.netProfit)}   ·   ${pct(r.netMargin)} net margin`,
    right - 12,
    y + 36,
    { align: 'right' },
  )
  y += boxH + 28

  // ---- Key figures ----
  const stat = (label: string, value: string, sub?: string) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRAPHITE)
    doc.text(value, right, y, { align: 'right' })
    if (sub) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      doc.text(sub, right, y + 11, { align: 'right' })
    }
    y += sub ? 26 : 18
  }

  stat(
    'Forecasted annual sales',
    usd(r.sales),
    inputs.annualCases > 0
      ? `${inputs.annualCases.toLocaleString('en-US')} cases × ${usd(inputs.pricePerCase)}/case`
      : undefined,
  )
  stat(
    'Odyssey COGS',
    usd(r.cogs),
    inputs.annualCases > 0 ? `${usd(inputs.cogsPerCase)}/case` : undefined,
  )
  stat('Gross profit', usd(r.grossProfit))
  stat(
    'Total trade spend',
    usd(r.totalTradeSpend),
    r.sales > 0 ? `${pct(r.tradeSpendRate)} of sales` : undefined,
  )

  // ---- Breakdown table ----
  y += 6
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.8)
  doc.line(M, y, right, y)
  y += 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text('SPEND BREAKDOWN', M, y)
  doc.text('AMOUNT', right - 90, y, { align: 'right' })
  doc.text('% OF SALES', right, y, { align: 'right' })
  y += 6
  doc.line(M, y, right, y)
  y += 16

  const sales = r.sales
  const row = (label: string, amount: number, detail?: string) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GRAPHITE)
    doc.text(label, M, y)
    if (detail) {
      const lw = doc.getTextWidth(label)
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      doc.text(`· ${detail}`, M + lw + 6, y)
      doc.setFontSize(10)
      doc.setTextColor(...GRAPHITE)
    }
    doc.text(usd(amount), right - 90, y, { align: 'right' })
    doc.setTextColor(...MUTED)
    doc.text(
      sales > 0 && amount !== 0 ? pct(amount / sales) : '—',
      right,
      y,
      { align: 'right' },
    )
    y += 17
  }

  row('One-time marketing', inputs.oneTimeMarketing)
  row(
    'Slotting fees',
    r.slottingTotal,
    inputs.slottingSkus.length > 0
      ? `${inputs.slottingSkus.length} SKUs × ${usd(inputs.slottingFeePerSku)}`
      : undefined,
  )

  y += 2
  doc.setDrawColor(...LINE)
  doc.line(M, y, right, y)
  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...GRAPHITE)
  doc.text('Total trade spend', M, y)
  doc.text(usd(r.totalTradeSpend), right - 90, y, { align: 'right' })
  doc.setTextColor(...MUTED)
  doc.text(sales > 0 ? pct(r.tradeSpendRate) : '—', right, y, { align: 'right' })

  // ---- Footer ----
  const H = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.8)
  doc.line(M, H - 48, right, H - 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(
    'Directional estimate from Odyssey Mothership. Promo allowances modeled as % of sales in selected months.',
    M,
    H - 34,
  )

  return doc
}

export async function exportTradeSpendPdf(inputs: TradeSpendInputs) {
  const doc = await buildTradeSpendDoc(inputs)
  const slugify = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const slug =
    [slugify(inputs.retailer), slugify(inputs.dealName)].filter(Boolean).join('-') || 'trade-spend'
  doc.save(`${slug}-summary.pdf`)
}
