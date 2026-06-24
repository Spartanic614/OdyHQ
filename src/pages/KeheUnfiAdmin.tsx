import { useMemo } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseQuery } from '../data/useSupabaseQuery'
import { DataTable, type Column } from '../components/DataTable'
import { TableSkeleton, ErrorBanner } from '../components/States'

type Row = Record<string, unknown>

const TABLE = 'ref_kehe_unfi_admin'

// snake_case / lower → "Title Case" for column headers.
function prettify(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export function KeheUnfiAdmin() {
  const { data, loading, error, refetch } = useSupabaseQuery<Row[]>(
    async () => {
      // Table is untyped (schema defined once the Excel arrives) — cast the client.
      const res = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(
        TABLE,
      ).select('*')
      return res as unknown as { data: Row[] | null; error: PostgrestError | null }
    },
    [],
    TABLE,
  )

  const rows = data ?? []

  const columns: Column<Row>[] = useMemo(() => {
    if (!rows.length) return []
    return Object.keys(rows[0]).map((key) => ({
      key,
      label: prettify(key),
      value: (r) => {
        const v = r[key]
        if (v == null) return null
        return typeof v === 'number' ? v : String(v)
      },
    }))
  }, [rows])

  const tableMissing =
    !!error && /relation|does not exist|not find the table|schema cache/i.test(error)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">KeHE / UNFI Admin</h1>
        <p className="text-sm text-muted">
          Administrative reference for KeHE &amp; UNFI.
        </p>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : tableMissing ? (
        <SetupNotice onRetry={refetch} />
      ) : error ? (
        <ErrorBanner table={TABLE} message={error} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) =>
            String((r as { id?: unknown }).id ?? Object.values(r).join('|'))
          }
          exportName="kehe_unfi_admin"
          searchPlaceholder="Search…"
          emptyMessage="No rows yet — load your KeHE/UNFI admin data."
        />
      )}
    </div>
  )
}

function SetupNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card p-5 space-y-2">
      <div className="font-semibold">Not set up yet</div>
      <p className="text-sm text-muted">
        This page renders whatever columns your KeHE/UNFI admin Excel contains.
        Send me the file and I&apos;ll create the{' '}
        <code className="text-text">{TABLE}</code> table to match it; then load
        it with <code className="text-text">npm run seed</code> and it shows up
        here automatically.
      </p>
      <button className="btn text-xs w-fit" onClick={onRetry}>
        ↻ Check again
      </button>
    </div>
  )
}
