// Compatibility shim for the ported reporting feature.
//
// The reporting components import `useAuth` from this module and read a `user`
// object shaped like { id, full_name, known_as, email, role, branch_id,
// is_admin }. We map Pulse's own auth profile onto that shape so the reporting
// code reuses Pulse's logged-in session instead of its own auth.
import { useAuth as usePulseAuth } from '../../auth'

export interface ReportingUser {
  id: string
  full_name: string | null
  known_as: string | null
  email: string | null
  role: string | null
  branch_id: string | null
  is_admin: boolean
}

// Shape the reporting branch dropdowns expect: { id, name, code }.
export interface ReportingBranch {
  id: string
  name: string
  code: string
}

interface ReportingAuth {
  user: ReportingUser | null
  // Real branches, fetched by Pulse's auth (same source as the global switcher).
  branches: ReportingBranch[]
  // The branch currently selected in Pulse's top-right global switcher.
  currentBranchId: string | null
}

export function useAuth(): ReportingAuth {
  const { profile, branches, branchId } = usePulseAuth()

  const user: ReportingUser | null = profile
    ? {
        id: profile.id,
        full_name: profile.name,
        known_as: profile.name,
        email: profile.email,
        role: profile.role,
        branch_id: profile.branchId,
        is_admin: profile.isAdmin,
      }
    : null

  const reportingBranches: ReportingBranch[] = branches.map((b) => ({
    id: b.id,
    name: b.branch_name,
    code: b.branch_code,
  }))

  return { user, branches: reportingBranches, currentBranchId: branchId }
}
