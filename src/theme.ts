// ============================================================
// Brand palette — single source of truth (mirrors tailwind.config.js).
// Aesthetic: Clean modern interface with grey background and white cards.
// Swap the brand by editing these values + the tailwind mirror.
// ============================================================

export const theme = {
  // Surfaces (light grey background with white cards)
  bg: '#f3f4f6',
  surface: '#ffffff',
  surfaceAlt: '#f9fafb',
  border: '#e5e7eb',

  // Text (dark for light backgrounds)
  text: '#1f2937',
  textMuted: '#6b7280',

  // Brand accent — blue
  accent: '#3b82f6',
  accentSoft: '#dbeafe',

  // Semantic — never encode status by color alone; pair with icon + label.
  good: '#34d399', // Authorized
  bad: '#fb7185', // Not Authorized / risk
  warn: '#fbbf24',
  info: '#38bdf8', // Need + have coverage (e.g. served counties)
  neutral: '#6b7280',
} as const

// Calendar event-type colors (cool metallic, still distinguishable).
export const eventColors: Record<string, string> = {
  'Retailer Promo': '#9db4c9',
  'Distributor Promo': '#b6a7c2',
  Merchandising: '#79c2b0',
  'Trade Show': '#d4b58c',
  'KeHE Roadmap': '#cf9a86',
  'UNFI Roadmap': '#6fc0c0',
}

// Priority tier colors.
export const tierColors: Record<string, string> = {
  A: '#fb7185',
  B: '#fbbf24',
  C: '#6b7280',
}

// Categorical chart palette — cool steels/silvers with two warm accents.
export const chartPalette = [
  '#9db4c9',
  '#c6cdd6',
  '#6f8aa0',
  '#79c2b0',
  '#b6a7c2',
  '#8f9aa8',
  '#d4b58c',
  '#a7c4a0',
]
