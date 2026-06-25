import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { rpc } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { exportWipReport, exportWipReportPdf } from '../lib/exportExcel'
import VehicleTimeline from './VehicleTimeline'
import StatusHistory from './StatusHistory'
import './WipReportTable.css'

/* ── Formatters ── */
function fmtVal(val) {
  if (val == null) return ''
  const n = Number(val)
  if (isNaN(n)) return ''
  return Math.round(n / 1000).toLocaleString('en-ZA')
}

function fmtCurrency(val) {
  if (val == null) return ''
  const n = Number(val)
  if (isNaN(n)) return ''
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtVol(val) {
  if (val == null) return ''
  return String(val)
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function fmtTimestamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function userDisplayName(user) {
  if (!user) return 'Unknown'
  return user.known_as || user.full_name || user.email || 'Unknown'
}

function userInitials(user) {
  const name = userDisplayName(user)
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

/* ── Categories to show ── */
const VISIBLE_CATEGORIES = ['WIP', 'Invoicing']

/* ── Department display order (matches production flow) ── */
const DEPARTMENT_ORDER = [
  '01-Preliminary Conversion',
  '01-Moderation Query - Repairer Query',
  '01-Moderation Query - Insurance Query',
  '01-Moderation - Await Ins Auth',
  '01-Moderation',
  '01-Converted',
  '98-Warranty on Site',
  '02-Awaiting Parts -Yard',
  '04-Speedbump - Parts',
  '03-Outwork/Mech Panelbeating',
  '03-Panelbeating',
  '04-Paint Prep',
  '04-Paintshop',
  '05-Assembly',
  '05-Speedbump - Assembly',
  '06-Polishing',
  '06-QC',
  '08-Ready - Docs Recvd CSI',
]

function sortDepartments(departments) {
  return [...departments].sort((a, b) => {
    const aName = a.department.toLowerCase()
    const bName = b.department.toLowerCase()
    const aIdx = DEPARTMENT_ORDER.findIndex(d => d.toLowerCase() === aName)
    const bIdx = DEPARTMENT_ORDER.findIndex(d => d.toLowerCase() === bName)
    if (aIdx === -1 && bIdx === -1) return aName.localeCompare(bName)
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })
}

/* ── Department phase grouping ── */
function getDeptPhase(deptName) {
  const name = deptName.toLowerCase()
  if (name.startsWith('01-')) return 'admin'
  if (name.startsWith('98-')) return 'admin'
  if (name.startsWith('02-')) return 'parts'
  if (name.startsWith('03-')) return 'body'
  if (name.startsWith('04-') && name.includes('speedbump')) return 'parts'
  if (name.startsWith('04-')) return 'paint'
  if (name.startsWith('05-')) return 'assembly'
  if (name.startsWith('06-')) return 'final'
  if (name.startsWith('08-')) return 'final'
  return ''
}

const PHASE_META = {
  admin: { color: '#6366f1', bg: '#eef2ff', label: 'Admin' },
  parts: { color: '#f59e0b', bg: '#fffbeb', label: 'Parts' },
  body: { color: '#ef4444', bg: '#fef2f2', label: 'Body' },
  paint: { color: '#8b5cf6', bg: '#f5f3ff', label: 'Paint' },
  assembly: { color: '#10b981', bg: '#ecfdf5', label: 'Assembly' },
  final: { color: '#06b6d4', bg: '#ecfeff', label: 'Final' },
}

const SUMMARY_COL_COUNT = 9

/* ── Days color coding ── */
function daysColor(days) {
  if (days == null) return ''
  if (days <= 3) return 'days-ok'
  if (days <= 7) return 'days-warn'
  return 'days-danger'
}

/* ── Expanded vehicle card ── */
function VehicleExpandedCard({
  vehicle, departmentName, branchId, reportType,
  commentsByRow, currentUser, fetchComments,
  drafts, setDrafts, replyTo, setReplyTo, replyDrafts, setReplyDrafts,
  posting, setPosting, loadingComments,
}) {
  const v = vehicle
  const rowKey = `vehicle::${v.roNumber}`
  const rowComments = commentsByRow[rowKey] || []
  const draft = drafts[rowKey] || ''

  function handleDraftChange(value) {
    setDrafts(prev => ({ ...prev, [rowKey]: value }))
  }

  function handleReplyToggle(commentId) {
    if (commentId === null) {
      setReplyTo({})
    } else {
      setReplyTo(prev => (prev[rowKey] === commentId ? {} : { [rowKey]: commentId }))
    }
  }

  function handleReplyDraftChange(commentId, value) {
    setReplyDrafts(prev => ({ ...prev, [commentId]: value }))
  }

  async function postComment() {
    const text = (drafts[rowKey] || '').trim()
    if (!text || posting || !currentUser?.id) return
    setPosting(true)
    try {
      await rpc('add_reporting_comment', {
        p_report_type: reportType,
        p_branch_id: branchId,
        p_row_key: rowKey,
        p_user_id: currentUser.id,
        p_comment: text,
      })
      setDrafts(prev => ({ ...prev, [rowKey]: '' }))
      await fetchComments()
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setPosting(false)
    }
  }

  async function postReply(parentId) {
    const text = (replyDrafts[parentId] || '').trim()
    if (!text || posting || !currentUser?.id) return
    setPosting(true)
    try {
      await rpc('add_reporting_comment', {
        p_report_type: reportType,
        p_branch_id: branchId,
        p_row_key: rowKey,
        p_user_id: currentUser.id,
        p_comment: text,
        p_parent_id: parentId,
      })
      setReplyDrafts(prev => ({ ...prev, [parentId]: '' }))
      setReplyTo({})
      await fetchComments()
    } catch (err) {
      console.error('Failed to post reply:', err)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="vcard">
      {/* Vehicle info bar */}
      <div className="vcard-info-bar">
        <div className="vcard-info-group">
          <div className="vcard-info-item">
            <span className="vcard-info-label">DR / RO</span>
            <span className="vcard-info-value">
              {v.claimId ? (
                <a href={`https://renew-it.bubbleapps.io/console?claim=${v.claimId}&v=All-Claims`} className="vcard-link" target="_blank" rel="noopener noreferrer">
                  {v.drNumber} / {v.roNumber}
                </a>
              ) : (
                <>{v.drNumber} / {v.roNumber}</>
              )}
            </span>
          </div>
          <div className="vcard-info-item">
            <span className="vcard-info-label">Vehicle</span>
            <span className="vcard-info-value">{v.vehicleRegistration} <span className="vcard-info-dim">{v.vehicleModel}</span></span>
          </div>
          {v.insurance && (
            <div className="vcard-info-item">
              <span className="vcard-info-label">Insurance</span>
              <span className="vcard-info-value">{v.insurance}</span>
            </div>
          )}
          {v.customerDetails && (
            <div className="vcard-info-item">
              <span className="vcard-info-label">Customer</span>
              <span className="vcard-info-value">{v.customerDetails}</span>
            </div>
          )}
        </div>
        <div className="vcard-info-group vcard-info-stats">
          {v.approvedValue != null && (
            <div className="vcard-stat-card">
              <span className="vcard-stat-num">{fmtCurrency(v.approvedValue)}</span>
              <span className="vcard-stat-label">Approved Value</span>
            </div>
          )}
          {v.daysInDepartment != null && (
            <div className={`vcard-stat-card vcard-stat-card-${daysColor(v.daysInDepartment)}`}>
              <span className="vcard-stat-num">{v.daysInDepartment}</span>
              <span className="vcard-stat-label">Days in Dept</span>
            </div>
          )}
          {v.promiseDate && (
            <div className="vcard-stat-card">
              <span className="vcard-stat-num vcard-stat-num-sm">{v.promiseDate}</span>
              <span className="vcard-stat-label">Promise Date</span>
            </div>
          )}
        </div>
      </div>

      {/* Extra details row */}
      <div className="vcard-detail-chips">
        {v.csa && <span className="vcard-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> CSA: {v.csa}</span>}
        {v.towDriveIn && <span className="vcard-chip vcard-chip-highlight">{v.towDriveIn === 'T' ? 'Tow-in' : v.towDriveIn === 'D' ? 'Drive-in' : v.towDriveIn}</span>}
        {v.daysInDepartmentInclWeekends != null && <span className="vcard-chip">{v.daysInDepartmentInclWeekends} days incl. weekends</span>}
      </div>

      {/* Status History */}
      {v.claimId && <StatusHistory claimId={v.claimId} />}

      {/* Timeline commitments */}
      {v.claimId && currentUser?.id && (
        <VehicleTimeline
          claimId={v.claimId}
          branchId={branchId}
          roNumber={v.roNumber}
          currentDepartment={departmentName}
          userId={currentUser.id}
        />
      )}

      {/* Comments section */}
      <div className="vcard-comments">
        <div className="vcard-section-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Comments {rowComments.length > 0 && `(${rowComments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)})`}</span>
        </div>

        {loadingComments && rowComments.length === 0 && (
          <div className="vcard-comment-loading">Loading comments...</div>
        )}

        {rowComments.length > 0 && (
          <div className="vcard-comment-list">
            {rowComments.map(c => (
              <div key={c.id} className="vcard-comment-thread">
                <div className="vcard-comment-item">
                  <div className="vcard-comment-top">
                    <div className="vcard-comment-avatar">{userInitials(c.user)}</div>
                    <div className="vcard-comment-meta">
                      <span className="vcard-comment-author">{userDisplayName(c.user)}</span>
                      {c.user?.role && <span className="vcard-comment-role">{c.user.role}</span>}
                    </div>
                    <span className="vcard-comment-time">{fmtTimestamp(c.created_at)}</span>
                  </div>
                  <p className="vcard-comment-text">{c.comment}</p>
                  <button className="vcard-btn-reply" onClick={() => handleReplyToggle(c.id)}>Reply</button>
                </div>

                {c.replies && c.replies.length > 0 && (
                  <div className="vcard-reply-list">
                    {c.replies.map(r => (
                      <div key={r.id} className="vcard-reply-item">
                        <div className="vcard-comment-top">
                          <div className="vcard-comment-avatar vcard-reply-avatar">{userInitials(r.user)}</div>
                          <div className="vcard-comment-meta">
                            <span className="vcard-comment-author">{userDisplayName(r.user)}</span>
                            {r.user?.role && <span className="vcard-comment-role">{r.user.role}</span>}
                          </div>
                          <span className="vcard-comment-time">{fmtTimestamp(r.created_at)}</span>
                        </div>
                        <p className="vcard-comment-text">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {replyTo[rowKey] === c.id && (
                  <div className="vcard-reply-input">
                    <textarea
                      className="vcard-textarea vcard-textarea-sm"
                      value={replyDrafts[c.id] || ''}
                      onChange={e => handleReplyDraftChange(c.id, e.target.value)}
                      placeholder="Write a reply..."
                      rows={2}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postReply(c.id) }}
                    />
                    <div className="vcard-reply-actions">
                      <button className="vcard-btn-cancel" onClick={() => handleReplyToggle(null)}>Cancel</button>
                      <button className="vcard-btn-post vcard-btn-post-sm" onClick={() => postReply(c.id)} disabled={!(replyDrafts[c.id] || '').trim() || posting}>Reply</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="vcard-comment-input">
          <textarea
            className="vcard-textarea"
            value={draft}
            onChange={e => handleDraftChange(e.target.value)}
            placeholder="Add a comment about this vehicle..."
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postComment() }}
          />
          <button className="vcard-btn-post" onClick={() => postComment()} disabled={!draft.trim() || posting}>
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Vehicle detail panel ── */
function VehicleDetailPanel({
  vehicles, departmentName, stateName,
  branchId, reportType,
  commentsByRow, expandedVehicle, setExpandedVehicle,
  drafts, setDrafts, replyTo, setReplyTo, replyDrafts, setReplyDrafts,
  posting, setPosting, fetchComments, currentUser, loadingComments,
}) {
  if (!vehicles || vehicles.length === 0) {
    return <div className="vehicle-empty">No vehicles found in this department.</div>
  }

  const phase = getDeptPhase(departmentName)
  const phaseMeta = PHASE_META[phase] || { color: '#94a3b8', bg: '#f8fafc', label: '' }

  return (
    <div className="vehicle-detail-panel">
      <div className="vehicle-detail-header">
        <div className="vehicle-detail-title-row">
          <span className="vehicle-detail-phase-tag" style={{ background: phaseMeta.bg, color: phaseMeta.color, borderColor: phaseMeta.color + '30' }}>
            {phaseMeta.label}
          </span>
          <h3>{departmentName}</h3>
        </div>
        <span className="vehicle-count">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="vehicle-grid">
        {vehicles.map((v, idx) => {
          const rowKey = `vehicle::${v.roNumber || idx}`
          const rowComments = commentsByRow[rowKey] || []
          const commentCount = rowComments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)
          const isExpanded = expandedVehicle === rowKey

          return (
            <div key={rowKey} className={`vehicle-card ${isExpanded ? 'vehicle-card-expanded' : ''}`}>
              <div className="vehicle-card-summary" onClick={() => {
                setExpandedVehicle(prev => prev === rowKey ? null : rowKey)
                setReplyTo({})
              }}>
                <div className="vehicle-card-left">
                  <svg className={`vehicle-card-chevron ${isExpanded ? 'chevron-open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <div className="vehicle-card-ids">
                    {v.claimId ? (
                      <a href={`https://renew-it.bubbleapps.io/console?claim=${v.claimId}&v=All-Claims`} className="vehicle-card-link" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        {v.drNumber}
                      </a>
                    ) : (
                      <span className="vehicle-card-dr">{v.drNumber}</span>
                    )}
                    <span className="vehicle-card-ro">{v.roNumber}</span>
                  </div>
                  <span className="vehicle-card-reg">{v.vehicleRegistration}</span>
                  <span className="vehicle-card-model">{v.vehicleModel}</span>
                </div>
                <div className="vehicle-card-right">
                  {v.insurance && <span className="vehicle-card-tag">{v.insurance}</span>}
                  {v.daysInDepartment != null && (
                    <span className={`vehicle-card-days ${daysColor(v.daysInDepartment)}`}>
                      {v.daysInDepartment}d
                    </span>
                  )}
                  <span className="vehicle-card-value">{fmtCurrency(v.approvedValue)}</span>
                  {commentCount > 0 && (
                    <span className="vehicle-card-comments">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {commentCount}
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <VehicleExpandedCard
                  vehicle={v}
                  departmentName={departmentName}
                  branchId={branchId}
                  reportType={reportType}
                  commentsByRow={commentsByRow}
                  currentUser={currentUser}
                  fetchComments={fetchComments}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  replyTo={replyTo}
                  setReplyTo={setReplyTo}
                  replyDrafts={replyDrafts}
                  setReplyDrafts={setReplyDrafts}
                  posting={posting}
                  setPosting={setPosting}
                  loadingComments={loadingComments}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main component ── */

export default function WipReportTable({ data, branchId, reportType }) {
  const { user: currentUser } = useAuth()
  const [commentsByRow, setCommentsByRow] = useState({})
  const [expandedDept, setExpandedDept] = useState(null)
  const [expandedVehicle, setExpandedVehicle] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [replyTo, setReplyTo] = useState({})
  const [replyDrafts, setReplyDrafts] = useState({})
  const [posting, setPosting] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  async function handleExport(format) {
    if (exporting) return
    setExportMenuOpen(false)
    setExporting(true)
    try {
      if (format === 'pdf') {
        await exportWipReportPdf(branchId)
      } else {
        await exportWipReport(branchId)
      }
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const summary = data?.wipReport?.summary
  const departmentDetails = data?.wipReport?.departmentDetails || {}
  const { title, branch, generatedAt, states = [], notes = [] } = summary || {}

  const visibleStates = useMemo(
    () => states.filter(s => VISIBLE_CATEGORIES.includes(s.state)),
    [states]
  )

  const grandTotal = useMemo(() => {
    const gt = { mainVol: 0, speed1Vol: 0, speed2Vol: 0, mainVal: 0, speed1Val: 0, speed2Val: 0 }
    for (const s of visibleStates) {
      const t = s.totals || {}
      gt.mainVol += t.mainShop?.volume || 0
      gt.speed1Vol += t.speedShop1?.volume || 0
      gt.speed2Vol += t.speedShop2?.volume || 0
      gt.mainVal += t.mainShop?.value || 0
      gt.speed1Val += t.speedShop1?.value || 0
      gt.speed2Val += t.speedShop2?.value || 0
    }
    const totalValue = gt.mainVal + gt.speed1Val + gt.speed2Val
    return {
      mainShop: { volume: gt.mainVol, value: gt.mainVal },
      speedShop1: { volume: gt.speed1Vol, value: gt.speed1Val },
      speedShop2: { volume: gt.speed2Vol, value: gt.speed2Val },
      totalValue,
      totalVolume: gt.mainVol + gt.speed1Vol + gt.speed2Vol,
    }
  }, [visibleStates])

  const vehiclesByDepartment = departmentDetails

  const fetchComments = useCallback(async () => {
    if (!branchId || !reportType) return
    setLoadingComments(true)
    try {
      const result = await rpc('get_reporting_comments', {
        p_branch_id: branchId,
        p_report_type: reportType,
      })
      const grouped = {}
      for (const c of result || []) {
        const key = c.row_key
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(c)
      }
      setCommentsByRow(grouped)
    } catch (err) {
      console.error('Failed to load comments:', err)
    } finally {
      setLoadingComments(false)
    }
  }, [branchId, reportType])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  if (!summary) return <div className="wip-no-data">No report data available.</div>

  function toggleDeptExpand(deptKey) {
    setExpandedDept(prev => prev === deptKey ? null : deptKey)
    setExpandedVehicle(null)
    setReplyTo({})
  }

  function getDeptCommentCount(deptName) {
    const vehicles = vehiclesByDepartment[deptName]?.claims || []
    let count = 0
    for (const v of vehicles) {
      const rowKey = `vehicle::${v.roNumber}`
      const comments = commentsByRow[rowKey] || []
      count += comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)
    }
    return count
  }

  return (
    <div className="wip-outer">
      <div className="wip-table-wrapper">
        {/* Report header */}
        <div className="wip-header">
          <div className="wip-header-bg" />
          <div className="wip-header-content">
            <div className="wip-header-left">
              <h1 className="wip-title">{(title || 'Work In Progress Report').replace(/renew-IT/gi, 'Renew-IT')}</h1>
              <div className="wip-meta">
                <span className="wip-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                  {(branch || '').replace(/renew-IT/gi, 'Renew-IT')}
                </span>
                <span className="wip-meta-item">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {fmtDate(generatedAt)}
                </span>
              </div>
            </div>
            {grandTotal && (
              <div className="wip-header-totals">
                <div className="wip-total-card wip-total-card-vol">
                  <div className="wip-total-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <div className="wip-total-text">
                    <span className="wip-total-num">{grandTotal.totalVolume}</span>
                    <span className="wip-total-label">Vehicles</span>
                  </div>
                </div>
                <div className="wip-total-card wip-total-card-val">
                  <div className="wip-total-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <div className="wip-total-text">
                    <span className="wip-total-num">R {fmtVal(grandTotal.totalValue)}k</span>
                    <span className="wip-total-label">Total Value</span>
                  </div>
                </div>
              </div>
            )}
            <div className="export-dropdown-wrap">
              <button className="wip-export-btn" onClick={() => setExportMenuOpen(prev => !prev)} disabled={exporting}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {exporting ? 'Exporting...' : 'Export'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {exportMenuOpen && (
                <div className="export-dropdown-menu">
                  <button className="export-dropdown-item" onClick={() => handleExport('excel')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                    Excel (.xlsx)
                  </button>
                  <button className="export-dropdown-item" onClick={() => handleExport('pdf')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                    PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="wip-table-scroll">
          <table className="wip-table">
            <thead>
              <tr className="wip-thead-top">
                <th rowSpan={2} className="th-state">STATE</th>
                <th rowSpan={2} className="th-dept">DEPARTMENT</th>
                <th colSpan={2} className="th-group th-group-main">MAIN SHOP</th>
                <th colSpan={2} className="th-group th-group-speed1">SPEED SHOP 1</th>
                <th colSpan={2} className="th-group th-group-speed2">SPEED SHOP 2</th>
                <th rowSpan={2} className="th-cumulative">CUMULATIVE<br />VALUE (R&apos;000)</th>
              </tr>
              <tr className="wip-thead-sub">
                <th className="th-vol">VOL</th>
                <th className="th-val">VALUE (R&apos;000)</th>
                <th className="th-vol">VOL</th>
                <th className="th-val">VALUE (R&apos;000)</th>
                <th className="th-vol">VOL</th>
                <th className="th-val">VALUE (R&apos;000)</th>
              </tr>
            </thead>
            <tbody>
              {visibleStates.map((stateObj, si) => {
                const depts = sortDepartments(stateObj.departments || [])
                const totals = stateObj.totals || {}
                const stateTotalValue = (totals.mainShop?.value || 0) + (totals.speedShop1?.value || 0) + (totals.speedShop2?.value || 0)

                let runningCumulative = 0
                const deptsWithCumulative = depts.map(dept => {
                  const deptValue = (dept.mainShop?.value || 0) + (dept.speedShop1?.value || 0) + (dept.speedShop2?.value || 0)
                  runningCumulative += deptValue
                  return { ...dept, sortedCumulative: runningCumulative }
                })

                return (
                  <React.Fragment key={stateObj.state}>
                    {deptsWithCumulative.map((dept, di) => {
                      const deptKey = `${stateObj.state}::${dept.department}`
                      const isExpanded = expandedDept === deptKey
                      const vehicles = vehiclesByDepartment[dept.department]?.claims || []
                      const totalVol = (dept.mainShop?.volume || 0) + (dept.speedShop1?.volume || 0) + (dept.speedShop2?.volume || 0)
                      const deptCommentCount = getDeptCommentCount(dept.department)
                      const phase = getDeptPhase(dept.department)
                      const phaseMeta = PHASE_META[phase] || { color: '#94a3b8', bg: '#f8fafc' }
                      const cumulativePct = stateTotalValue > 0 ? (dept.sortedCumulative / stateTotalValue) * 100 : 0

                      return (
                        <React.Fragment key={deptKey}>
                          <tr
                            className={`wip-row-dept wip-row-clickable ${di % 2 === 0 ? '' : 'wip-row-alt'} ${isExpanded ? 'wip-row-expanded' : ''}`}
                            onClick={() => toggleDeptExpand(deptKey)}
                          >
                            <td className="td-state">
                              {di === 0 ? stateObj.state : ''}
                            </td>
                            <td className="td-dept">
                              <div className="dept-cell">
                                <span className="dept-phase-dot" style={{ background: phaseMeta.color, boxShadow: `0 0 6px ${phaseMeta.color}40` }} />
                                <svg className={`dept-chevron ${isExpanded ? 'chevron-open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                                <span className="dept-name">{dept.department}</span>
                                {totalVol > 0 && (
                                  <span className="dept-vehicle-count" style={{ background: phaseMeta.bg, color: phaseMeta.color, borderColor: phaseMeta.color + '30' }}>{totalVol}</span>
                                )}
                                {deptCommentCount > 0 && (
                                  <span className="dept-comment-indicator" title={`${deptCommentCount} comment${deptCommentCount !== 1 ? 's' : ''}`}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    {deptCommentCount}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="td-num">{fmtVol(dept.mainShop?.volume)}</td>
                            <td className="td-num">{fmtVal(dept.mainShop?.value)}</td>
                            <td className="td-num">{fmtVol(dept.speedShop1?.volume)}</td>
                            <td className="td-num">{fmtVal(dept.speedShop1?.value)}</td>
                            <td className="td-num">{fmtVol(dept.speedShop2?.volume)}</td>
                            <td className="td-num">{fmtVal(dept.speedShop2?.value)}</td>
                            <td className="td-cumulative">
                              <div className="cumulative-cell">
                                <span className="cumulative-value">{fmtVal(dept.sortedCumulative)}</span>
                                <div className="cumulative-bar">
                                  <div className="cumulative-bar-fill" style={{ width: `${Math.min(cumulativePct, 100)}%`, background: phaseMeta.color + '30' }} />
                                </div>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="wip-detail-row">
                              <td colSpan={SUMMARY_COL_COUNT}>
                                <VehicleDetailPanel
                                  vehicles={vehicles}
                                  departmentName={dept.department}
                                  stateName={stateObj.state}
                                  branchId={branchId}
                                  reportType={reportType}
                                  commentsByRow={commentsByRow}
                                  expandedVehicle={expandedVehicle}
                                  setExpandedVehicle={setExpandedVehicle}
                                  drafts={drafts}
                                  setDrafts={setDrafts}
                                  replyTo={replyTo}
                                  setReplyTo={setReplyTo}
                                  replyDrafts={replyDrafts}
                                  setReplyDrafts={setReplyDrafts}
                                  posting={posting}
                                  setPosting={setPosting}
                                  fetchComments={fetchComments}
                                  currentUser={currentUser}
                                  loadingComments={loadingComments}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}

                    <tr className="wip-row-total">
                      <td className="td-state-total"></td>
                      <td className="td-dept-total">{stateObj.state} Total</td>
                      <td className="td-num td-total">{fmtVol(totals.mainShop?.volume)}</td>
                      <td className="td-num td-total">{fmtVal(totals.mainShop?.value)}</td>
                      <td className="td-num td-total">{fmtVol(totals.speedShop1?.volume)}</td>
                      <td className="td-num td-total">{fmtVal(totals.speedShop1?.value)}</td>
                      <td className="td-num td-total">{fmtVol(totals.speedShop2?.volume)}</td>
                      <td className="td-num td-total">{fmtVal(totals.speedShop2?.value)}</td>
                      <td className="td-num td-total"></td>
                    </tr>

                    {si < visibleStates.length - 1 && (
                      <tr className="wip-row-spacer"><td colSpan={SUMMARY_COL_COUNT} /></tr>
                    )}
                  </React.Fragment>
                )
              })}

              <tr className="wip-row-spacer"><td colSpan={SUMMARY_COL_COUNT} /></tr>

              {grandTotal && (
                <tr className="wip-row-grand-total">
                  <td className="td-grand-label" colSpan={2}>GRAND TOTAL</td>
                  <td className="td-num td-grand">{fmtVol(grandTotal.mainShop?.volume)}</td>
                  <td className="td-num td-grand">{fmtVal(grandTotal.mainShop?.value)}</td>
                  <td className="td-num td-grand">{fmtVol(grandTotal.speedShop1?.volume)}</td>
                  <td className="td-num td-grand">{fmtVal(grandTotal.speedShop1?.value)}</td>
                  <td className="td-num td-grand">{fmtVol(grandTotal.speedShop2?.volume)}</td>
                  <td className="td-num td-grand">{fmtVal(grandTotal.speedShop2?.value)}</td>
                  <td className="td-num td-grand">{grandTotal.totalValue != null ? fmtVal(grandTotal.totalValue) : ''}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {notes.length > 0 && (
          <div className="wip-notes">
            <strong>Notes:</strong>
            <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  )
}
