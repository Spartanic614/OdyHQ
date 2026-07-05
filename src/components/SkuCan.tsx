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
 * A single flavor cropped out of the shared portfolio sprite, using CSS
 * container query units so it scales responsively inside any container that
 * has `containerType: 'inline-size'` and an aspect-ratio matching
 * skuCanAspect(flavor). Renders nothing if the flavor isn't pictured.
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
    <img
      src={PORTFOLIO_IMAGE}
      alt={flavor}
      draggable={false}
      style={{
        display: 'block',
        width: `${(PORTFOLIO_IMAGE_WIDTH / crop.width) * 100}cqw`,
        maxWidth: 'none',
        height: 'auto',
        marginLeft: `-${(crop.left / crop.width) * 100}cqw`,
        filter: dimmed ? 'grayscale(1)' : 'none',
        opacity: dimmed ? 0.35 : 1,
        transition: 'opacity 150ms, filter 150ms',
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
