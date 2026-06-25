import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { updateBranch, type Branch, type BranchUpdate } from '../lib/api'
import { useToast } from './Toast'
import { MapPicker } from './MapPicker'

// Branch address & geographic location.
export function BranchEditModal({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()

  const [address, setAddress] = useState(branch.address ?? '')
  const [phone, setPhone] = useState(branch.phone ?? '')
  const [email, setEmail] = useState(branch.email ?? '')
  const [geoLat, setGeoLat] = useState<number | null>(branch.geo_lat ?? null)
  const [geoLng, setGeoLng] = useState<number | null>(branch.geo_lng ?? null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const patch: BranchUpdate = {
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      geo_lat: geoLat,
      geo_lng: geoLng,
    }
    try {
      await updateBranch(branch.id, patch)
      toast('Branch updated', 'success')
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{branch.branch_name}</div>
            <div className="modal-sub">{branch.branch_code} · address &amp; geographic location</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-section-title">Address &amp; contact</div>
          <div className="form-grid">
            <label className="field span-2">
              <span>Address</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <div className="field span-2">
              <span>Location pin</span>
              <MapPicker
                lat={geoLat}
                lng={geoLng}
                searchQuery={address}
                onChange={(la, ln) => { setGeoLat(la); setGeoLng(ln) }}
              />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="modal-actions">
            <div className="modal-actions-right">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="new-claim" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
