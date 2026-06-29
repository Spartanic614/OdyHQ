// ============================================================
// SKU tracking lists by distributor — Inventory tool.
//
// Each distributor's inventory export uses its own SKU naming convention, so
// the lists are kept separately and matched against the pasted SKU text.
//   track: true  → included in the reorder analysis / buyer message
//   track: false → EXCLUDED from analysis each time (e.g. Revive, variety packs)
//
// EDIT THIS FILE to add/remove SKUs or flip what's tracked. Buyer names live in
// dcBuyers.ts (DC → buyer); the buyers per distributor are summarized below.
//   KeHE  → Scott Walsh, Alejandra Gloss
//   UNFI  → Yvette Knudsen, Christine Beish, Josh Tavares
// ============================================================
import type { Distributor } from './dcBuyers'

export interface TrackedSku {
  /** Exact SKU description as it appears in the distributor's export. */
  name: string
  /** false = excluded from the analysis. */
  track: boolean
}

export const SKU_TRACKING: Record<Distributor, TrackedSku[]> = {
  KeHE: [
    { name: 'BEV SPRKL TROPICAL', track: true },
    { name: 'BEV SPRKL ENRG PSSN ORNGE', track: true },
    { name: 'BEV SPRK ENRG BLKBRY LMN', track: true },
    { name: 'BEV SPRKL ENRG DRGFRT LMN', track: true },
    { name: 'BEV SPRKL PNPLE MANGO', track: true },
    { name: 'ENRGY DNK SPRK ORAN GING', track: true },
    { name: 'BEV SPRKL PINK LEMONADE', track: true },
    { name: 'BEV SPRKL BLUE RASPBERRY', track: true },
    { name: 'BEV SPRKL STRWBRY WTRMLN', track: true },
    { name: 'BEV SPRKL 3VAR 12CT', track: false },
    { name: 'BEV SPRKL 4VAR PK 12CT', track: false },
    { name: 'BEV SPRKL 3VAR PK 12CT', track: false },
    { name: 'BEV SPRKL COLA', track: false },
  ],
  UNFI: [
    { name: 'SPRK ENERGY,PINK LEMONADE', track: true },
    { name: 'SPRK ENRGY,BLUE RASPBRRY', track: true },
    { name: 'SPRK ENRGY,STRWB WTRMLN', track: true },
    { name: 'SPRK ENERGY,BLKBRY LEMON', track: true },
    { name: 'SPRK ENRGY,PINEAPL MANGO', track: true },
    { name: 'SPRK ENERGY,PSSN ORNG GVA', track: true },
    { name: 'SPRK ENERGY,ORANGE GINGER', track: true },
    { name: 'SPRK ENERGY,DRGNFRT LMNDE', track: true },
    { name: 'SPRK ENERGY,TROPICAL', track: true },
    { name: 'REVIVE HYDRT,PRCKLY PEAR', track: false },
    { name: 'REVIVE HYDRT,STRWBRY PSSN', track: false },
    { name: 'REVIVE HYDRT,YUZU LIME', track: false },
    { name: 'SPK ENERGY,CHERRY LIME', track: false },
    { name: 'SPARKLING ENERGY,COLA', track: false },
  ],
}

// Normalize for matching: uppercase, tidy comma spacing, collapse whitespace.
const normalize = (s: string) =>
  s.toUpperCase().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim()

// distributor → normalized SKU name → track flag
const INDEX = new Map<string, Map<string, boolean>>()
for (const [dist, list] of Object.entries(SKU_TRACKING)) {
  const m = new Map<string, boolean>()
  for (const s of list) m.set(normalize(s.name), s.track)
  INDEX.set(dist, m)
}

/**
 * True if any of the given names matches an EXCLUDED SKU for the distributor.
 * Unknown SKUs (not in the list) are not excluded — they still get analyzed.
 */
export function isExcludedSku(
  distributor: string | null | undefined,
  ...names: (string | null | undefined)[]
): boolean {
  if (!distributor) return false
  const m = INDEX.get(distributor)
  if (!m) return false
  for (const n of names) {
    if (!n) continue
    if (m.get(normalize(n)) === false) return true
  }
  return false
}

export const trackingFor = (distributor: Distributor): TrackedSku[] =>
  SKU_TRACKING[distributor] ?? []
