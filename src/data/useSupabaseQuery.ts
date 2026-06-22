import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'

export interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** Table name that failed — surfaced in error banners (§9). */
  table?: string
  refetch: () => void
}

/**
 * Generic Supabase query hook with loading/error state.
 * `fn` should run a supabase query and return { data, error }.
 * `table` names the entity so failures can be reported precisely.
 */
export function useSupabaseQuery<T>(
  fn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  deps: unknown[],
  table: string,
): QueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fnRef
      .current()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
          setData(null)
        } else {
          setData(data)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, table, refetch }
}
