import { useMemo, useState } from 'react'
import {
  buildItems,
  buildMessage,
  FIELD_LABELS,
  parsePaste,
  type ColumnMap,
  type FieldKey,
  type InventoryItem,
  type RiskLevel,
} from '../lib/inventory'
import {
  INVENTORY_CASES_PER_LAYER,
  INVENTORY_INCLUDE_ON_PO,
  INVENTORY_LEAD_TIME_WEEKS,
  INVENTORY_TARGET_WOS,
  INVENTORY_UNITS_PER_CASE,
} from '../config/methodology'
import { EmptyState } from '../components/States'
import { exportCsv } from '../lib/csv'
import { theme } from '../theme'

const FIELD_ORDER: FieldKey[] = [
  'sku',
  'description',
  'onHand',
  'avgWeeklySales',
  'onPo',
]

export function Inventory() {
  const [distributor, setDistributor] = useState('KeHE')
  const [text, setText] = useState('')
  const [targetWos, setTargetWos] = useState(INVENTORY_TARGET_WOS)
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(INVENTORY_LEAD_TIME_WEEKS)
  const [casesPerLayer, setCasesPerLayer] = useState(INVENTORY_CASES_PER_LAYER)
  const [includeOnPo, setIncludeOnPo] = useState(INVENTORY_INCLUDE_ON_PO)
  const [greeting, setGreeting] = useState('Hi,')
  const [overrideMap, setOverrideMap] = useState<ColumnMap>({})
  const [editedMessage, setEditedMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Parse defensively — malformed paste should show a message, never crash.
  const { parsed, parseError } = useMemo(() => {
    try {
      return { parsed: parsePaste(text), parseError: null as string | null }
    } catch (e) {
      return {
        parsed: { headers: [], rows: [], detected: {} as ColumnMap },
        parseError: e instanceof Error ? e.message : String(e),
      }
    }
  }, [text])

  // Effective column mapping = auto-detected, with manual overrides on top.
  const map = useMemo<ColumnMap>(
    () => ({ ...parsed.detected, ...overrideMap }),
    [parsed.detected, overrideMap],
  )

  const opts = useMemo(
    () => ({
      targetWos,
      includeOnPo,
      leadTimeWeeks,
      unitsPerCase: INVENTORY_UNITS_PER_CASE,
      casesPerLayer,
    }),
    [targetWos, includeOnPo, leadTimeWeeks, casesPerLayer],
  )

  const items = useMemo(() => {
    try {
      return buildItems(parsed.rows, map, distributor, opts)
    } catch {
      return []
    }
  }, [parsed.rows, map, distributor, opts])

  const atRiskCount = items.filter((i) => i.risk === 'At Risk').length
  const reorderCount = items.filter((i) => i.risk === 'Reorder').length

  const generatedMessage = useMemo(() => {
    try {
      return buildMessage(items, opts, greeting)
    } catch {
      return ''
    }
  }, [items, opts, greeting])
  const message = editedMessage ?? generatedMessage

  const hasData = parsed.rows.length > 0
  const missingRequired =
    map.sku == null || map.onHand == null || map.avgWeeklySales == null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback for older browsers.
      const ta = document.createElement('textarea')
      ta.value = message
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold">Inventory → Buyer Message</h1>
          <p className="text-sm text-muted">
            Paste a KeHE or UNFI inventory export to flag what's at risk —
            stockouts before replenishment lands, given your PO lead time —
            and get a copyable reorder message.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-3 flex flex-wrap items-end gap-4">
        <label className="text-xs text-muted flex flex-col gap-1">
          Distributor
          <select
            className="input"
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
          >
            <option>KeHE</option>
            <option>UNFI</option>
          </select>
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Lead time (wks)
          <input
            type="number"
            min={0}
            step={1}
            className="input w-24"
            value={leadTimeWeeks}
            onChange={(e) =>
              setLeadTimeWeeks(Math.max(0, Number(e.target.value) || 0))
            }
          />
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Target WOS
          <input
            type="number"
            min={1}
            step={1}
            className="input w-24"
            value={targetWos}
            onChange={(e) => setTargetWos(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="text-xs text-muted flex flex-col gap-1">
          Cases / layer
          <input
            type="number"
            min={1}
            step={1}
            className="input w-24"
            value={casesPerLayer}
            onChange={(e) =>
              setCasesPerLayer(Math.max(1, Number(e.target.value) || 1))
            }
          />
        </label>
        <label className="text-xs text-muted flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={includeOnPo}
            onChange={(e) => setIncludeOnPo(e.target.checked)}
          />
          Count On-PO toward WOS
        </label>
        <div className="flex-1" />
        {hasData && (
          <div className="text-xs pb-2 flex items-center gap-2">
            <span className="text-muted">{parsed.rows.length} rows ·</span>
            <span style={{ color: theme.bad }}>{atRiskCount} at risk</span>
            <span className="text-muted">·</span>
            <span style={{ color: theme.warn }}>{reorderCount} reorder</span>
            <span className="text-muted">
              (≤{leadTimeWeeks}w lead / ≤{targetWos}w target)
            </span>
          </div>
        )}
      </div>

      {/* Paste box */}
      <div className="card p-3 space-y-2">
        <div className="text-sm font-semibold">
          1. Paste inventory data
          <span className="text-muted font-normal">
            {' '}
            (copy the rows incl. header from Excel / the portal)
          </span>
        </div>
        <textarea
          className="input w-full h-40 font-mono text-xs"
          placeholder={
            'SKU\tDescription\tOn Hand\tAvg Weekly Sales\tQty On PO\n' +
            'ODY-001\tFocus 50mg 12pk\t120\t45\t0\n' +
            'ODY-002\tCalm 25mg 12pk\t38\t30\t24'
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setEditedMessage(null)
          }}
        />
        {parseError && (
          <div className="text-xs text-bad">
            Couldn&apos;t read this paste ({parseError}). Try copying just the
            header row plus data rows.
          </div>
        )}
      </div>

      {/* Column mapping */}
      {hasData && (
        <div className="card p-3 space-y-2">
          <div className="text-sm font-semibold">
            2. Confirm columns
            <span className="text-muted font-normal">
              {' '}
              (auto-detected — override if any are wrong)
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FIELD_ORDER.map((field) => {
              const required =
                field === 'sku' || field === 'onHand' || field === 'avgWeeklySales'
              const val = map[field]
              return (
                <label key={field} className="text-xs text-muted flex flex-col gap-1">
                  {FIELD_LABELS[field]}
                  {required && <span className="text-bad">*</span>}
                  <select
                    className="input"
                    value={val ?? ''}
                    onChange={(e) =>
                      setOverrideMap((m) => ({
                        ...m,
                        [field]:
                          e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">— none —</option>
                    {parsed.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
          {missingRequired && (
            <div className="text-xs text-bad">
              Map SKU, On Hand, and Avg Weekly Sales to compute WOS.
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasData && !missingRequired && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-2 border-b border-ink-700">
            <div className="text-sm font-semibold">3. Computed WOS</div>
            <button
              className="btn text-xs"
              onClick={() =>
                exportCsv(
                  `inventory_${distributor.toLowerCase()}`,
                  items.map((i) => ({
                    Distributor: i.distributor,
                    SKU: i.sku,
                    Description: i.description,
                    'On Hand': i.onHand,
                    'Avg Weekly Sales': i.avgWeeklySales,
                    'On PO': i.onPo,
                    WOS: i.wos == null ? '' : i.wos.toFixed(1),
                    Risk: i.risk,
                    'Need (units)': i.suggestedOrder,
                    'Order (cases)': i.suggestedCases,
                    'Order (layers)': i.suggestedLayers,
                  })),
                )
              }
            >
              ⤓ CSV
            </button>
          </div>
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-ink-800">
                <tr>
                  <th className="th">SKU</th>
                  <th className="th">Description</th>
                  <th className="th text-right">On Hand</th>
                  <th className="th text-right">AWS</th>
                  <th className="th text-right">On PO</th>
                  <th className="th text-right">WOS</th>
                  <th className="th">Risk</th>
                  <th className="th text-right">Suggested Order</th>
                  <th className="th text-right">Need (units)</th>
                </tr>
              </thead>
              <tbody>
                {[...items]
                  .sort(
                    (a, b) =>
                      RISK_RANK[a.risk] - RISK_RANK[b.risk] ||
                      (a.wos ?? Infinity) - (b.wos ?? Infinity),
                  )
                  .map((i, idx) => (
                    <ItemRow key={`${i.sku}-${idx}`} item={i} />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message */}
      {hasData && !missingRequired && (
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">4. Message to buyer</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted flex items-center gap-1">
                Greeting
                <input
                  className="input py-1 w-40"
                  value={greeting}
                  onChange={(e) => {
                    setGreeting(e.target.value)
                    setEditedMessage(null)
                  }}
                />
              </label>
              {editedMessage != null && (
                <button
                  className="btn text-xs"
                  onClick={() => setEditedMessage(null)}
                  title="Discard edits and rebuild from data"
                >
                  ↺ Regenerate
                </button>
              )}
              <button className="btn btn-accent text-xs" onClick={copy}>
                {copied ? '✓ Copied' : '⧉ Copy message'}
              </button>
            </div>
          </div>
          <textarea
            className="input w-full h-56 font-mono text-xs"
            value={message}
            onChange={(e) => setEditedMessage(e.target.value)}
          />
        </div>
      )}

      {!hasData && (
        <EmptyState message="Paste inventory rows above to get started." />
      )}
    </div>
  )
}

const RISK_RANK: Record<RiskLevel, number> = {
  'At Risk': 0,
  Reorder: 1,
  OK: 2,
  'No Sales': 3,
}

const RISK_STYLE: Record<RiskLevel, { color: string; rowBg: string; icon: string }> = {
  'At Risk': { color: theme.bad, rowBg: 'bg-bad/10', icon: '⚠' },
  Reorder: { color: theme.warn, rowBg: 'bg-warn/5', icon: '↻' },
  OK: { color: theme.good, rowBg: '', icon: '✓' },
  'No Sales': { color: theme.textMuted, rowBg: '', icon: '–' },
}

function ItemRow({ item }: { item: InventoryItem }) {
  const s = RISK_STYLE[item.risk]
  return (
    <tr className={s.rowBg}>
      <td className="td font-medium">{item.sku || '—'}</td>
      <td className="td text-muted">{item.description || '—'}</td>
      <td className="td text-right">{item.onHand ?? '—'}</td>
      <td className="td text-right">{item.avgWeeklySales ?? '—'}</td>
      <td className="td text-right">{item.onPo ?? '—'}</td>
      <td className="td text-right font-semibold" style={{ color: s.color }}>
        {item.wos == null ? '—' : item.wos.toFixed(1)}
      </td>
      <td className="td">
        <span
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${s.color}22`, color: s.color }}
        >
          <span aria-hidden>{s.icon}</span>
          {item.risk}
        </span>
      </td>
      <td className="td text-right">
        {item.suggestedLayers > 0 ? (
          <span className="font-semibold text-accent">
            {item.suggestedLayers} layer{item.suggestedLayers > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="td text-right text-muted">
        {item.suggestedOrder > 0 ? item.suggestedOrder : '—'}
      </td>
    </tr>
  )
}
