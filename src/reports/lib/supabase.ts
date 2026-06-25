// Compatibility shim for the ported reporting feature.
//
// The reporting code (copied from the standalone RenewIT_reporting app) imports
// `getAccessToken`, `refreshAccessToken`, `rpc`, `SUPABASE_URL` and
// `SUPABASE_ANON_KEY` from this module. Instead of running its own token
// handoff / refresh logic, we delegate everything to Pulse's existing Supabase
// client and its logged-in session.
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase'

export { SUPABASE_URL, SUPABASE_ANON_KEY }

// Cache the current access token synchronously so the reporting code's
// `getAccessToken()` (called when building edge-function request headers) keeps
// working without going async. Kept in sync with Pulse's auth state.
let _token: string | null = null

void supabase.auth.getSession().then(({ data }) => {
  _token = data.session?.access_token ?? null
})

supabase.auth.onAuthStateChange((_event, session) => {
  _token = session?.access_token ?? null
})

export function getAccessToken(): string | null {
  return _token
}

// Returns a valid access token, refreshing the session only if needed. The
// reporting code calls this after a 401 to retry the request with a fresh token.
export async function refreshAccessToken(): Promise<string | null> {
  const { data: current } = await supabase.auth.getSession()
  if (current.session?.access_token) {
    _token = current.session.access_token
    return _token
  }
  const { data } = await supabase.auth.refreshSession()
  _token = data.session?.access_token ?? null
  return _token
}

// Postgres RPC via Pulse's client (auth is attached automatically). Mirrors the
// original shim's contract: returns the parsed rows, throws on error.
export async function rpc(
  fnName: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const { data, error } = await supabase.rpc(fnName, params)
  if (error) throw new Error(error.message || `RPC ${fnName} failed`)
  return data
}
