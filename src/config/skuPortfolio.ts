// ============================================================
// Odyssey can portfolio sprite — public/Portfolio.png.
//
// One composite image containing every pictured flavor, left to right, in
// brand order. Coordinates below were measured directly from the PNG pixel
// data (color-block transitions between cans) so cards can crop a single
// flavor out of the sprite responsively via CSS container query units.
// EDIT THIS if the portfolio image is ever replaced — re-measure the crop
// boundaries rather than eyeballing them, spacing between cans is not
// perfectly uniform (there's a ~48px gap between the 222mg and 85mg lines).
// ============================================================

export const PORTFOLIO_IMAGE = '/Portfolio.png'
export const PORTFOLIO_IMAGE_WIDTH = 1682
export const PORTFOLIO_IMAGE_HEIGHT = 551

export interface PortfolioSkuCrop {
  /** Must match dim_sku.flavor exactly. */
  flavor: string
  left: number
  width: number
}

// Left-to-right order as shown in the portfolio image.
export const PORTFOLIO_SKUS: PortfolioSkuCrop[] = [
  { flavor: 'Pineapple Mango', left: 0, width: 180 },
  { flavor: 'Blue Raspberry', left: 180, width: 182 },
  { flavor: 'Pink Lemonade', left: 362, width: 181 },
  { flavor: 'Strawberry Watermelon', left: 543, width: 182 },
  { flavor: 'Dragon Fruit Lemonade', left: 773, width: 181 },
  { flavor: 'Blackberry Lemonade', left: 954, width: 181 },
  { flavor: 'Passion Fruit Guava', left: 1135, width: 182 },
  { flavor: 'Tropical Breeze', left: 1317, width: 181 },
  { flavor: 'Mandarin Orange', left: 1498, width: 184 },
]

const BY_FLAVOR = new Map(PORTFOLIO_SKUS.map((s) => [s.flavor.toLowerCase().trim(), s]))

export const portfolioCropFor = (flavor: string): PortfolioSkuCrop | undefined =>
  BY_FLAVOR.get(flavor.toLowerCase().trim())
