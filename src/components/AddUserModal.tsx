import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth'
import { MultiSelect } from './MultiSelect'
import {
  createUser,
  updateUser,
  deleteUser,
  getAgentTypesByCategory,
  getAgentTypesForRole,
  getUserPermissions,
  SYSTEM_ROLES,
  type AgentType,
  type AdminUser,
} from '../lib/api'
import { useToast } from './Toast'

// Map a display role ("Admin (Full Access)") to the normalized key the RPC wants.
function roleKey(display: string): string {
  const lc = display.toLowerCase()
  if (lc.includes('admin')) return 'admin'
  return lc.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function AddUserModal({
  user,
  onClose,
  onSaved,
}: {
  user?: AdminUser
  onClose: () => void
  onSaved: () => void
}) {
  const { branches, branchId } = useAuth()
  const toast = useToast()
  const editing = !!user
  const alreadyInactive = (user?.status ?? 'active').toLowerCase() === 'inactive'
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hardDelete, setHardDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [email, setEmail] = useState(user?.email ?? '')
  const [fullName, setFullName] = useState(user?.name ?? '')
  const [primaryBranch, setPrimaryBranch] = useState(user?.branchId ?? branchId ?? branches[0]?.id ?? '')
  const [additional, setAdditional] = useState<string[]>(user?.additionalBranchIds ?? [])
  const [origAdditional, setOrigAdditional] = useState<string[]>(user?.additionalBranchIds ?? [])
  const [systemRole, setSystemRole] = useState(
    user?.role && SYSTEM_ROLES.includes(user.role) ? user.role : '',
  )
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [isActive, setIsActive] = useState(
    user ? (user.status ?? 'active').toLowerCase() !== 'inactive' : true,
  )

  const [allTypes, setAllTypes] = useState<AgentType[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [autoRole, setAutoRole] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // load agent types + (when editing) authoritative per-user details, then prefill
  useEffect(() => {
    let on = true
    Promise.all([
      getAgentTypesByCategory(),
      user ? getUserPermissions(user.id).catch(() => null) : Promise.resolve(null),
    ])
      .then(([groups, perms]) => {
        if (!on) return
        const flat = groups.flatMap((g) => g.agentTypes)
        setAllTypes(flat)

        const names = perms?.agent_types ?? user?.agentTypes ?? []
        if (names.length) {
          const byName = new Map(flat.map((t) => [t.name.trim().toLowerCase(), t.id]))
          setSelected(new Set(names.map((n) => byName.get(n.trim().toLowerCase())).filter((x): x is string => !!x)))
        }

        if (perms) {
          if (perms.branch_id) setPrimaryBranch(perms.branch_id)
          if (perms.additional_branches) {
            setAdditional(perms.additional_branches)
            setOrigAdditional(perms.additional_branches)
          }
          const key = perms.job_title || perms.agent_type || perms.role
          const disp = key ? SYSTEM_ROLES.find((r) => roleKey(r) === key) : undefined
          if (disp) setSystemRole(disp)
        }
      })
      .catch(() => {})
    return () => { on = false }
  }, [user])

  const onRoleChange = async (value: string) => {
    setSystemRole(value)
    setAutoRole(null)
    if (!value) return
    const key = roleKey(value)
    try {
      const list = await getAgentTypesForRole(key)
      // Admin = full access (all types); otherwise only types tagged for this role.
      const ids = key === 'admin'
        ? list.map((a) => a.id)
        : list.filter((a) => a.defaultRoles.includes(key)).map((a) => a.id)
      // Conversions Clerk always gets Agent Type 4 (Conversion), matched by name
      // so it doesn't depend on a hard-coded id.
      if (key === 'conversions_clerk') {
        const at4 = list.find((a) => /agent type 4\b/i.test(a.name))
        if (at4 && !ids.includes(at4.id)) ids.push(at4.id)
      }
      setSelected(new Set(ids))
      setAutoRole(value)
    } catch {
      /* leave selection as-is */
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const selectedTypes = allTypes.filter((t) => selected.has(t.id))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !fullName.trim() || !primaryBranch || !systemRole || !phone.trim()) {
      setError('Please fill all required fields.')
      return
    }
    setSubmitting(true)
    const agentTypeNames = selectedTypes.map((t) => t.name)
    try {
      if (editing && user) {
        await updateUser(user.id, {
          email: email.trim(), fullName: fullName.trim(), systemRole, phone: phone.trim(),
          primaryBranchId: primaryBranch, additionalBranchIds: additional,
          originalAdditionalBranchIds: origAdditional, isActive, agentTypeNames,
        })
      } else {
        await createUser({
          email: email.trim(), fullName: fullName.trim(), systemRole, phone: phone.trim(),
          primaryBranchId: primaryBranch, additionalBranchIds: additional, isActive, agentTypeNames,
        })
      }
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save user')
    } finally {
      setSubmitting(false)
    }
  }

  const doDelete = async () => {
    if (!user) return
    setDeleting(true)
    try {
      const msg = await deleteUser(user.id, hardDelete)
      toast(msg, 'success')
      onSaved()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{editing ? 'Edit User' : 'Add a New User'}</div>
            <div className="modal-sub">
              {editing
                ? 'Update this user’s role, permissions and agent types.'
                : 'Create a new user account with assigned role, permissions, and agent types.'}
            </div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-section-title">Basic Information</div>

          <div className="form-grid">
            <label className="field">
              <span>Email *</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {!editing && <small>User will receive login credentials at this email</small>}
            </label>
            <label className="field">
              <span>Full name *</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>

            <label className="field">
              <span>Phone *</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                className={`status-select ${isActive ? 'on' : 'off'}`}
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="field">
              <span>System role *</span>
              <select value={systemRole} onChange={(e) => onRoleChange(e.target.value)} required>
                <option value="" disabled>Select job title</option>
                {SYSTEM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Primary Branch *</span>
              <select value={primaryBranch} onChange={(e) => setPrimaryBranch(e.target.value)} required>
                <option value="" disabled>Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </label>

            <div className="field span-2">
              <span>Additional Branches</span>
              <MultiSelect
                options={branches.filter((b) => b.id !== primaryBranch).map((b) => ({ id: b.id, label: b.branch_name }))}
                selected={additional.filter((id) => id !== primaryBranch)}
                onChange={setAdditional}
                placeholder="Search and add branches…"
              />
            </div>
          </div>

          <div className="form-section-title">Agent Types &amp; Permissions</div>
          <div className="agent-note">
            <strong>Agent Types</strong> are system-level permissions that control what actions this user can perform.
          </div>

          <div className="at-panel">
            <div className="at-panel-head">
              <span className="at-info" aria-hidden>ⓘ</span>
              {autoRole ? `Auto-selected for ${autoRole}` : 'Selected agent types'}
              <span className="at-count">{selectedTypes.length}</span>
            </div>
            {selectedTypes.length === 0 ? (
              <div className="at-empty">None selected yet — pick a role to auto-select, or choose below.</div>
            ) : (
              <div className="at-chips">
                {selectedTypes.map((t) => <span key={t.id} className="at-chip">{t.name.trim()}</span>)}
              </div>
            )}
          </div>

          <div className="at-list">
            {allTypes.map((t) => {
              const on = selected.has(t.id)
              return (
                <label key={t.id} className={`at-card${on ? ' on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(t.id)} />
                  <div className="at-card-body">
                    <div className="at-card-name">{t.name.trim()}</div>
                    {t.description && <div className="at-card-desc">{t.description}</div>}
                  </div>
                </label>
              )
            })}
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="modal-actions">
            {editing && (
              <button
                type="button"
                className="btn-delete"
                onClick={() => { setHardDelete(alreadyInactive); setConfirmDelete(true) }}
              >
                Delete user
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="new-claim" disabled={submitting}>
                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create User'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDelete && user && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete {user.name}?</div>
            <div className="modal-body">
              {alreadyInactive ? (
                <p className="del-note">This account is already inactive, so deactivating wouldn’t change anything.</p>
              ) : (
                <label className={`del-opt${!hardDelete ? ' on' : ''}`}>
                  <input type="radio" checked={!hardDelete} onChange={() => setHardDelete(false)} />
                  <div>
                    <strong>Deactivate</strong>
                    <p>Marks the account inactive and blocks login. Reversible — everything is kept.</p>
                  </div>
                </label>
              )}
              <label className={`del-opt danger${hardDelete ? ' on' : ''}`}>
                <input type="radio" checked={hardDelete} onChange={() => setHardDelete(true)} />
                <div>
                  <strong>Permanently delete</strong>
                  <p>Removes the account for good. Their claim/audit history is reassigned to a “former staff” record; agent-type assignments &amp; notifications are removed. Cannot be undone.</p>
                </div>
              </label>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-right">
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
                <button className="btn-danger" onClick={doDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : hardDelete ? 'Permanently delete' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
