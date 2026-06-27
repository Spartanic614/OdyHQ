// ============================================================
// UNFI AR Tool — cross-reference suspected-unpaid line items against UNFI's
// Open Payables to see which are acknowledged as open vs. missing.
// Pure functions; no React, no network. Used by pages/UnfiArTool.tsx.
//
// Reuses the robust paste parser + number parser from the inventory lib.
// ============================================================
import { parsePaste, parseNumber } from './inventory'

export type ArField = 'invoice' | 'amount' | 'date' | 'description'

export const AR_FIELD_LABELS: Record<ArField, string> = {
  invoice: 'Invoice / Ref #',
  amount: 'Amount',
  date: 'Date',
  description: 'Description',
}

// Required to cross-reference; the rest are display-only.
export const AR_REQUIRED: ArField[] = ['invoice']

const ALIASES: Record<ArField, string[]> = {
  invoice: [
    'invoice', 'invoice_number', 'invoice_no', 'invoice_num', 'inv', 'inv_no',
    'inv_number', 'document', 'document_number', 'document_no', 'doc', 'doc_no',
    'doc_number', 'reference', 'ref', 'ref_no', 'reference_number', 'deduction',
    'deduction_number', 'claim', 'claim_number', 'clm', 'check', 'check_number',
    'voucher', 'transaction', 'transaction_number', 'po', 'po_number', 'bill',
    'bill_number',
  ],
  amount: [
    'amount', 'amt', 'open_amount', 'open_balance', 'balance', 'invoice_amount',
    'net_amount', 'amount_due', 'amount_open', 'open', 'total', 'total_amount',
    'deduction_amount', 'value', 'gross_amount', 'remaining', 'outstanding',
  ],
  date: [
    'date', 'invoice_date', 'due_date', 'document_date', 'doc_date', 'post_date',
    'posting_date', 'transaction_date', 'created_date', 'entry_date',
  ],
  description: [
    'description', 'desc', 'memo', 'notes', 'note', 'detail', 'details',
    'reason', 'reason_code', 'name', 'vendor', 'customer', 'remark', 'comment',
  ],
}

const norm = (s: string) =>
  s.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export type ArColumnMap = Partial<Record<ArField, number>>

export interface ArTable {
  headers: string[]
  rows: string[][]
  detected: ArColumnMap
}

// Parse pasted AR/AP text into headers + rows + auto-detected column mapping.
export function parseArPaste(text: string): ArTable {
  const { headers, rows } = parsePaste(text)
  const normHeaders = headers.map(norm)
  const detected: ArColumnMap = {}
  const used = new Set<number>()
  for (const field of Object.keys(ALIASES) as ArField[]) {
    // Exact alias match first, then a looser contains-match.
    for (const alias of ALIASES[field]) {
      const idx = normHeaders.findIndex((h, i) => h === alias && !used.has(i))
      if (idx >= 0) {
        detected[field] = idx
        used.add(idx)
        break
      }
    }
    if (detected[field] == null) {
      for (const alias of ALIASES[field]) {
        const idx = normHeaders.findIndex((h, i) => h.includes(alias) && !used.has(i))
        if (idx >= 0) {
          detected[field] = idx
          used.add(idx)
          break
        }
      }
    }
  }
  return { headers, rows, detected }
}

// ---- matching keys ----
// Strict: uppercase, strip every non-alphanumeric. Loose: also drop leading
// zeros so "000123" matches "123" (common between AP and AR exports).
const strictKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
const looseKey = (s: string) => strictKey(s).replace(/^0+/, '')

export type ArStatus =
  | 'Open in Payables' // matched — UNFI shows it open/owed (awaiting release)
  | 'Amount Mismatch' // matched by invoice, but amounts differ
  | 'Not in Payables' // not on UNFI's open payables — already released or dropped
  | 'No Invoice #' // can't be cross-referenced

export interface ArResult {
  invoice: string
  description: string
  date: string
  unpaidAmount: number | null
  payablesAmount: number | null
  status: ArStatus
}

