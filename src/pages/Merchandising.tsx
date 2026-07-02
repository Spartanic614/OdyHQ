import { useMemo, useState } from 'react'
import { parseTable } from '../lib/parseTable'
import {
  buildVisits,
  byChain,
  detectMerchColumns,
  MERCH_FIELD_LABELS,
  MERCH_REQUIRED,
  summarize,
  type MerchColumnMap,
  type MerchField,
  type StoreVisit,
} from '../lib/merchandising'
import { KpiCard } from '../components/KpiCard'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { EmptyState } from '../components/States'
import { exportCsv } from '../lib/csv'
import { fmtInt, fmtPct } from '../lib/format'
import { theme } from '../theme'

const FIELD_ORDER: MerchField[] = [
  'storeInfo',
  'storeId',
  'chain',
  'masterChain',
  'question',
  'response',
  'visitDate',
]

const packColor = (p: string) =>
  p === 'Shelf Full'
    ? theme.good
    : p === 'Out of Stock'
      ? theme.bad
      : p === 'Not Authorized'
        ? theme.textMuted
        : p.startsWith('Packed')
          ? theme.accent
          : theme.textMuted

const displayColor = (d: string) =>
  d === 'Display Up' ? theme.good : d === 'Refused' ? theme.bad : d === 'Not Up' ? theme.warn : theme.textMuted

