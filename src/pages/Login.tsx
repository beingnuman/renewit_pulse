import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'

export function Login() {
  const { signIn, signInWithMicrosoft } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // An SSO failure (e.g. account not on the allow-list) routes back here with
  // a friendly message in navigation state.
  const ssoError = (location.state as { authError?: string } | null)?.authError ?? null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(ssoError)
  const [busy, setBusy] = useState(false)
  const [msBusy, setMsBusy] = useState(false)

  const handleMicrosoft = async () => {
    setErr(null)
    setMsBusy(true)
    const { error } = await signInWithMicrosoft()
    // On success the browser is already redirecting to Microsoft.
    if (error) {
      setErr(error)
      setMsBusy(false)
    }
  }

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
    <div className="login-wrap">
      <div className="login-card">
        <Logo branch="Group" height={40} />
        <h1>Welcome back</h1>
        <p className="sub">Sign in to your Renew-it account</p>

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

        <div className="login-divider"><span>or</span></div>

        <button
          type="button"
          className="ms-btn"
          onClick={handleMicrosoft}
          disabled={msBusy}
        >
          <span className="ms-grid" aria-hidden>
            <span style={{ background: '#f25022' }} />
            <span style={{ background: '#7fba00' }} />
            <span style={{ background: '#00a4ef' }} />
            <span style={{ background: '#ffb900' }} />
          </span>
          {msBusy ? 'Redirecting…' : 'Sign in with Microsoft'}
        </button>

        <div className="login-foot">
          Your branch &amp; role are assigned to your account automatically.
        </div>
      </div>
    </div>
  )
}
