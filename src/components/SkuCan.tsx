import {
  PORTFOLIO_IMAGE,
  PORTFOLIO_IMAGE_HEIGHT,
  PORTFOLIO_IMAGE_WIDTH,
  portfolioCropFor,
} from '../config/skuPortfolio'

const FALLBACK_ASPECT_WIDTH = 180

/** Aspect ratio (as a CSS `aspect-ratio` value) for the given flavor's crop. */
export function skuCanAspect(flavor: string): string {
  const crop = portfolioCropFor(flavor)
  return `${crop?.width ?? FALLBACK_ASPECT_WIDTH} / ${PORTFOLIO_IMAGE_HEIGHT}`
}

export const hasSkuCanArt = (flavor: string): boolean => !!portfolioCropFor(flavor)

/**
 * A single flavor cropped out of the shared portfolio sprite using
 * background-image positioning. Scales responsively inside any container
 * with an aspect-ratio matching skuCanAspect(flavor).
 */
export function SkuCanImage({
  flavor,
  dimmed,
  style,
}: {
  flavor: string
  dimmed: boolean
  style?: React.CSSProperties
}) {
  const crop = portfolioCropFor(flavor)
  if (!crop) return null

  return (
    <div
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        backgroundImage: `url(${PORTFOLIO_IMAGE})`,
        backgroundPosition: `${-(crop.left / PORTFOLIO_IMAGE_WIDTH) * 100}% 0`,
        backgroundSize: `${(PORTFOLIO_IMAGE_WIDTH / crop.width) * 100}% auto`,
        backgroundRepeat: 'no-repeat',
        filter: dimmed ? 'grayscale(1)' : 'none',
        opacity: dimmed ? 0.35 : 1,
        transition: 'opacity 150ms, filter 150ms',
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
      alt={flavor}
      role="img"
      aria-label={flavor}
    />
  )
}
