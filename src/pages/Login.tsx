import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'
import { AuthShell } from '../components/AuthShell'

export function Login() {
  const { signInWithMicrosoft } = useAuth()
  const location = useLocation()
  // An SSO failure (e.g. account not on the allow-list) routes back here with
  // a friendly message in navigation state.
  const ssoError = (location.state as { authError?: string } | null)?.authError ?? null
  const [err, setErr] = useState<string | null>(ssoError)
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

  return (
    <AuthShell>
      <div className="login-card login-card-sso">
        <div className="login-head">
          <Logo branch="Group" height={34} />
          <span className="login-eyebrow">Renew-it Pulse</span>
        </div>

        <h1>Welcome back</h1>
        <p className="sub">Continue with your Microsoft work account to access your dashboard.</p>

        {err && <div className="login-error">{err}</div>}

        <button
          type="button"
          className="ms-btn ms-btn-primary"
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

        <div className="login-secure">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Secured by Microsoft single sign-on. Access follows your role &amp; branch automatically.
        </div>
      </div>
    </AuthShell>
  )
}