export function Merchandising() {
  const [text, setText] = useState('')
  const [overrideMap, setOverrideMap] = useState<MerchColumnMap>({})
  const [chain, setChain] = useState('')
  const [search, setSearch] = useState('')
  const [onlyNotAuth, setOnlyNotAuth] = useState(false)

  const table = useMemo(() => parseTable(text), [text])
  const detected = useMemo(() => detectMerchColumns(table), [table])
  const map = useMemo<MerchColumnMap>(() => ({ ...detected, ...overrideMap }), [detected, overrideMap])

  const visits = useMemo(() => buildVisits(table, map), [table, map])
  const summary = useMemo(() => summarize(visits), [visits])
  const chains = useMemo(() => byChain(visits), [visits])

  const hasData = table.rows.length > 0
  const missingRequired = MERCH_REQUIRED.some((f) => map[f] == null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return visits
      .filter((v) => !chain || v.chain === chain || v.masterChain === chain)
      .filter((v) => !onlyNotAuth || !v.authorized)
      .filter(
        (v) =>
          !q ||
          [v.store, v.chain, v.address, v.notes, v.storeId].some((s) =>
            (s ?? '').toLowerCase().includes(q),
          ),
      )
  }, [visits, chain, onlyNotAuth, search])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Merchandising Execution</h1>
        <p className="text-sm text-muted">
          Paste your field-merchandising visit export (one row per survey
          question). It rolls up each store visit into authorization, pack-out,
          and display status — and flags where Odyssey isn&apos;t in the system.
        </p>
      </div>

      {/* Paste box */}
      <div className="card p-3 space-y-2">
        <div className="text-sm font-semibold">
          1. Paste merchandising data
          <span className="text-muted font-normal"> (include the header row)</span>
        </div>
        <textarea
          className="input w-full h-36 font-mono text-xs"
          placeholder={
            'Store Info\tSurvey Name\tQuestion\tResponse\tVisit Date\tStoreId\tMaster Chain\tChain\n' +
            '1 - Stop & Shop | …\t(ARP) Pack Out\tDid you pack out Odyssey Product?\tDisplay-Shelf Is Full\t6/5/2026\t102116\tAhold USA Inc\tStop & Shop'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {/* Column mapping */}
      {hasData && (
        <div className="card p-3 space-y-2">
          <div className="text-sm font-semibold">
            2. Confirm columns
            <span className="text-muted font-normal"> (auto-detected — override if wrong)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELD_ORDER.map((field) => (
              <label key={field} className="text-xs text-muted flex flex-col gap-1">
                <span>
                  {MERCH_FIELD_LABELS[field]}
                  {MERCH_REQUIRED.includes(field) && <span className="text-bad"> *</span>}
                </span>
                <select
                  className="input"
                  value={map[field] ?? ''}
                  onChange={(e) =>
                    setOverrideMap((m) => ({
                      ...m,
                      [field]: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">— none —</option>
                  {table.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {missingRequired && (
            <div className="text-xs text-bad">Map Question and Response to analyze visits.</div>
          )}
        </div>
      )}

      {/* Results */}
      {hasData && !missingRequired && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Stores Visited" value={fmtInt(summary.visits)} />
            <KpiCard
              label="In System"
              value={fmtPct(summary.authRate)}
              sub={`${fmtInt(summary.authorized)} of ${fmtInt(summary.visits)}`}
              accent={theme.good}
            />
            <KpiCard
              label="Not Authorized"
              value={fmtInt(summary.notAuthorized)}
              sub="void / not in system"
              accent={summary.notAuthorized > 0 ? theme.bad : theme.good}
            />
            <KpiCard
              label="Shelf Full"
              value={fmtPct(summary.shelfFullRate)}
              sub={`${fmtInt(summary.shelfFull)} of authorized`}
              accent={theme.good}
            />
            <KpiCard label="Displays Up" value={fmtInt(summary.displayUp)} accent={theme.good} />
            <KpiCard
              label="Refused"
              value={fmtInt(summary.refused)}
              accent={summary.refused > 0 ? theme.bad : theme.textMuted}
            />
          </div>

          {/* By-chain rollup */}
          <div className="card overflow-hidden">
            <div className="p-2 border-b border-ink-700 text-sm font-semibold">Execution by chain</div>
            <div className="overflow-auto max-h-[40vh]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-ink-800">
                  <tr>
                    <th className="th">Chain</th>
                    <th className="th text-right">Stores</th>
                    <th className="th text-right">In System</th>
                    <th className="th text-right">Not Auth</th>
                    <th className="th text-right">Shelf Full</th>
                    <th className="th text-right">Displays Up</th>
                    <th className="th text-right">Refused</th>
                  </tr>
                </thead>
                <tbody>
                  {chains.map((c) => (
                    <tr key={c.chain}>
                      <td className="td font-medium">{c.chain}</td>
                      <td className="td text-right">{fmtInt(c.visits)}</td>
                      <td className="td text-right">{fmtPct(c.authRate)}</td>
                      <td
                        className="td text-right"
                        style={{ color: c.notAuthorized > 0 ? theme.bad : undefined }}
                      >
                        {fmtInt(c.notAuthorized)}
                      </td>
                      <td className="td text-right">{fmtInt(c.shelfFull)}</td>
                      <td className="td text-right">{fmtInt(c.displayUp)}</td>
                      <td className="td text-right" style={{ color: c.refused > 0 ? theme.bad : undefined }}>
                        {fmtInt(c.refused)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Store detail */}
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-ink-700">
              <div className="text-sm font-semibold">
                Store visits
                <span className="text-muted font-normal"> ({fmtInt(filtered.length)})</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={onlyNotAuth}
                    onChange={(e) => setOnlyNotAuth(e.target.checked)}
                  />
                  Only not-authorized
                </label>
                <SelectFilter
                  label="Chain"
                  value={chain}
                  onChange={setChain}
                  options={uniqueValues(visits, (v) => v.chain || v.masterChain)}
                />
                <input
                  className="input w-48"
                  placeholder="Search store / notes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  className="btn text-xs"
                  onClick={() =>
                    exportCsv(
                      'merchandising_execution',
                      filtered.map((v) => ({
                        Store: v.store,
                        Address: v.address,
                        'Store ID': v.storeId,
                        Chain: v.chain,
                        'Master Chain': v.masterChain,
                        'Visit Date': v.visitDate,
                        Authorized: v.authorized ? 'Yes' : 'No',
                        'Pack Out': v.packOut,
                        Display: v.display,
                        Notes: v.notes,
                      })),
                    )
                  }
                >
                  ⤓ CSV
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[55vh]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-ink-800">
                  <tr>
                    <th className="th">Store</th>
                    <th className="th">Chain</th>
                    <th className="th">Visit</th>
                    <th className="th">Authorized</th>
                    <th className="th">Pack Out</th>
                    <th className="th">Display</th>
                    <th className="th">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <VisitRow key={v.key} v={v} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!hasData && (
        <EmptyState message="Paste your field-merchandising visit export to see execution by store and chain." />
      )}
    </div>
  )
}

function VisitRow({ v }: { v: StoreVisit }) {
  return (
    <tr className={!v.authorized ? 'bg-bad/5' : ''}>
      <td className="td">
        <div className="font-medium">{v.store || '—'}</div>
        {v.address && <div className="text-[11px] text-muted truncate max-w-[240px]">{v.address}</div>}
      </td>
      <td className="td text-muted">{v.chain || v.masterChain || '—'}</td>
      <td className="td text-muted whitespace-nowrap">{v.visitDate || '—'}</td>
      <td className="td">
        <Badge color={v.authorized ? theme.good : theme.bad}>
          {v.authorized ? '✓ In system' : '✗ Not authorized'}
        </Badge>
      </td>
      <td className="td">
        {v.packOut === '—' ? (
          <span className="text-muted">—</span>
        ) : (
          <Badge color={packColor(v.packOut)}>{v.packOut}</Badge>
        )}
      </td>
      <td className="td">
        {v.display === '—' ? (
          <span className="text-muted">—</span>
        ) : (
          <Badge color={displayColor(v.display)}>{v.display}</Badge>
        )}
      </td>
      <td className="td text-muted max-w-[220px] truncate" title={v.notes}>
        {v.notes || '—'}
      </td>
    </tr>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {children}
    </span>
  )
}
