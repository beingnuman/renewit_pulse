import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
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
    <div className="login-wrap">
      <div className="login-card">
        <Logo branch="Group" height={40} />
        <h1>Welcome back</h1>
        <p className="sub">Sign in to your Renew-it account</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="you@renew-it.co.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {err && <div className="login-error">{err}</div>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-divider"><span>or</span></div>

        <button className="ms-btn" disabled title="Microsoft SSO coming soon">
          <span className="ms-grid" aria-hidden>
            <span style={{ background: '#f25022' }} />
            <span style={{ background: '#7fba00' }} />
            <span style={{ background: '#00a4ef' }} />
            <span style={{ background: '#ffb900' }} />
          </span>
          Sign in with Microsoft
          <span className="soon">soon</span>
        </button>

        <div className="login-foot">
          Your branch &amp; role are assigned to your account automatically.
        </div>
      </div>
    </div>
  )
}
