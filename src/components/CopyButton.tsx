import { useState } from 'react'

// Fallback for contexts where the async Clipboard API is unavailable or
// rejects (non-HTTPS, missing permission, older browsers).
function legacyCopy(value: string): boolean {
  const el = document.createElement('textarea')
  el.value = value
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(el)
  return ok
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    let ok = false
    try {
      await navigator.clipboard.writeText(value)
      ok = true
    } catch {
      ok = legacyCopy(value)
    }
    setState(ok ? 'copied' : 'error')
    setTimeout(() => setState('idle'), 1200)
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text transition-colors"
      title={`Copy ${label ?? 'value'}`}
    >
      {state === 'copied' ? '✓ Copied' : state === 'error' ? '✕ Copy failed' : '⧉ Copy'}
    </button>
  )
}
