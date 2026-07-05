import { useMemo, useState } from 'react'
import { getLogoUrl, getChainInitials } from '../config/chainLogos'
import { theme } from '../theme'

interface RetailerLogoProps {
  chainName: string
  size?: 'sm' | 'md' | 'lg'
}

export function RetailerLogo({ chainName, size = 'md' }: RetailerLogoProps) {
  const logoUrl = useMemo(() => getLogoUrl(chainName), [chainName])
  const initials = useMemo(() => getChainInitials(chainName), [chainName])
  const [imageLoaded, setImageLoaded] = useState(false)

  const sizeClass = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size]

  const badgeClass = `${sizeClass} rounded flex items-center justify-center font-bold flex-shrink-0`

  if (logoUrl) {
    return (
      <div className="relative">
        <img
          src={logoUrl}
          alt={chainName}
          className={`${badgeClass} rounded object-contain bg-white/5 p-1`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
          style={{ display: imageLoaded ? 'flex' : 'none' }}
        />
        {!imageLoaded && (
          <div
            className={badgeClass}
            style={{
              backgroundColor: theme.info,
              color: '#000',
            }}
          >
            {initials}
          </div>
        )}
      </div>
    )
  }

  // No URL: initials badge only
  return (
    <div
      className={badgeClass}
      style={{
        backgroundColor: theme.info,
        color: '#000',
      }}
    >
      {initials}
    </div>
  )
}