export interface CrossRefResult {
  rows: ArResult[]
  /** In UNFI's payables but not in your unpaid list (informational). */
  payablesOnly: { invoice: string; amount: number | null }[]
  counts: Record<ArStatus, number>
}

export interface CrossRefOptions {
  /** Compare amounts when both sides have one (flags Amount Mismatch). */
  compareAmounts: boolean
  /** Absolute $ tolerance before an amount difference is flagged. */
  amountTolerance: number
}

export const DEFAULT_CROSSREF_OPTIONS: CrossRefOptions = {
  compareAmounts: true,
  amountTolerance: 0.01,
}

interface PayAgg {
  amount: number | null
  raw: string
}

function get(row: string[], map: ArColumnMap, field: ArField): string {
  const idx = map[field]
  return idx == null ? '' : (row[idx] ?? '').trim()
}

// Aggregate payables by key (sum amounts when an invoice appears more than once).
function indexPayables(payables: ArTable) {
  const strict = new Map<string, PayAgg>()
  const loose = new Map<string, PayAgg>()
  for (const row of payables.rows) {
    const inv = get(row, payables.detected, 'invoice')
    if (!inv) continue
    const amt = parseNumber(get(row, payables.detected, 'amount'))
    const sk = strictKey(inv)
    if (!sk) continue
    const cur = strict.get(sk)
    const merged: PayAgg = {
      raw: inv,
      amount:
        amt == null
          ? (cur?.amount ?? null)
          : (cur?.amount ?? 0) + amt,
    }
    strict.set(sk, merged)
    loose.set(looseKey(inv), merged)
  }
  return { strict, loose }
}

export function crossReference(
  unpaid: ArTable,
  payables: ArTable,
  opts: CrossRefOptions = DEFAULT_CROSSREF_OPTIONS,
): CrossRefResult {
  const idx = indexPayables(payables)
  const matchedKeys = new Set<string>()
  const rows: ArResult[] = []

  for (const row of unpaid.rows) {
    const invoice = get(row, unpaid.detected, 'invoice')
    const description = get(row, unpaid.detected, 'description')
    const date = get(row, unpaid.detected, 'date')
    const unpaidAmount = parseNumber(get(row, unpaid.detected, 'amount'))

    // Skip blank rows entirely.
    if (!invoice && !description && unpaidAmount == null) continue

    if (!invoice) {
      rows.push({ invoice: '', description, date, unpaidAmount, payablesAmount: null, status: 'No Invoice #' })
      continue
    }

    const sk = strictKey(invoice)
    const match = idx.strict.get(sk) ?? idx.loose.get(looseKey(invoice))

    if (!match) {
      rows.push({ invoice, description, date, unpaidAmount, payablesAmount: null, status: 'Not in Payables' })
      continue
    }

    matchedKeys.add(strictKey(match.raw))
    const payablesAmount = match.amount
    let status: ArStatus = 'Open in Payables'
    if (
      opts.compareAmounts &&
      unpaidAmount != null &&
      payablesAmount != null &&
      Math.abs(Math.abs(unpaidAmount) - Math.abs(payablesAmount)) > opts.amountTolerance
    ) {
      status = 'Amount Mismatch'
    }
    rows.push({ invoice, description, date, unpaidAmount, payablesAmount, status })
  }

  // Payables present in UNFI's data but absent from the unpaid list.
  const payablesOnly: { invoice: string; amount: number | null }[] = []
  for (const [key, agg] of idx.strict) {
    if (!matchedKeys.has(key)) payablesOnly.push({ invoice: agg.raw, amount: agg.amount })
  }

  const counts: Record<ArStatus, number> = {
    'Open in Payables': 0,
    'Amount Mismatch': 0,
    'Not in Payables': 0,
    'No Invoice #': 0,
  }
  for (const r of rows) counts[r.status]++

  return { rows, payablesOnly, counts }
}
