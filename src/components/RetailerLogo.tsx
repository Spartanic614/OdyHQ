import { useMemo } from 'react'
import { getLogoUrl, getChainInitials } from '../config/chainLogos'
import { theme } from '../theme'

interface RetailerLogoProps {
  chainName: string
  size?: 'sm' | 'md' | 'lg'
}

export function RetailerLogo({ chainName, size = 'md' }: RetailerLogoProps) {
  const logoUrl = useMemo(() => getLogoUrl(chainName), [chainName])
  const initials = useMemo(() => getChainInitials(chainName), [chainName])

  const sizeClass = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size]

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={chainName}
        className={`${sizeClass} rounded object-contain bg-white/5 p-1`}
        onError={(e) => {
          // Fallback to initials if image fails to load
          e.currentTarget.style.display = 'none'
          e.currentTarget.nextElementSibling?.classList.remove('hidden')
        }}
      />
    )
  }

  // Fallback: initials badge
  return (
    <div
      className={`${sizeClass} rounded flex items-center justify-center font-bold`}
      style={{
        backgroundColor: theme.info,
        color: '#000',
      }}
    >
      {initials}
    </div>
  )
}
