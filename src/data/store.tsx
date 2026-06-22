import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Tables } from '../lib/database.types'

// ---- Row aliases ----
export type Sku = Tables<'dim_sku'>
export type Dc = Tables<'dim_dc'>
export type Chain = Tables<'dim_chain'>
export type Prospect = Tables<'dim_prospect'>
export type Contact = Tables<'dim_contact'>
export type DcSkuAuth = Tables<'fact_dc_sku_auth'>
export type ChainSkuAuth = Tables<'fact_chain_sku_auth'>
export type CategoryReview = Tables<'fact_category_review'>
export type DcAnchor = Tables<'bridge_dc_anchor'>
export type CalendarEvent = Tables<'fact_calendar'>
export type Fee = Tables<'ref_fees'>

interface TableState<T> {
  rows: T[]
  error: string | null
}

export interface DataStore {
  skus: TableState<Sku>
  dcs: TableState<Dc>
  chains: TableState<Chain>
  prospects: TableState<Prospect>
  contacts: TableState<Contact>
  dcSkuAuth: TableState<DcSkuAuth>
  chainSkuAuth: TableState<ChainSkuAuth>
  categoryReviews: TableState<CategoryReview>
  anchors: TableState<DcAnchor>
  calendar: TableState<CalendarEvent>
  fees: TableState<Fee>
  loading: boolean
  lastRefresh: Date | null
  refresh: () => void
  /** Optimistic write-back to fact_category_review (the only client write). */
  updateCategoryReview: (
    chainId: string,
    patch: Partial<CategoryReview>,
    userEmail: string,
  ) => Promise<{ error: string | null }>
}

const empty = <T,>(): TableState<T> => ({ rows: [], error: null })

const DataContext = createContext<DataStore | null>(null)

// Fetch one table fully (datasets are all < 1000 rows).
async function fetchTable<T>(
  table: string,
): Promise<TableState<T>> {
  // `table` is validated by the caller list; cast satisfies the typed client.
  const { data, error } = await supabase.from(table as never).select('*')
  if (error) return { rows: [], error: error.message }
  return { rows: (data as T[]) ?? [], error: null }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [skus, setSkus] = useState<TableState<Sku>>(empty)
  const [dcs, setDcs] = useState<TableState<Dc>>(empty)
  const [chains, setChains] = useState<TableState<Chain>>(empty)
  const [prospects, setProspects] = useState<TableState<Prospect>>(empty)
  const [contacts, setContacts] = useState<TableState<Contact>>(empty)
  const [dcSkuAuth, setDcSkuAuth] = useState<TableState<DcSkuAuth>>(empty)
  const [chainSkuAuth, setChainSkuAuth] = useState<TableState<ChainSkuAuth>>(empty)
  const [categoryReviews, setCategoryReviews] = useState<TableState<CategoryReview>>(empty)
  const [anchors, setAnchors] = useState<TableState<DcAnchor>>(empty)
  const [calendar, setCalendar] = useState<TableState<CalendarEvent>>(empty)
  const [fees, setFees] = useState<TableState<Fee>>(empty)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    // Each table resolves independently — one failure only degrades its module.
    Promise.allSettled([
      fetchTable<Sku>('dim_sku').then(setSkus),
      fetchTable<Dc>('dim_dc').then(setDcs),
      fetchTable<Chain>('dim_chain').then(setChains),
      fetchTable<Prospect>('dim_prospect').then(setProspects),
      fetchTable<Contact>('dim_contact').then(setContacts),
      fetchTable<DcSkuAuth>('fact_dc_sku_auth').then(setDcSkuAuth),
      fetchTable<ChainSkuAuth>('fact_chain_sku_auth').then(setChainSkuAuth),
      fetchTable<CategoryReview>('fact_category_review').then(setCategoryReviews),
      fetchTable<DcAnchor>('bridge_dc_anchor').then(setAnchors),
      fetchTable<CalendarEvent>('fact_calendar').then(setCalendar),
      fetchTable<Fee>('ref_fees').then(setFees),
    ]).then(() => {
      setLoading(false)
      setLastRefresh(new Date())
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateCategoryReview = useCallback<DataStore['updateCategoryReview']>(
    async (chainId, patch, userEmail) => {
      const stamped = {
        ...patch,
        updated_at: new Date().toISOString(),
        updated_by: userEmail,
      }
      // Optimistic update.
      const prev = categoryReviews.rows
      setCategoryReviews((s) => ({
        ...s,
        rows: s.rows.map((r) =>
          r.chain_id === chainId ? { ...r, ...stamped } : r,
        ),
      }))
      const { error } = await supabase
        .from('fact_category_review')
        .update(stamped)
        .eq('chain_id', chainId)
      if (error) {
        // Roll back.
        setCategoryReviews((s) => ({ ...s, rows: prev }))
        return { error: error.message }
      }
      return { error: null }
    },
    [categoryReviews.rows],
  )

  const value = useMemo<DataStore>(
    () => ({
      skus, dcs, chains, prospects, contacts,
      dcSkuAuth, chainSkuAuth, categoryReviews, anchors, calendar, fees,
      loading, lastRefresh, refresh, updateCategoryReview,
    }),
    [
      skus, dcs, chains, prospects, contacts,
      dcSkuAuth, chainSkuAuth, categoryReviews, anchors, calendar, fees,
      loading, lastRefresh, refresh, updateCategoryReview,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataStore {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
