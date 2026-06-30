import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'
import { AuthShell } from '../components/AuthShell'

// Email/password sign-in for testing. This route is intentionally not linked
// from the main (SSO-only) screen — reachable only via its direct URL.
export function StaffLogin() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const ssoError = (location.state as { authError?: string } | null)?.authError ?? null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(ssoError)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) {
      setErr(error)
      return
    }
    navigate('/dashboard')
  }

  return (
    <AuthShell>
      <div className="login-card login-card-staff">
        <div className="login-head">
          <Logo branch="Group" height={34} />
          <span className="login-badge">Testing</span>
        </div>
        <h1>Staff sign in</h1>
        <p className="sub">Email &amp; password access for authorised testers.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">
            <span>Email</span>
            <div className="field-input">
              <svg className="field-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <input
                type="email"
                autoComplete="username"
                placeholder="you@renew-it.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="field-input">
              <svg className="field-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </label>

          {err && <div className="login-error">{err}</div>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-foot">
          Using your Microsoft account instead? <Link to="/" className="login-link">Go to single sign-on</Link>
        </div>
      </div>
    </AuthShell>
  )
}
