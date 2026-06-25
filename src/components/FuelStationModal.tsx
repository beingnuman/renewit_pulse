import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  createFuelStation,
  updateFuelStation,
  deleteFuelStation,
  type Branch,
  type FuelStation,
} from '../lib/api'
import { useToast } from './Toast'

export function FuelStationModal({
  branches,
  station,
  defaultBranchId,
  onClose,
  onSaved,
}: {
  branches: Branch[]
  station?: FuelStation
  defaultBranchId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const editing = !!station

  const [branchId, setBranchId] = useState(station?.branch_id ?? defaultBranchId ?? branches[0]?.id ?? '')
  const [name, setName] = useState(station?.name ?? '')
  const [accountNo, setAccountNo] = useState(station?.account_no ?? '')
  const [address, setAddress] = useState(station?.address ?? '')
  const [isActive, setIsActive] = useState(station ? station.is_active !== false : true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hard, setHard] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!branchId) { setError('Choose a branch.'); return }
    if (!name.trim()) { setError('Station name is required.'); return }
    setSubmitting(true)
    const input = { branchId, name, accountNo, address, isActive }
    try {
      if (editing && station) await updateFuelStation(station.id, input)
      else await createFuelStation(input)
      toast(editing ? 'Fuel station updated' : 'Fuel station added', 'success')
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const doDelete = async () => {
    if (!station) return
    setDeleting(true)
    try {
      await deleteFuelStation(station.id, hard)
      toast(hard ? 'Fuel station deleted' : 'Fuel station deactivated', 'success')
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
            <div className="modal-title">{editing ? 'Edit fuel station' : 'Add fuel station'}</div>
            <div className="modal-sub">{editing ? 'Update this station’s details.' : 'Create a new fuel station.'}</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-grid">
            <label className="field span-2">
              <span>Branch *</span>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
                <option value="" disabled>Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </label>
            <label className="field span-2">
              <span>Station name *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Account no.</span>
              <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
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
            <label className="field span-2">
              <span>Address</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
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
                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Add station'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDelete && station && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete {station.name}?</div>
            <div className="modal-body">
              <label className={`del-opt${!hard ? ' on' : ''}`}>
                <input type="radio" checked={!hard} onChange={() => setHard(false)} />
                <div>
                  <strong>Deactivate</strong>
                  <p>Marks the station inactive. Reversible.</p>
                </div>
              </label>
              <label className={`del-opt danger${hard ? ' on' : ''}`}>
                <input type="radio" checked={hard} onChange={() => setHard(true)} />
                <div>
                  <strong>Permanently delete</strong>
                  <p>Removes the station for good. Cannot be undone.</p>
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
