import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { Loader } from '../components/Loader'

// Where Microsoft (via Supabase) lands after authentication.
// Supabase returns the session in the URL hash on success, or an error in the
// query string / hash on failure (e.g. the backend trigger rejected a user who
// isn't on the allow-list). The supabase-js client is configured with
// detectSessionInUrl, so it consumes the hash automatically — we just wait for
// the session to appear, then route into the app.

const NOT_PROVISIONED =
  "Your Microsoft account isn't linked to a Renew-it user yet. Contact your administrator."

function friendlyError(raw: string): string {
  const msg = decodeURIComponent(raw)
  // The trigger raises an exception containing "is not provisioned"; Supabase
  // surfaces it as error_description.
  if (/not provisioned|not.*allow.?list|no.*active.*user/i.test(msg)) {
    return NOT_PROVISIONED
  }
  return msg || 'Sign-in failed. Please try again.'
}

export function AuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    // Supabase puts tokens in the hash, errors in either the hash or query.
    const hash = window.location.hash.replace(/^#/, '')
    const query = window.location.search.replace(/^\?/, '')
    const params = new URLSearchParams(hash || query)
    const errParam = params.get('error_description') || params.get('error')

    const goLogin = (authError: string) => {
      if (handled.current) return
      handled.current = true
      // Drop the tokens/error from the URL so a refresh can't re-fire this.
      window.history.replaceState(null, '', '/auth-callback')
      navigate('/', { replace: true, state: { authError } })
    }
    const goApp = () => {
      if (handled.current) return
      handled.current = true
      window.history.replaceState(null, '', '/auth-callback')
      navigate('/dashboard', { replace: true })
    }

    if (errParam) {
      goLogin(friendlyError(errParam))
      return
    }

    // Wait for the SDK to establish the session from the URL.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goApp()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goApp()
    })

    // Fallback: if no session and no error arrived, don't hang forever.
    const timer = window.setTimeout(() => {
      goLogin('Sign-in did not complete. Please try again.')
    }, 8000)

    return () => {
      sub.subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [navigate])

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <Logo branch="Group" height={40} />
        <h1>Signing you in…</h1>
        <p className="sub">Verifying your Microsoft account</p>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <Loader label="" height={48} />
        </div>
      </div>
    </div>
  )
}
