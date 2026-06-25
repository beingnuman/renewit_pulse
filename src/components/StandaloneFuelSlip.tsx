import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../auth'
import { useToast } from './Toast'
import { createFuelSlip } from '../lib/api'
import { printVoucher } from '../lib/fuelVoucher'

const FUEL_TYPES = [
  { value: 'driver', label: 'Driver Slip' },
  { value: 'client', label: 'Client Slip' },
  { value: 'workshop', label: 'Workshop Slip' },
]

export function StandaloneFuelSlipModal({ onClose }: { onClose: () => void }) {
  const { branchId } = useAuth()
  const toast = useToast()
  const [slipType, setSlipType] = useState('driver')
  const [recipient, setRecipient] = useState('')
  const [reg, setReg] = useState('')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!branchId) { toast('No branch selected for your session.', 'error'); return }
    if (!recipient.trim()) { toast('Enter the recipient name.', 'error'); return }
    if (!reg.trim()) { toast('Enter the vehicle registration.', 'error'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast('Please enter a valid fuel amount.', 'error'); return }
    setSaving(true)
    try {
      const slip = await createFuelSlip({
        slipType, recipientName: recipient.trim(), vehicleReg: reg.trim(), amount: amt,
        branchId, comment: comment.trim() || null, claimId: null,
      })
      toast('Fuel slip created', 'success')
      onClose()
      printVoucher(slip)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create fuel slip', 'error')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">New Fuel Slip</div>
            <div className="modal-sub">Standalone voucher — not linked to a repair.</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-form">
          <label className="field">
            <span>Type of Slip<span className="req">*</span></span>
            <select value={slipType} onChange={(e) => setSlipType(e.target.value)}>
              {FUEL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Client / Driver Name<span className="req">*</span></span>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Enter recipient name" />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Vehicle Reg<span className="req">*</span></span>
              <input value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} placeholder="ABC123GP" />
            </label>
            <label className="field">
              <span>Fuel Amount (R)<span className="req">*</span></span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R 0,00" inputMode="decimal" />
            </label>
          </div>
          <label className="field">
            <span>Comment</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Optional note" />
          </label>
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="new-claim" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create Slip'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
