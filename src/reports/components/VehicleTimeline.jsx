import { useState, useEffect, useCallback } from 'react'
import { rpc } from '../lib/supabase'
import './VehicleTimeline.css'

const BUBBLE_URL = 'https://renew-it.bubbleapps.io/console'

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Today ${time}`
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + ` ${time}`
}

function overdueLabel(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m overdue`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hrs}h ${remMins}m overdue`
}

function statusIcon(status) {
  if (status === 'completed') return '✓'
  if (status === 'missed') return '!'
  if (status === 'cancelled') return '✕'
  return '◦'
}

/* ─── Timeline form to add a new commitment ─── */
function AddCommitmentForm({ claimId, branchId, roNumber, currentDepartment, userId, onAdded, wipStatuses }) {
  const [toDept, setToDept] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [time, setTime] = useState('')
  const [responsible, setResponsible] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!toDept.trim() || !time || saving) return
    setSaving(true)
    try {
      const committedDatetime = new Date(`${date}T${time}:00`)
      // Adjust for SAST (UTC+2)
      const utcDate = new Date(committedDatetime.getTime())

      const result = await rpc('add_timeline_commitment', {
        p_claim_id: claimId,
        p_branch_id: branchId,
        p_ro_number: roNumber,
        p_from_department: currentDepartment,
        p_to_department: toDept.trim(),
        p_committed_datetime: utcDate.toISOString(),
        p_committed_by: userId,
        p_responsible_person_name: responsible.trim() || null,
        p_notes: notes.trim() || null,
      })
      if (result?.success) {
        setToDept('')
        setTime('')
        setResponsible('')
        setNotes('')
        onAdded()
      }
    } catch (err) {
      console.error('Failed to add commitment:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="tl-add-form" onSubmit={handleSubmit}>
      <div className="tl-form-row">
        <div className="tl-field">
          <label>Move to</label>
          <select
            value={toDept}
            onChange={e => setToDept(e.target.value)}
            required
            className="tl-select"
          >
            <option value="">Select status...</option>
            {wipStatuses.map(s => (
              <option key={s.id} value={s.statusName}>{s.statusName}</option>
            ))}
          </select>
        </div>
        <div className="tl-field tl-field-date">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="tl-field tl-field-time">
          <label>By</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
        </div>
        <div className="tl-field">
          <label>Responsible</label>
          <input
            type="text"
            placeholder="Person name"
            value={responsible}
            onChange={e => setResponsible(e.target.value)}
          />
        </div>
      </div>
      <div className="tl-form-row">
        <div className="tl-field tl-field-notes">
          <input
            type="text"
            placeholder="Notes (optional)..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <button type="submit" className="tl-btn-add" disabled={saving || !toDept.trim() || !time}>
          {saving ? 'Adding...' : 'Add Commitment'}
        </button>
      </div>
    </form>
  )
}

/* ─── Single commitment row ─── */
function CommitmentRow({ c, userId, onComplete, onCancel }) {
  const isPending = c.status === 'pending'
  const isMissed = c.status === 'missed'
  const isOverdue = isPending && new Date(c.committedDatetime) < new Date()

  return (
    <div className={`tl-item tl-item-${c.status} ${isOverdue ? 'tl-item-overdue' : ''}`}>
      <div className="tl-item-dot">
        <span className={`tl-dot tl-dot-${isOverdue ? 'missed' : c.status}`}>{statusIcon(isOverdue ? 'missed' : c.status)}</span>
      </div>
      <div className="tl-item-content">
        <div className="tl-item-main">
          <span className="tl-move">
            <span className="tl-dept-from">{c.fromDepartment}</span>
            <svg className="tl-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            <span className="tl-dept-to">{c.toDepartment}</span>
          </span>
          <span className={`tl-time ${isOverdue || isMissed ? 'tl-time-overdue' : ''}`}>
            {fmtDateTime(c.committedDatetime)}
            {(isOverdue || isMissed) && <span className="tl-overdue-badge">{overdueLabel(c.committedDatetime)}</span>}
          </span>
        </div>
        <div className="tl-item-meta">
          {c.responsiblePersonName && (
            <span className="tl-responsible">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {c.responsiblePersonName}
            </span>
          )}
          <span className="tl-committed-by">Set by {c.committedByName}</span>
          {c.notes && <span className="tl-note">{c.notes}</span>}
          {c.status === 'completed' && c.completedByName && (
            <span className="tl-completed-info">Completed by {c.completedByName}</span>
          )}
        </div>
      </div>
      {isPending && (
        <div className="tl-item-actions">
          <button className="tl-btn-done" onClick={() => onComplete(c.id)} title="Mark as done">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button className="tl-btn-cancel" onClick={() => onCancel(c.id)} title="Cancel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Main VehicleTimeline component ─── */
export default function VehicleTimeline({ claimId, branchId, roNumber, currentDepartment, userId }) {
  const [commitments, setCommitments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [wipStatuses, setWipStatuses] = useState([])

  // Fetch WIP statuses once
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await rpc('get_wip_statuses')
        if (!cancelled && result?.success) {
          setWipStatuses(result.statuses || [])
        }
      } catch (err) {
        console.error('Failed to fetch WIP statuses:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const fetchCommitments = useCallback(async () => {
    if (!branchId || !roNumber) return
    try {
      const result = await rpc('get_timeline_commitments', {
        p_branch_id: branchId,
        p_ro_number: roNumber,
      })
      if (result?.success) {
        setCommitments(result.commitments || [])
      }
    } catch (err) {
      console.error('Failed to fetch commitments:', err)
    } finally {
      setLoading(false)
    }
  }, [branchId, roNumber])

  useEffect(() => {
    fetchCommitments()
  }, [fetchCommitments])

  async function handleComplete(commitmentId) {
    try {
      await rpc('complete_timeline_commitment', {
        p_commitment_id: commitmentId,
        p_completed_by: userId,
      })
      fetchCommitments()
    } catch (err) {
      console.error('Failed to complete:', err)
    }
  }

  async function handleCancel(commitmentId) {
    try {
      await rpc('cancel_timeline_commitment', {
        p_commitment_id: commitmentId,
        p_cancelled_by: userId,
      })
      fetchCommitments()
    } catch (err) {
      console.error('Failed to cancel:', err)
    }
  }

  const pending = commitments.filter(c => c.status === 'pending')
  const completed = commitments.filter(c => c.status === 'completed')
  const missed = commitments.filter(c => c.status === 'missed')
  const hasPending = pending.length > 0

  return (
    <div className="tl-container">
      <div className="tl-header">
        <div className="tl-header-left">
          <svg className="tl-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <h4 className="tl-title">Timeline Commitments</h4>
          {hasPending && <span className="tl-pending-badge">{pending.length} pending</span>}
        </div>
        <button className="tl-btn-toggle" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Move'}
        </button>
      </div>

      {showForm && (
        <AddCommitmentForm
          claimId={claimId}
          branchId={branchId}
          roNumber={roNumber}
          currentDepartment={currentDepartment}
          userId={userId}
          wipStatuses={wipStatuses}
          onAdded={() => { setShowForm(false); fetchCommitments() }}
        />
      )}

      {loading && commitments.length === 0 && (
        <div className="tl-loading">Loading timeline...</div>
      )}

      {!loading && commitments.length === 0 && !showForm && (
        <div className="tl-empty">No commitments yet. Click "+ Add Move" to schedule a department move.</div>
      )}

      {commitments.length > 0 && (
        <div className="tl-list">
          {pending.map(c => (
            <CommitmentRow key={c.id} c={c} userId={userId} onComplete={handleComplete} onCancel={handleCancel} />
          ))}
          {missed.map(c => (
            <CommitmentRow key={c.id} c={c} userId={userId} onComplete={handleComplete} onCancel={handleCancel} />
          ))}
          {completed.map(c => (
            <CommitmentRow key={c.id} c={c} userId={userId} onComplete={handleComplete} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  )
}
