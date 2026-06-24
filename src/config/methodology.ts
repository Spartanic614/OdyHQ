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

// PO-to-warehouse lead time (weeks). Items with WOS at/under this stock out
// before a replenishment PO can arrive — the "at risk" line.
export const INVENTORY_LEAD_TIME_WEEKS = 3

// Inventory is entered in units (singles). Buyers order in layers:
//   1 case = 12 units (12-pack); 1 layer = 26 cases = 312 units.
export const INVENTORY_UNITS_PER_CASE = 12
export const INVENTORY_CASES_PER_LAYER = 26

// ---- Trade spend calculator ----
// Net margin (net profit ÷ sales) at/above this reads "Profitable";
// between 0 and this reads "Breakeven"; below 0 reads "In the Red".
export const TRADE_PROFIT_MARGIN = 0.05

// ---- Channel groups for the Most Wanted boxes ----
// Maps raw dim_chain.channel values to a group. Edit these alias lists to
// match the channel flags in the real dataset (matched case-insensitively:
// exact first, then substring fallback).
export const CHANNEL_GROUPS: Record<string, string[]> = {
  'Large Format': ['large format', 'conventional', 'grocery', 'mass', 'club', 'drug', 'big box'],
  Natural: ['natural', 'natural & specialty', 'specialty', 'co-op', 'coop', 'infra', 'ncg'],
}

export function channelGroup(channel: string | null | undefined): string | null {
  if (!channel) return null
  const c = channel.trim().toLowerCase()
  const entries = Object.entries(CHANNEL_GROUPS)
  // Exact match wins.
  for (const [group, aliases] of entries) {
    if (aliases.some((a) => c === a)) return group
  }
  // Substring fallback checks Natural first so compound values like
  // "Natural Grocery" don't get pulled into Large Format via "grocery".
  for (const [group, aliases] of [...entries].reverse()) {
    if (aliases.some((a) => c.includes(a))) return group
  }
  return null
}

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
