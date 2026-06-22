import { useMemo } from 'react'
import { useData } from './store'
import {
  chainPriorities,
  notContactedHitList,
  overviewKpis,
  skuOpportunities,
  unlockCandidates,
} from './selectors'

export function useChainPriorities() {
  const { chains, categoryReviews, chainSkuAuth } = useData()
  return useMemo(
    () => chainPriorities(chains.rows, categoryReviews.rows, chainSkuAuth.rows),
    [chains.rows, categoryReviews.rows, chainSkuAuth.rows],
  )
}

export function useHitList() {
  const { chains, categoryReviews, prospects } = useData()
  return useMemo(
    () => notContactedHitList(chains.rows, categoryReviews.rows, prospects.rows),
    [chains.rows, categoryReviews.rows, prospects.rows],
  )
}

export function useSkuOpportunities() {
  const { dcs, skus, dcSkuAuth } = useData()
  return useMemo(
    () => skuOpportunities(dcs.rows, skus.rows, dcSkuAuth.rows),
    [dcs.rows, skus.rows, dcSkuAuth.rows],
  )
}

export function useUnlockCandidates() {
  const { dcs, anchors, chains, categoryReviews, chainSkuAuth } = useData()
  return useMemo(
    () =>
      unlockCandidates(
        dcs.rows,
        anchors.rows,
        chains.rows,
        categoryReviews.rows,
        chainSkuAuth.rows,
      ),
    [dcs.rows, anchors.rows, chains.rows, categoryReviews.rows, chainSkuAuth.rows],
  )
}

export function useOverviewKpis() {
  const { chains, dcs, dcSkuAuth, categoryReviews } = useData()
  const unlock = useUnlockCandidates()
  return useMemo(
    () =>
      overviewKpis(
        chains.rows,
        dcs.rows,
        dcSkuAuth.rows,
        categoryReviews.rows,
        unlock.length,
      ),
    [chains.rows, dcs.rows, dcSkuAuth.rows, categoryReviews.rows, unlock.length],
  )
}
