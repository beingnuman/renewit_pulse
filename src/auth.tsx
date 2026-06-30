import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import {
  listBranches,
  getUserPermissions,
  uploadAvatar,
  updateOwnProfilePicture,
  type Branch,
  type UserPermissions,
} from './lib/api'
import { useToast } from './components/Toast'

export interface Profile {
  id: string
  name: string
  email: string | null
  role: string
  branch: string
  branchId: string | null
  isAdmin: boolean
  canAccessAllBranches: boolean
  avatarUrl: string | null
  active: boolean
  agentTypes: string[]
  canAllocateCsa: boolean
  canFuelSlips: boolean
}

interface AuthCtx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
  branches: Branch[]
  branchId: string | null
  setBranchId: (id: string | null) => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithMicrosoft: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateAvatar: (file: File) => Promise<void>
}

const Ctx = createContext<AuthCtx | undefined>(undefined)

interface UserRow {
  id: string
  full_name: string | null
  known_as: string | null
  email: string | null
  email_address: string | null
  role: string | null
  branch_id: string | null
  is_admin: boolean | null
  can_access_all_branches: boolean | null
  profile_picture_url: string | null
  is_active: boolean | null
  active: boolean | null
  branches: { branch_name: string | null } | null
}

function toProfile(row: UserRow): Profile {
  return {
    id: row.id,
    name: row.known_as || row.full_name || row.email || 'User',
    email: row.email || row.email_address,
    role: row.role || (row.is_admin ? 'ADMIN' : 'USER'),
    branch: row.branches?.branch_name || 'Renew-it',
    branchId: row.branch_id,
    isAdmin: !!row.is_admin,
    canAccessAllBranches: !!row.can_access_all_branches,
    avatarUrl: row.profile_picture_url,
    active: row.is_active !== false && row.active !== false,
    agentTypes: [],
    canAllocateCsa: !!row.is_admin,
    canFuelSlips: !!row.is_admin,
  }
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, full_name, known_as, email, email_address, role, branch_id, is_admin, can_access_all_branches, profile_picture_url, is_active, active, branches!users_branch_id_fkey(branch_name)',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load profile:', error.message)
    return null
  }
  return data ? toProfile(data as unknown as UserRow) : null
}

// Resolve the branches a user may switch between. Admins and all-branch users
// see every branch (backend grants them access too); everyone else is limited
// to their own branch + additional_branches.
async function loadBranchesFor(profile: Profile, perms: UserPermissions | null): Promise<Branch[]> {
  try {
    const all = await listBranches()
    if (profile.isAdmin || profile.canAccessAllBranches) return all

    const allowed = new Set<string>(
      perms?.branch_ids ?? [
        ...(perms?.default_branch_id ? [perms.default_branch_id] : []),
        ...(perms?.additional_branches ?? []),
        ...(profile.branchId ? [profile.branchId] : []),
      ],
    )
    const scoped = all.filter((b) => allowed.has(b.id))
    return scoped.length ? scoped : all.filter((b) => b.id === profile.branchId)
  } catch (e) {
    console.error('Failed to load branches:', e)
    return []
  }
}

const INACTIVE_MSG = 'Your account is inactive. Please contact an administrator.'
const BRANCH_KEY = 'renewit.branchId'

function readStoredBranch(): string | null {
  try {
    return localStorage.getItem(BRANCH_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let hydratedUserId: string | null = null

    const hydrate = async (s: Session | null) => {
      if (!active) return
      if (!s) {
        hydratedUserId = null
        setSession(null)
        setProfile(null)
        setBranches([])
        setBranchId(null)
        return
      }
      // Load + validate the profile BEFORE exposing the session, so an inactive
      // account never flashes the app.
      const p = await loadProfile(s.user.id)
      if (!active) return
      if (p && !p.active) {
        await supabase.auth.signOut()
        if (!active) return
        setSession(null)
        setProfile(null)
        setError(INACTIVE_MSG)
        toast(INACTIVE_MSG, 'error')
        return
      }
      const stored = readStoredBranch()
      setSession(s)
      if (!p) {
        setProfile(null)
        return
      }
      // one permissions fetch: drives agent-type gating + branch access
      const perms = await getUserPermissions(p.id).catch(() => null)
      if (!active) return
      const agentTypes = perms?.agent_types ?? []
      const fullProfile: Profile = {
        ...p,
        agentTypes,
        canAllocateCsa: p.isAdmin || agentTypes.some((t) => /csa allocation/i.test(t)),
        canFuelSlips: p.isAdmin || agentTypes.some((t) => /agent type 18|fuel slip/i.test(t)),
      }
      hydratedUserId = s.user.id
      setProfile(fullProfile)
      setBranchId((cur) => cur ?? stored ?? fullProfile.branchId ?? null)
      const bs = await loadBranchesFor(fullProfile, perms)
      if (!active) return
      setBranches(bs)
      const validStored = stored && bs.some((b) => b.id === stored) ? stored : null
      setBranchId(validStored ?? fullProfile.branchId ?? bs[0]?.id ?? null)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      await hydrate(data.session)
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refreshes / re-focus events for the SAME user shouldn't re-hydrate
      // the profile — that recreates `profile` and makes pages refetch on tab focus.
      const sameUser = !!s?.user?.id && s.user.id === hydratedUserId
      if (sameUser && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
        return
      }
      void hydrate(s)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [toast])

  // remember the chosen branch so it survives a reload
  useEffect(() => {
    try {
      if (branchId) localStorage.setItem(BRANCH_KEY, branchId)
    } catch {
      /* ignore */
    }
  }, [branchId])

  const signIn: AuthCtx['signIn'] = async (email, password) => {
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      return { error: error.message }
    }
    // block deactivated accounts before the session is exposed.
    // The toast is fired by hydrate() (the onAuthStateChange handler), so we
    // only return the error here to avoid showing it twice.
    const p = data.user ? await loadProfile(data.user.id) : null
    if (p && !p.active) {
      await supabase.auth.signOut()
      setError(INACTIVE_MSG)
      return { error: INACTIVE_MSG }
    }
    return { error: null }
  }

  // Microsoft (Azure AD) SSO. Supabase handles the full OAuth dance and, on
  // return to /auth-callback, the client picks the session up from the URL
  // (detectSessionInUrl) and onAuthStateChange hydrates the profile — the same
  // path as password sign-in. A first-time sign-in fires the backend
  // trg_enforce_preregistered_aad trigger: if the email isn't on the active
  // allow-list, Supabase redirects back with an error instead of a session.
  const signInWithMicrosoft: AuthCtx['signInWithMicrosoft'] = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth-callback`,
        scopes: 'email openid profile',
      },
    })
    if (error) {
      setError(error.message)
      return { error: error.message }
    }
    // On success the browser is already navigating to Microsoft; nothing to do.
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setBranches([])
    setBranchId(null)
    try {
      localStorage.removeItem(BRANCH_KEY)
    } catch {
      /* ignore */
    }
  }

  const updateAvatar: AuthCtx['updateAvatar'] = async (file) => {
    if (!profile) throw new Error('Not signed in')
    const url = await uploadAvatar(profile.id, file)
    await updateOwnProfilePicture(url)
    setProfile((p) => (p ? { ...p, avatarUrl: url } : p))
  }

  return (
    <Ctx.Provider
      value={{
        session,
        profile,
        loading,
        error,
        branches,
        branchId,
        setBranchId,
        signIn,
        signInWithMicrosoft,
        signOut,
        updateAvatar,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
