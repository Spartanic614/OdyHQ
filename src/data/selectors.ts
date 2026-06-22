// ============================================================
// Derived data per §4 of the brief. Pure functions over store rows.
// All weights/thresholds come from config/methodology.ts.
// ============================================================
import {
  AUTH_NOT_AUTHORIZED,
  DORMANT_VOLUME_THRESHOLD,
  NEW_AT_KEHE_ELIGIBLE,
  NOT_CONTACTED,
  PROSPECT_NOT_CONTACTED,
  reviewUrgency,
  tierForScore,
  type Tier,
} from '../config/methodology'
import type {
  CategoryReview,
  Chain,
  ChainSkuAuth,
  Dc,
  DcAnchor,
  DcSkuAuth,
  Prospect,
  Sku,
} from './store'

// ---------- SKU gap per chain ----------
export interface ChainSkuSummary {
  tracked: number
  notAuthorized: number
  gapPct: number // 0..1
}

export function chainSkuSummaries(
  chainSkuAuth: ChainSkuAuth[],
): Map<string, ChainSkuSummary> {
  const m = new Map<string, { tracked: number; notAuth: number }>()
  for (const r of chainSkuAuth) {
    const e = m.get(r.chain_id) ?? { tracked: 0, notAuth: 0 }
    e.tracked += 1
    if (r.auth_status === AUTH_NOT_AUTHORIZED) e.notAuth += 1
    m.set(r.chain_id, e)
  }
  const out = new Map<string, ChainSkuSummary>()
  for (const [k, v] of m) {
    out.set(k, {
      tracked: v.tracked,
      notAuthorized: v.notAuth,
      gapPct: v.tracked ? v.notAuth / v.tracked : 0,
    })
  }
  return out
}

// ---------- 4.1 Priority score + tiers ----------
export interface ChainPriority {
  chain: Chain
  review?: CategoryReview
  skuTracked: number
  skuNotAuthorized: number
  skuGapPct: number
  meetingProgress: string | null
  rawScore: number
  score: number // normalized 0–100
  tier: Tier
}

export function chainPriorities(
  chains: Chain[],
  reviews: CategoryReview[],
  chainSkuAuth: ChainSkuAuth[],
): ChainPriority[] {
  const reviewBy = new Map(reviews.map((r) => [r.chain_id, r]))
  const skuBy = chainSkuSummaries(chainSkuAuth)

  const interim = chains.map((chain) => {
    const review = reviewBy.get(chain.chain_id)
    const sku = skuBy.get(chain.chain_id)
    const gapPct = sku?.gapPct ?? 0
    const mp = review?.meeting_progress ?? null
    const tam = chain.total_universe ?? 0
    const rawScore = tam * (0.5 + 0.5 * gapPct) * reviewUrgency(mp)
    return {
      chain,
      review,
      skuTracked: sku?.tracked ?? 0,
      skuNotAuthorized: sku?.notAuthorized ?? 0,
      skuGapPct: gapPct,
      meetingProgress: mp,
      rawScore,
    }
  })

  const maxRaw = interim.reduce((m, r) => Math.max(m, r.rawScore), 0)
  return interim
    .map((r) => {
      const score = maxRaw > 0 ? (r.rawScore / maxRaw) * 100 : 0
      return { ...r, score, tier: tierForScore(score) }
    })
    .sort((a, b) => b.score - a.score)
}

// ---------- 4.2 Not-contacted hit list ----------
export interface HitListRow {
  kind: 'chain' | 'prospect'
  id: string
  name: string
  size: number // total_universe or units
  channel: string | null
  region: string | null
  owner: string | null // AM (chains)
  detail: string
}

export function notContactedHitList(
  chains: Chain[],
  reviews: CategoryReview[],
  prospects: Prospect[],
): HitListRow[] {
  const reviewBy = new Map(reviews.map((r) => [r.chain_id, r]))
  const chainRows: HitListRow[] = chains
    .filter(
      (c) => reviewBy.get(c.chain_id)?.meeting_progress === NOT_CONTACTED,
    )
    .map((c) => ({
      kind: 'chain' as const,
      id: c.chain_id,
      name: c.chain_name ?? c.chain_id,
      size: c.total_universe ?? 0,
      channel: c.channel,
      region: c.region,
      owner: c.account_manager,
      detail: 'Category review — Not Contacted',
    }))

  const prospectRows: HitListRow[] = prospects
    .filter((p) => (p.contacted ?? '').trim() === PROSPECT_NOT_CONTACTED)
    .map((p) => ({
      kind: 'prospect' as const,
      id: `prospect:${p.prospect_id}`,
      name: p.prospect_name ?? `Prospect ${p.prospect_id}`,
      size: p.units ?? 0,
      channel: p.channel,
      region: p.region,
      owner: null,
      detail: 'SPINS prospect — not contacted',
    }))

  return [...chainRows, ...prospectRows].sort((a, b) => b.size - a.size)
}

// ---------- 4.3 SKU opportunity (DC × Not Authorized, weighted by volume) ----------
export interface SkuOpportunity {
  dc: Dc
  sku: Sku
  moq: number | null
  weight: number // l52w_volume of the DC
}

