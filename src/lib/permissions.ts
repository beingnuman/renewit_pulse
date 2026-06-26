import type { Profile } from '../auth'

// Nav destinations that are subject to role-based visibility.
export const NAV_PATHS = [
  '/dashboard',
  '/claims',
  '/reports',
  '/documents',
  '/customers',
  '/allocate',
  '/admin',
  '/calendar',
] as const

// Returns the set of nav paths a profile is allowed to see / open.
//
// Rules (frontend-only gating):
//  - Admins (is_admin) see everything.
//  - The 11 known job roles get an explicit allow-list (see matrix below).
//  - Any other / unknown / null role falls back to the base set
//    (Dashboard, All Claims, Reports, Documents).
//  - Allocate CSA stays gated by the existing CSA-allocation permission.
//
// Role strings in the DB are inconsistent (e.g. "Claims Handler",
// "claims_handler", "CSA", "Parts Buyer"), so we match on normalised keywords.
export function navAllowed(profile: Profile | null): Set<string> {
  if (!profile) return new Set<string>(['/dashboard'])
  if (profile.isAdmin) return new Set<string>(NAV_PATHS)

  const base = ['/dashboard', '/claims', '/reports', '/documents']
  const r = (profile.role || '').toLowerCase()
  const has = (...kw: string[]) => kw.every((k) => r.includes(k))

  let allowed: string[]
  if (has('claim', 'handler')) allowed = [...base, '/customers', '/calendar']
  else if (has('estimator')) allowed = [...base, '/calendar']
  else if (has('conversion', 'clerk')) allowed = [...base, '/calendar']
  else if (has('moderat')) allowed = [...base, '/calendar']
  else if (has('part', 'buyer')) allowed = [...base]
  else if (has('floor', 'manager')) allowed = [...base, '/calendar']
  else if (has('auditor')) allowed = [...base, '/calendar']
  else if (has('costing', 'clerk')) allowed = [...base, '/calendar']
  else if (has('financial', 'manager')) allowed = [...base, '/customers', '/calendar']
  else if (has('operations', 'director')) allowed = [...base, '/customers', '/calendar']
  else if (has('csa')) allowed = [...base, '/calendar']
  else allowed = [...base] // unknown / generic roles

  const set = new Set<string>(allowed)
  if (profile.canAllocateCsa) set.add('/allocate')
  return set
}

export function canAccessPath(profile: Profile | null, path: string): boolean {
  return navAllowed(profile).has(path)
}
