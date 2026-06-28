// ============================================================
// DC → distributor + buyer reference.
// Inventory pastes carry the DC code in the leftmost column; we map it to the
// owning buyer so the auto-email addresses the right person (by first name).
// Edit this table as DC ownership changes.
// ============================================================

export type Distributor = 'KeHE' | 'UNFI'

export interface DcBuyer {
  code: string
  city: string
  distributor: Distributor
  buyer: string // full name; emails use first name only
}

export const DC_BUYERS: DcBuyer[] = [
  { code: 'CHN', city: 'Chino', distributor: 'KeHE', buyer: 'Scott Walsh' },
  { code: 'NCA', city: 'Stockton', distributor: 'KeHE', buyer: 'Scott Walsh' },
  { code: 'AUR', city: 'Denver', distributor: 'KeHE', buyer: 'Scott Walsh' },
  { code: 'POR', city: 'Portland', distributor: 'KeHE', buyer: 'Scott Walsh' },
  { code: 'DEN', city: 'Aurora', distributor: 'UNFI', buyer: 'Yvette Knudsen' },
  { code: 'GIL', city: 'Gilroy', distributor: 'UNFI', buyer: 'Yvette Knudsen' },
  { code: 'IOW', city: 'Iowa City', distributor: 'UNFI', buyer: 'Christine Beish' },
  { code: 'MOR', city: 'Riverside', distributor: 'UNFI', buyer: 'Yvette Knudsen' },
  { code: 'TWC', city: 'Prescott', distributor: 'UNFI', buyer: 'Christine Beish' },
  { code: 'RAC', city: 'Sturtevant', distributor: 'UNFI', buyer: 'Christine Beish' },
  { code: 'RID', city: 'Ridgefield', distributor: 'UNFI', buyer: 'Yvette Knudsen' },
  { code: 'ROC', city: 'Rocklin', distributor: 'UNFI', buyer: 'Yvette Knudsen' },
  { code: 'STA', city: 'Olkton', distributor: 'KeHE', buyer: 'Alejandra Gloss' },
  { code: 'DGV', city: 'Douglasville', distributor: 'KeHE', buyer: 'Alejandra Gloss' },
  { code: 'ROM', city: 'Romeoville', distributor: 'KeHE', buyer: 'Alejandra Gloss' },
  { code: 'BLO', city: 'Ellettsville', distributor: 'KeHE', buyer: 'Alejandra Gloss' },
  { code: 'EMD', city: 'North East', distributor: 'KeHE', buyer: 'Alejandra Gloss' },
  { code: 'LHV', city: 'Breinigsville', distributor: 'KeHE', buyer: 'Alejandra Gloss' },
  { code: 'DFW', city: 'Dallas', distributor: 'KeHE', buyer: 'Alejandra Gloss' },
  { code: 'ATL', city: 'Atlanta', distributor: 'UNFI', buyer: 'Christine Beish' },
  { code: 'CHE', city: 'Chesterfield', distributor: 'UNFI', buyer: 'Josh Tavares' },
  { code: 'DAY', city: 'Dayville', distributor: 'UNFI', buyer: 'Josh Tavares' },
  { code: 'GRW', city: 'Greenwood', distributor: 'UNFI', buyer: 'Christine Beish' },
  { code: 'HOW', city: 'Howell Township', distributor: 'UNFI', buyer: 'Josh Tavares' },
  { code: 'HVA', city: 'Montgomery', distributor: 'UNFI', buyer: 'Josh Tavares' },
  { code: 'MAN', city: 'Schnecksville', distributor: 'UNFI', buyer: 'Josh Tavares' },
  { code: 'SAR', city: 'Sarasota', distributor: 'UNFI', buyer: 'Christine Beish' },
]

const BY_CODE = new Map(DC_BUYERS.map((d) => [d.code.toUpperCase(), d]))

/** Resolve a DC code (case-insensitive) to its reference row, or null. */
export function lookupDc(code: string | null | undefined): DcBuyer | null {
  if (!code) return null
  return BY_CODE.get(code.trim().toUpperCase()) ?? null
}

/** First name only — buyers are never addressed by full name. */
export function firstName(full: string | null | undefined): string {
  if (!full) return ''
  return full.trim().split(/\s+/)[0] ?? ''
}
