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
  INVENTORY_EXCLUDE_ON_PO,
  INVENTORY_LEAD_TIME_WEEKS,
  INVENTORY_TARGET_WOS,
  INVENTORY_UNITS_PER_CASE,
} from '../config/methodology'
import { EmptyState } from '../components/States'
import { exportCsv } from '../lib/csv'
import { theme } from '../theme'
import { SKU_TRACKING } from '../config/skuTracking'
import { lookupDc } from '../config/dcBuyers'

const FIELD_ORDER: FieldKey[] = [
  'dc',
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
  const [excludeOnPo, setExcludeOnPo] = useState(INVENTORY_EXCLUDE_ON_PO)
  const [greeting, setGreeting] = useState('Hi,')
  const [overrideMap, setOverrideMap] = useState<ColumnMap>({})
  const [editedMessage, setEditedMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showSkuLists, setShowSkuLists] = useState(false)
  const [ran, setRan] = useState(false)

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
      excludeOnPo,
      leadTimeWeeks,
      unitsPerCase: INVENTORY_UNITS_PER_CASE,
      casesPerLayer,
    }),
    [targetWos, includeOnPo, excludeOnPo, leadTimeWeeks, casesPerLayer],
  )

  const items = useMemo(() => {
    try {
      return buildItems(parsed.rows, map, distributor, opts)
    } catch {
      return []
    }
  }, [parsed.rows, map, distributor, opts])

  // Excluded SKUs (per the distributor tracking lists) are dropped from analysis.
  const analyzed = useMemo(() => items.filter((i) => !i.excluded), [items])
  const excludedCount = items.length - analyzed.length

  const atRiskCount = analyzed.filter((i) => i.risk === 'At Risk').length
  const reorderCount = analyzed.filter((i) => i.risk === 'Reorder').length
  const buyers = Array.from(new Set(analyzed.map((i) => i.buyer).filter(Boolean)))

  // At-Risk SKUs grouped by DC, for the summary box above the buyer message.
  const atRiskByDc = useMemo(() => {
    const m = new Map<string, InventoryItem[]>()
    for (const i of analyzed) {
      if (i.risk !== 'At Risk') continue
      const key = i.dc || i.distributor || '—'
      const arr = m.get(key) ?? []
      arr.push(i)
      m.set(key, arr)
    }
    return [...m.entries()].map(([dc, list]) => ({
      dc,
      list: [...list].sort((a, b) => (a.wos ?? 0) - (b.wos ?? 0)),
    }))
  }, [analyzed])

  const generatedMessage = useMemo(() => {
    try {
      return buildMessage(analyzed, opts, greeting)
    } catch {
      return ''
    }
  }, [analyzed, opts, greeting])
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
        <button
          className="btn text-xs"
          onClick={() => setShowSkuLists((s) => !s)}
          title="SKUs tracked vs excluded, by distributor"
        >
          {showSkuLists ? 'Hide' : 'Show'} SKU tracking lists
        </button>
      </div>

      {showSkuLists && <SkuTrackingPanel />}

      {/* Controls */}
      <div className="card p-3 flex flex-wrap items-end gap-4">
        <label className="text-xs text-muted flex flex-col gap-1">
          Distributor (fallback)
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
            checked={excludeOnPo}
            onChange={(e) => setExcludeOnPo(e.target.checked)}
          />
          Ignore items with anything on PO
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
            {excludedCount > 0 && (
              <span className="text-muted" title="Excluded per the distributor SKU tracking list">
                · {excludedCount} excluded
              </span>
            )}
            {buyers.length > 0 && (
              <span className="text-muted border-l border-ink-700 pl-2">
                → {buyers.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Demo data */}
      <div className="card p-4 space-y-3 bg-blue-950/20 border border-blue-500/20">
        <div className="text-sm font-semibold">Demo Data (Copy & Paste)</div>
        <p className="text-xs text-muted">
          Sample inventory data showing at-risk and reorder scenarios. Paste this to see how the reorder analysis works.
        </p>
        <div className="relative">
          <textarea
            readOnly
            value={`DC	SKU	Description	On Hand	Avg Weekly Sales	Qty On PO
CHN	ODY-001	Focus 50mg 12pk	45	60	0
CHN	ODY-002	Calm 25mg 12pk	18	25	36
CHN	ODY-003	Energy 100mg 12pk	156	40	0
CHN	ODY-004	Sleep 30mg 12pk	8	18	48
CHN	ODY-005	Immunity 60ct	220	35	0
LAX	ODY-001	Focus 50mg 12pk	92	55	0
LAX	ODY-002	Calm 25mg 12pk	72	28	0
LAX	ODY-003	Energy 100mg 12pk	320	38	0
LAX	ODY-004	Sleep 30mg 12pk	14	20	24
LAX	ODY-006	Vitality caps 120ct	88	15	0
DAL	ODY-001	Focus 50mg 12pk	22	50	48
DAL	ODY-002	Calm 25mg 12pk	5	22	0
DAL	ODY-003	Energy 100mg 12pk	180	42	0
DAL	ODY-004	Sleep 30mg 12pk	3	16	36
DAL	ODY-007	Recovery powder 30srv	145	12	0`}
            className="w-full h-56 p-3 text-xs font-mono bg-black/40 border border-white/10 rounded resize-none"
          />
          <button
            onClick={() => {
              const text = `DC	SKU	Description	On Hand	Avg Weekly Sales	Qty On PO
CHN	ODY-001	Focus 50mg 12pk	45	60	0
CHN	ODY-002	Calm 25mg 12pk	18	25	36
CHN	ODY-003	Energy 100mg 12pk	156	40	0
CHN	ODY-004	Sleep 30mg 12pk	8	18	48
CHN	ODY-005	Immunity 60ct	220	35	0
LAX	ODY-001	Focus 50mg 12pk	92	55	0
LAX	ODY-002	Calm 25mg 12pk	72	28	0
LAX	ODY-003	Energy 100mg 12pk	320	38	0
LAX	ODY-004	Sleep 30mg 12pk	14	20	24
LAX	ODY-006	Vitality caps 120ct	88	15	0
DAL	ODY-001	Focus 50mg 12pk	22	50	48
DAL	ODY-002	Calm 25mg 12pk	5	22	0
DAL	ODY-003	Energy 100mg 12pk	180	42	0
DAL	ODY-004	Sleep 30mg 12pk	3	16	36
DAL	ODY-007	Recovery powder 30srv	145	12	0`
              navigator.clipboard.writeText(text)
            }}
            className="absolute top-3 right-3 text-xs btn"
          >
            Copy
          </button>
        </div>
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
            'DC\tSKU\tDescription\tOn Hand\tAvg Weekly Sales\tQty On PO\n' +
            'CHN\tODY-001\tFocus 50mg 12pk\t120\t45\t0\n' +
            'CHN\tODY-002\tCalm 25mg 12pk\t38\t30\t24'
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setEditedMessage(null)
            setRan(false)
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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

      {/* Big run button — always visible, disabled until data is ready */}
      <button
        className="btn btn-accent w-full text-lg font-bold py-4 disabled:opacity-40"
        onClick={() => setRan(true)}
        disabled={!hasData || missingRequired}
        title={
          !hasData
            ? 'Paste inventory data above first'
            : missingRequired
              ? 'Map SKU, On Hand, and Avg Weekly Sales'
              : undefined
        }
      >
        {!hasData
          ? '▶ Run Inventory Analysis (paste data above)'
          : ran
            ? '↻ Re-run Inventory Analysis'
            : '▶ Run Inventory Analysis'}
      </button>

      {/* Results */}
      {ran && hasData && !missingRequired && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-2 border-b border-ink-700">
            <div className="text-sm font-semibold">3. Computed WOS</div>
            <button
              className="btn text-xs"
              onClick={() =>
                exportCsv(
                  `inventory_${distributor.toLowerCase()}`,
                  analyzed.map((i) => ({
                    DC: i.dc,
                    Buyer: i.buyer,
                    Distributor: i.distributor,
                    SKU: i.sku,
                    Description: i.description,
                    'On Hand': i.onHand,
                    'Avg Weekly Sales': i.avgWeeklySales,
                    'On PO': i.onPo,
                    WOS: i.wos == null ? '' : i.wos.toFixed(1),
                    Risk: i.risk,
                    'Need (units)': i.suggestedOrder,
                    'Order (layers)': i.suggestedLayers,
                    'Order (cases)': i.suggestedCases,
                    'Order (units)': i.orderUnits,
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
                {[...analyzed]
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

      {/* At-Risk summary by DC */}
      {ran && hasData && !missingRequired && (
        <div className="card p-3 space-y-3" style={{ borderColor: `${theme.bad}55` }}>
          <div className="text-sm font-semibold flex items-center gap-2">
            <span style={{ color: theme.bad }} aria-hidden>
              ⚠
            </span>
            At-Risk SKUs by DC
            <span className="text-muted font-normal">
              — stock out before a {leadTimeWeeks}-week PO can land
            </span>
          </div>
          {atRiskByDc.length === 0 ? (
            <div className="text-sm text-muted">No SKUs at risk. 🎉</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {atRiskByDc.map(({ dc, list }) => {
                const ref = lookupDc(dc)
                const label = ref ? `${ref.city} (${ref.distributor})` : dc || 'Items'
                const buyer = list[0]?.buyer
                return (
                  <div
                    key={dc}
                    className="rounded p-2 bg-bad/5"
                    style={{ border: `1px solid ${theme.bad}40` }}
                  >
                    <div className="text-xs font-semibold flex items-center justify-between gap-2">
                      <span className="truncate">{label}</span>
                      <span style={{ color: theme.bad }}>{list.length} at risk</span>
                    </div>
                    {buyer && (
                      <div className="text-[11px] text-muted mb-1">Buyer: {buyer}</div>
                    )}
                    <div className="space-y-1 pt-1">
                      {list.map((i, idx) => (
                        <div
                          key={`${i.sku}-${idx}`}
                          className="text-xs flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{i.sku || i.description || '—'}</span>
                          <span
                            className="font-semibold tabular-nums shrink-0"
                            style={{ color: theme.bad }}
                          >
                            {i.wos == null ? '—' : i.wos.toFixed(1)} WOS
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {ran && hasData && !missingRequired && (
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

// Read-only view of the editable SKU tracking lists (src/config/skuTracking.ts).
function SkuTrackingPanel() {
  return (
    <div className="card p-3 space-y-3">
      <div className="text-sm font-semibold">
        SKU tracking lists
        <span className="text-muted font-normal">
          {' '}
          — edit in <code className="text-text">src/config/skuTracking.ts</code> to
          add/remove SKUs (excluded SKUs are dropped from every analysis)
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(SKU_TRACKING) as (keyof typeof SKU_TRACKING)[]).map((dist) => {
          const list = SKU_TRACKING[dist]
          const tracked = list.filter((s) => s.track)
          const excluded = list.filter((s) => !s.track)
          return (
            <div key={dist} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                {dist}
              </div>
              <div>
                <div className="text-[11px] mb-1" style={{ color: theme.good }}>
                  Tracked ({tracked.length})
                </div>
                <div className="space-y-0.5">
                  {tracked.map((s) => (
                    <div key={s.name} className="text-xs font-mono flex items-center gap-1.5">
                      <span style={{ color: theme.good }}>✓</span>
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] mb-1" style={{ color: theme.bad }}>
                  Excluded ({excluded.length})
                </div>
                <div className="space-y-0.5">
                  {excluded.map((s) => (
                    <div key={s.name} className="text-xs font-mono flex items-center gap-1.5 text-muted">
                      <span style={{ color: theme.bad }}>✗</span>
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const RISK_RANK: Record<RiskLevel, number> = {
  'At Risk': 0,
  Reorder: 1,
  OK: 2,
  'On PO': 3,
  'No Sales': 4,
}

const RISK_STYLE: Record<RiskLevel, { color: string; rowBg: string; icon: string }> = {
  'At Risk': { color: theme.bad, rowBg: 'bg-bad/10', icon: '⚠' },
  Reorder: { color: theme.warn, rowBg: 'bg-warn/5', icon: '↻' },
  OK: { color: theme.good, rowBg: '', icon: '✓' },
  'On PO': { color: '#9db4c9', rowBg: '', icon: '↧' },
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
            <span className="text-muted font-normal">
              {' '}
              ({item.suggestedCases} cs / {item.orderUnits.toLocaleString('en-US')} u)
            </span>
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
