import { useMemo, useState } from 'react'
import { useData, type CalendarEvent } from '../data/store'
import { ChipFilter, SelectFilter, uniqueValues } from '../components/Filters'
import { DataTable, type Column } from '../components/DataTable'
import { DetailDrawer, Field, FieldGrid } from '../components/DetailDrawer'
import { TableSkeleton, ErrorBanner, EmptyState } from '../components/States'
import { eventColors } from '../theme'
import { MONTHS, monthName } from '../lib/format'

const EVENT_TYPES = [
  'Retailer Promo',
  'Distributor Promo',
  'Merchandising',
  'Trade Show',
  'KeHE Roadmap',
  'UNFI Roadmap',
]

export function CalendarPage() {
  const { calendar, loading } = useData()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [types, setTypes] = useState<Set<string>>(new Set(EVENT_TYPES))
  const [month, setMonth] = useState('')
  const [entity, setEntity] = useState('')
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  const filtered = useMemo(
    () =>
      calendar.rows
        .filter((e) => !e.event_type || types.has(e.event_type))
        .filter((e) => !month || String(e.month) === month)
        .filter((e) => !entity || e.entity === entity),
    [calendar.rows, types, month, entity],
  )

  const byMonth = useMemo(() => {
    const m = new Map<number, CalendarEvent[]>()
    for (let i = 1; i <= 12; i++) m.set(i, [])
    for (const e of filtered) {
      if (e.month && e.month >= 1 && e.month <= 12) m.get(e.month)!.push(e)
    }
    return m
  }, [filtered])

  const toggleType = (t: string) =>
    setTypes((s) => {
      const n = new Set(s)
      n.has(t) ? n.delete(t) : n.add(t)
      return n
    })

  const columns: Column<CalendarEvent>[] = [
    { key: 'month', label: 'Month', value: (e) => e.month, render: (e) => monthName(e.month) },
    {
      key: 'event_type',
      label: 'Type',
      value: (e) => e.event_type,
      render: (e) => (
        <span
          className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: `${eventColors[e.event_type ?? ''] ?? '#64748b'}22`,
            color: eventColors[e.event_type ?? ''] ?? '#64748b',
          }}
        >
          {e.event_type}
        </span>
      ),
    },
    { key: 'entity', label: 'Entity', value: (e) => e.entity },
    { key: 'title', label: 'Title', value: (e) => e.title },
    { key: 'detail', label: 'Detail', value: (e) => e.detail },
  ]

  if (loading) return <TableSkeleton />
  if (calendar.error)
    return <ErrorBanner table="fact_calendar" message={calendar.error} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Mothership Calendar</h1>
        <div className="flex gap-1">
          <button
            className={`btn text-sm ${view === 'grid' ? 'btn-accent' : ''}`}
            onClick={() => setView('grid')}
          >
            Month Grid
          </button>
          <button
            className={`btn text-sm ${view === 'list' ? 'btn-accent' : ''}`}
            onClick={() => setView('list')}
          >
            List
          </button>
        </div>
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-4">
        <ChipFilter
          options={EVENT_TYPES}
          selected={types}
          onToggle={toggleType}
          colorFor={(t) => eventColors[t]}
        />
        <div className="flex-1" />
        <SelectFilter
          label="Month"
          value={month}
          onChange={setMonth}
          options={MONTHS.map((_, i) => String(i + 1))}
        />
        <SelectFilter
          label="Entity"
          value={entity}
          onChange={setEntity}
          options={uniqueValues(calendar.rows, (e) => e.entity)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No events match the current filters." />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from(byMonth.entries()).map(([m, events]) => (
            <div key={m} className="card p-3 min-h-[120px]">
              <div className="text-sm font-semibold mb-2 flex items-center justify-between">
                {MONTHS[m - 1]}
                <span className="text-xs text-muted">{events.length}</span>
              </div>
              <div className="space-y-1">
                {events.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className="block w-full text-left text-xs px-2 py-1 rounded hover:opacity-80"
                    style={{
                      backgroundColor: `${eventColors[e.event_type ?? ''] ?? '#64748b'}22`,
                      borderLeft: `3px solid ${eventColors[e.event_type ?? ''] ?? '#64748b'}`,
                    }}
                  >
                    <div className="truncate font-medium">{e.title ?? e.entity}</div>
                    {e.entity && e.title && (
                      <div className="truncate text-muted">{e.entity}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(e) => String(e.id)}
          onRowClick={setSelected}
          exportName="calendar"
          initialSort={{ key: 'month', dir: 'asc' }}
          searchPlaceholder="Search events…"
        />
      )}

      <DetailDrawer
        open={!!selected}
        title={selected?.title ?? selected?.entity ?? 'Event'}
        subtitle={selected?.event_type ?? undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <FieldGrid>
            <Field label="Type">{selected.event_type}</Field>
            <Field label="Entity">{selected.entity}</Field>
            <Field label="Month">{monthName(selected.month)}</Field>
            <Field label="Year">{selected.year}</Field>
            <div className="col-span-2">
              <Field label="Detail">{selected.detail}</Field>
            </div>
          </FieldGrid>
        )}
      </DetailDrawer>
    </div>
  )
}
