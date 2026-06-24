// ============================================================
// Brand palette — single source of truth (mirrors tailwind.config.js).
// Aesthetic: futuristic "Apple Glass" — graphite, steel, silver.
// Swap the brand by editing these values + the tailwind mirror.
// ============================================================

export const theme = {
  // Surfaces (graphite base; glass translucency handled in index.css)
  bg: '#0a0c0f',
  surface: '#13161b',
  surfaceAlt: '#1b1f26',
  border: '#2a2f38',

  // Text
  text: '#eceef1',
  textMuted: '#959dab',

  // Brand accent — polished silver / steel
  accent: '#c2cad4',
  accentSoft: '#2b313a',

  // Semantic — never encode status by color alone; pair with icon + label.
  good: '#34d399', // Authorized
  bad: '#fb7185', // Not Authorized / risk
  warn: '#fbbf24',
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
