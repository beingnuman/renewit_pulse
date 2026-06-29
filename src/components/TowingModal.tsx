import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  createTowingCompany,
  updateTowingCompany,
  deleteTowingCompany,
  type TowingCompany,
} from '../lib/api'
import { useToast } from './Toast'

export function TowingModal({
  company,
  onClose,
  onSaved,
}: {
  company?: TowingCompany
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const editing = !!company

  const [name, setName] = useState(company?.name ?? '')
  const [isActive, setIsActive] = useState(company ? company.is_active !== false : true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hard, setHard] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Company name is required.'); return }
    setSubmitting(true)
    const input = { name, isActive }
    try {
      if (editing && company) await updateTowingCompany(company.id, input)
      else await createTowingCompany(input)
      toast(editing ? 'Towing company updated' : 'Towing company added', 'success')
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const doDelete = async () => {
    if (!company) return
    setDeleting(true)
    try {
      await deleteTowingCompany(company.id, hard)
      toast(hard ? 'Towing company deleted' : 'Towing company deactivated', 'success')
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
            <div className="modal-title">{editing ? 'Edit towing company' : 'Add towing company'}</div>
            <div className="modal-sub">{editing ? 'Update this company’s details.' : 'Create a new towing company.'}</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-grid">
            <label className="field span-2">
              <span>Company name *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </label>
            <label className="field span-2">
              <span>Status</span>
              <select
                className={`status-select ${isActive ? 'on' : 'off'}`}
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive (hidden from lists)</option>
              </select>
            </label>
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="modal-actions">
            {editing && (
              <button type="button" className="btn-delete" onClick={() => { setHard(false); setConfirmDelete(true) }}>
                Delete
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="new-claim" disabled={submitting}>
                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Add company'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDelete && company && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete {company.name}?</div>
            <div className="modal-body">
              <label className={`del-opt${!hard ? ' on' : ''}`}>
                <input type="radio" checked={!hard} onChange={() => setHard(false)} />
                <div>
                  <strong>Deactivate</strong>
                  <p>Hides it from the towing lists. Reversible.</p>
                </div>
              </label>
              <label className={`del-opt danger${hard ? ' on' : ''}`}>
                <input type="radio" checked={hard} onChange={() => setHard(true)} />
                <div>
                  <strong>Permanently delete</strong>
                  <p>Removes it for good. Blocked if any claim still references it.</p>
                </div>
              </label>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-right">
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
                <button className="btn-danger" onClick={doDelete} disabled={deleting}>
                  {deleting ? 'Working…' : hard ? 'Permanently delete' : 'Deactivate'}
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
