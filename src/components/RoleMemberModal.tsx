import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  createRoleMember,
  updateRoleMember,
  deleteRoleMember,
  type RoleEntity,
  type RoleMember,
} from '../lib/api'
import { useToast } from './Toast'
import { useAuth } from '../auth'

// Known production departments, surfaced as type-ahead suggestions.
const DEPARTMENTS = [
  'Line Manager',
  'Stripper',
  'Panelbeater',
  'Flatter',
  'Masker',
  'Spray Painter',
  'Mechanic',
]

export function RoleMemberModal({
  entity,
  label,
  member,
  showDepartment = false,
  onClose,
  onSaved,
}: {
  entity: RoleEntity
  label: string
  member?: RoleMember
  showDepartment?: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { branches, branchId } = useAuth()
  const editing = !!member

  const [firstName, setFirstName] = useState(member?.firstName ?? '')
  const [lastName, setLastName] = useState(member?.lastName ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [department, setDepartment] = useState(member?.department ?? '')
  const [isActive, setIsActive] = useState(member ? member.isActive : true)
  const [branch, setBranch] = useState<string>(member ? (member.branchId ?? '') : (branchId ?? ''))

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('First name, last name and email are required.')
      return
    }
    setSubmitting(true)
    const input = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      isActive,
      department: showDepartment ? department.trim() || null : null,
      branchId: branch || null,
    }
    try {
      if (editing && member) await updateRoleMember(entity, member.id, input)
      else await createRoleMember(entity, input)
      toast(editing ? `${label} updated` : `${label} added`, 'success')
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const doDelete = async () => {
    if (!member) return
    setDeleting(true)
    try {
      await deleteRoleMember(entity, member.id)
      toast(`${label} removed`, 'success')
      onSaved()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{editing ? `Edit ${label}` : `Add ${label}`}</div>
            <div className="modal-sub">
              {editing ? `Update this ${label.toLowerCase()}’s details.` : `Create a new ${label.toLowerCase()}.`}
            </div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-grid">
            <label className="field">
              <span>First name *</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Last name *</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>

            <label className="field span-2">
              <span>Email *</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            {showDepartment && (
              <label className="field">
                <span>Department</span>
                <input
                  list="dept-options"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Spray Painter"
                />
                <datalist id="dept-options">
                  {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
                </datalist>
              </label>
            )}
            <label className="field">
              <span>Branch</span>
              <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">— No branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branch_name}</option>
                ))}
              </select>
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
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="modal-actions">
            {editing && (
              <button type="button" className="btn-delete" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="new-claim" disabled={submitting}>
                {submitting ? 'Saving…' : editing ? 'Save changes' : `Add ${label}`}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDelete && member && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete {member.name}?</div>
            <div className="modal-body">
              <p>This removes the {label.toLowerCase()} from the list. This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-right">
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </button>
                <button className="btn-danger" onClick={doDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete'}
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