export function skuOpportunities(
  dcs: Dc[],
  skus: Sku[],
  dcSkuAuth: DcSkuAuth[],
): SkuOpportunity[] {
  const dcBy = new Map(dcs.map((d) => [d.dc_code, d]))
  const skuBy = new Map(skus.map((s) => [s.sku_code, s]))
  return dcSkuAuth
    .filter((r) => r.auth_status === AUTH_NOT_AUTHORIZED)
    .map((r) => {
      const dc = dcBy.get(r.dc_code)
      const sku = skuBy.get(r.sku_code)
      if (!dc || !sku) return null
      return { dc, sku, moq: r.moq, weight: dc.l52w_volume ?? 0 }
    })
    .filter((x): x is SkuOpportunity => x !== null)
    .sort((a, b) => b.weight - a.weight)
}

// ---------- 4.4 Anchor → DC unlock ----------
export type DcStatus = 'Active' | 'Dormant'

export interface AnchorInfo {
  chainName: string
  chainId: string | null
  meetingProgress: string | null
  contacted: boolean
  skuTracked: number
  skuNotAuthorized: number
  accountManager: string | null
}

export interface UnlockCandidate {
  dc: Dc
  status: DcStatus
  newAtKehe: boolean
  anchors: AnchorInfo[]
  /** higher = act first */
  leverage: number
}

export function dcStatus(dc: Dc): DcStatus {
  return (dc.l52w_volume ?? 0) >= DORMANT_VOLUME_THRESHOLD ? 'Active' : 'Dormant'
}

export function unlockCandidates(
  dcs: Dc[],
  anchors: DcAnchor[],
  chains: Chain[],
  reviews: CategoryReview[],
  chainSkuAuth: ChainSkuAuth[],
): UnlockCandidate[] {
  const chainBy = new Map(chains.map((c) => [c.chain_id, c]))
  const reviewBy = new Map(reviews.map((r) => [r.chain_id, r]))
  const skuBy = chainSkuSummaries(chainSkuAuth)
  const anchorsByDc = new Map<string, DcAnchor[]>()
  for (const a of anchors) {
    const list = anchorsByDc.get(a.dc_code) ?? []
    list.push(a)
    anchorsByDc.set(a.dc_code, list)
  }

  const candidates: UnlockCandidate[] = []
  for (const dc of dcs) {
    const status = dcStatus(dc)
    const newAtKehe = (dc.new_at_kehe ?? '').trim() === NEW_AT_KEHE_ELIGIBLE
    const isCandidate = status === 'Dormant' || newAtKehe
    if (!isCandidate) continue

    const dcAnchors = anchorsByDc.get(dc.dc_code) ?? []
    const anchorInfos: AnchorInfo[] = dcAnchors.map((a) => {
      const chain = a.anchor_chain_id ? chainBy.get(a.anchor_chain_id) : undefined
      const review = a.anchor_chain_id ? reviewBy.get(a.anchor_chain_id) : undefined
      const sku = a.anchor_chain_id ? skuBy.get(a.anchor_chain_id) : undefined
      const mp = review?.meeting_progress ?? null
      return {
        chainName: a.anchor_chain_name ?? chain?.chain_name ?? '—',
        chainId: a.anchor_chain_id,
        meetingProgress: mp,
        contacted: mp != null && mp !== NOT_CONTACTED,
        skuTracked: sku?.tracked ?? 0,
        skuNotAuthorized: sku?.notAuthorized ?? 0,
        accountManager: chain?.account_manager ?? null,
      }
    })

    // Leverage: New@KeHE Eligible first, then dormant DCs whose anchor is not yet contacted.
    const anyAnchorNotContacted = anchorInfos.some((a) => !a.contacted)
    let leverage = 0
    if (newAtKehe) leverage += 1000
    if (status === 'Dormant' && anyAnchorNotContacted) leverage += 500
    leverage += dc.l52w_volume ?? 0

    candidates.push({ dc, status, newAtKehe, anchors: anchorInfos, leverage })
  }
  return candidates.sort((a, b) => b.leverage - a.leverage)
}

// ---------- 4.5 Overview KPIs ----------
export interface OverviewKpis {
  tam: number
  l52wVolume: number
  activeDcs: number
  skuAuthCoveragePct: number // 0..1
  chainsNotContacted: number
  unlockCandidates: number
}

export function overviewKpis(
  chains: Chain[],
  dcs: Dc[],
  dcSkuAuth: DcSkuAuth[],
  reviews: CategoryReview[],
  unlockCount: number,
): OverviewKpis {
  const tam = chains.reduce((s, c) => s + (c.total_universe ?? 0), 0)
  const l52wVolume = dcs.reduce((s, d) => s + (d.l52w_volume ?? 0), 0)
  const activeDcs = dcs.filter((d) => dcStatus(d) === 'Active').length
  const knownAuth = dcSkuAuth.filter((r) => r.auth_status != null)
  const authorized = knownAuth.filter((r) => r.auth_status !== AUTH_NOT_AUTHORIZED)
  const skuAuthCoveragePct = knownAuth.length
    ? authorized.length / knownAuth.length
    : 0
  const chainsNotContacted = reviews.filter(
    (r) => r.meeting_progress === NOT_CONTACTED,
  ).length
  return {
    tam,
    l52wVolume,
    activeDcs,
    skuAuthCoveragePct,
    chainsNotContacted,
    unlockCandidates: unlockCount,
  }
}
