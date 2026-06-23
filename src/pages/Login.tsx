import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setBusy(false)
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="card p-6 w-full max-w-sm space-y-4"
      >
        <div>
          <div className="text-2xl font-bold tracking-tight brand">
            Odyssey Mothership
          </div>
          <div className="text-sm text-muted">Sign in to continue</div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Email</label>
          <input
            className="input w-full"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Password</label>
          <input
            className="input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <div className="text-sm text-bad">{error}</div>}
        <button className="btn btn-accent w-full justify-center" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-[11px] text-muted">
          Accounts are provisioned by an admin in Supabase. No public sign-up.
        </p>
      </form>
    </div>
  )
}
