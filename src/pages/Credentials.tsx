import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseQuery } from '../data/useSupabaseQuery'
import type { Tables } from '../lib/database.types'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { Pill } from '../components/StatusBadge'
import { TableSkeleton, ErrorBanner, EmptyState } from '../components/States'

type Cred = Tables<'ref_app_credentials'>

export function Credentials() {
  const { data, loading, error, refetch } = useSupabaseQuery<Cred[]>(
    async () =>
      await supabase
        .from('ref_app_credentials')
        .select('*')
        .order('category', { ascending: true })
        .order('app_name', { ascending: true }),
    [],
    'ref_app_credentials',
  )

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [revealAll, setRevealAll] = useState(false)

  const rows = data ?? []
  const filtered = useMemo(
    () =>
      rows
        .filter((r) => !category || r.category === category)
        .filter((r) =>
          !search.trim()
            ? true
            : [r.app_name, r.url, r.username, r.notes, r.category]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
        ),
    [rows, search, category],
  )

  const toggle = (id: number) =>
    setRevealed((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // A missing table reads as a PostgREST relation error — show setup help, not a scary banner.
  const tableMissing =
    !!error && /relation|does not exist|not find the table|schema cache/i.test(error)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Software Links &amp; Logins</h1>
        <p className="text-sm text-muted">
          Shared directory of app links and credentials.
        </p>
      </div>

      <div className="card border-warn/40 bg-warn/10 p-3 text-xs text-muted">
        <span className="text-warn font-semibold">Heads up:</span> credentials
        here are stored in plaintext and visible to anyone who can sign in. Keep
        high-sensitivity logins (banking, admin, anything costly if leaked) in a
        dedicated password manager.
      </div>

      {loading ? (
        <TableSkeleton />
      ) : tableMissing ? (
        <SetupNotice onRetry={refetch} />
      ) : error ? (
        <ErrorBanner table="ref_app_credentials" message={error} onRetry={refetch} />
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-2 border-b border-white/10">
            <SelectFilter
              label="Category"
              value={category}
              onChange={setCategory}
              options={uniqueValues(rows, (r) => r.category)}
            />
            <input
              className="input w-56"
              placeholder="Search apps, users, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex-1" />
            <button
              className="btn text-xs"
              onClick={() => setRevealAll((v) => !v)}
            >
              {revealAll ? '🙈 Hide all' : '👁 Reveal all'}
            </button>
            <span className="text-xs text-muted px-1">{filtered.length} apps</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState message="No entries match the current filters." />
          ) : (
            <div className="overflow-auto max-h-[68vh]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-ink-800">
                  <tr>
                    <th className="th">App</th>
                    <th className="th">Link</th>
                    <th className="th">Username</th>
                    <th className="th">Password</th>
                    <th className="th">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="td">
                        <div className="font-medium">{r.app_name ?? '—'}</div>
                        {r.category && (
                          <Pill color="#9db4c9">{r.category}</Pill>
                        )}
                      </td>
                      <td className="td">
                        {r.url ? (
                          <a
                            href={normalizeUrl(r.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline break-all"
                          >
                            {prettyUrl(r.url)} ↗
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="td">
                        <CopyValue value={r.username} />
                      </td>
                      <td className="td">
                        <SecretValue
                          value={r.password}
                          revealed={revealAll || revealed.has(r.id)}
                          onToggle={() => toggle(r.id)}
                        />
                      </td>
                      <td className="td text-muted max-w-xs">{r.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SetupNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card p-5 space-y-2">
      <div className="font-semibold">Not set up yet</div>
      <p className="text-sm text-muted">
        The <code className="text-text">ref_app_credentials</code> table doesn&apos;t
        exist yet. Run the migration in{' '}
        <code className="text-text">migrations/0002_app_credentials.sql</code>{' '}
        (Supabase → SQL Editor), then load your data with{' '}
        <code className="text-text">npm run seed</code>.
      </p>
      <button className="btn text-xs w-fit" onClick={onRetry}>
        ↻ Check again
      </button>
    </div>
  )
}

function CopyValue({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-muted">—</span>
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* ignore */
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{value}</span>
      <button
        className="text-muted hover:text-text text-xs"
        onClick={copy}
        title="Copy"
      >
        {copied ? '✓' : '⧉'}
      </button>
    </span>
  )
}

function SecretValue({
  value,
  revealed,
  onToggle,
}: {
  value: string | null
  revealed: boolean
  onToggle: () => void
}) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-muted">—</span>
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* ignore */
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{revealed ? value : '•'.repeat(10)}</span>
      <button
        className="text-muted hover:text-text text-xs"
        onClick={onToggle}
        title={revealed ? 'Hide' : 'Reveal'}
      >
        {revealed ? '🙈' : '👁'}
      </button>
      <button
        className="text-muted hover:text-text text-xs"
        onClick={copy}
        title="Copy"
      >
        {copied ? '✓' : '⧉'}
      </button>
    </span>
  )
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}
