// ============================================================
// Methodology — all weights & thresholds live here (§4 of brief).
// Tune the model by editing this one file.
// ============================================================

// 4.1 — Category-Review Priority Score
// reviewUrgency multiplier keyed by meeting_progress.
export const REVIEW_URGENCY: Record<string, number> = {
  'Not Contacted': 1.0,
  Declined: 0.85,
  'Not Scheduled': 0.6,
  Scheduled: 0.3,
  Executed: 0.1,
}

// Fallback urgency when meeting_progress is missing/unknown.
export const REVIEW_URGENCY_DEFAULT = 1.0

// priorityScore = total_universe * (BASE + GAP_WEIGHT * skuGapPct) * reviewUrgency
export const PRIORITY_BASE = 0.5
export const PRIORITY_GAP_WEIGHT = 0.5

// Tier cutoffs on the normalized 0–100 score (quartile-style defaults).
// score >= A => 'A', >= B => 'B', else 'C'.
export const TIER_THRESHOLDS = {
  A: 75,
  B: 50,
} as const

// 4.4 — Anchor → DC unlock
// A DC is 'Dormant' when l52w_volume is below this threshold.
export const DORMANT_VOLUME_THRESHOLD = 200

// new_at_kehe value that marks a DC as unlock-eligible.
export const NEW_AT_KEHE_ELIGIBLE = 'Eligible'

// 4.3 — SKU opportunity
export const AUTH_AUTHORIZED = 'Authorized'
export const AUTH_NOT_AUTHORIZED = 'Not Authorized'

// "Not Contacted" canonical value (4.2).
export const NOT_CONTACTED = 'Not Contacted'

// dim_prospect.contacted value meaning "not yet contacted".
export const PROSPECT_NOT_CONTACTED = 'No'

// ---- Inventory / reorder tool ----
// Target Weeks of Supply: items below this are flagged; suggested order
// refills up to this many weeks of cover.
export const INVENTORY_TARGET_WOS = 4

// When true, On-PO counts toward current WOS and is netted out of the
// suggested order quantity (avoids double-ordering). Default off.
export const INVENTORY_INCLUDE_ON_PO = false

// WOS at/under this is "critical" (red); at/under target+buffer is "watch".
export const WOS_WATCH_BUFFER = 1

// ---- Trade spend calculator ----
// Net margin (net profit ÷ sales) at/above this reads "Profitable";
// between 0 and this reads "Breakeven"; below 0 reads "In the Red".
export const TRADE_PROFIT_MARGIN = 0.05

export type Tier = 'A' | 'B' | 'C'

export function tierForScore(score: number): Tier {
  if (score >= TIER_THRESHOLDS.A) return 'A'
  if (score >= TIER_THRESHOLDS.B) return 'B'
  return 'C'
}

export function reviewUrgency(meetingProgress: string | null | undefined): number {
  if (!meetingProgress) return REVIEW_URGENCY_DEFAULT
  return REVIEW_URGENCY[meetingProgress] ?? REVIEW_URGENCY_DEFAULT
}
