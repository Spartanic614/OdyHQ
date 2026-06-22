// ============================================================
// Brand palette — single source of truth.
// Swap in the real Odyssey brand by editing these values
// (and the mirrored entries in tailwind.config.js).
// ============================================================

export const theme = {
  // Surfaces (dark, dense dashboard)
  bg: '#0b0f17',
  surface: '#111726',
  surfaceAlt: '#1a2133',
  border: '#252e44',

  // Text
  text: '#e6eaf2',
  textMuted: '#8b94a7',

  // Brand accent (one vivid accent)
  accent: '#3b82f6',
  accentSoft: '#1e3a8a',

  // Semantic — status colors. NEVER encode status by color alone;
  // always pair with an icon + label (see StatusBadge).
  good: '#22c55e', // Authorized
  bad: '#ef4444', // Not Authorized / risk
  warn: '#f59e0b',
  neutral: '#64748b',
} as const

// Calendar event-type colors (also used in chart legends).
export const eventColors: Record<string, string> = {
  'Retailer Promo': '#3b82f6',
  'Distributor Promo': '#a855f7',
  Merchandising: '#22c55e',
  'Trade Show': '#f59e0b',
}

// Priority tier colors.
export const tierColors: Record<string, string> = {
  A: '#ef4444',
  B: '#f59e0b',
  C: '#64748b',
}

// Generic categorical palette for charts.
export const chartPalette = [
  '#3b82f6',
  '#a855f7',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
]
