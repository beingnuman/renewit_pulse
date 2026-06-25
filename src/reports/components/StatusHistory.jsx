import { useState, useEffect } from 'react'
import { rpc } from '../lib/supabase'
import './StatusHistory.css'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

function timeBetween(iso1, iso2) {
  if (!iso1 || !iso2) return null
  const ms = new Date(iso1).getTime() - new Date(iso2).getTime()
  const mins = Math.abs(Math.floor(ms / 60000))
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  const remHrs = hrs % 24
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`
}

function statusColor(status) {
  if (!status) return 'grey'
  if (status.startsWith('99-') || status.startsWith('100-')) return 'slate'
  if (status.startsWith('00-')) return 'sky'
  if (status.startsWith('01-Preliminary') || status.startsWith('01-Moderation') || status.startsWith('01-Speedbump')) return 'amber'
  if (status.startsWith('01-Converted')) return 'blue'
  if (status.startsWith('02-')) return 'indigo'
  if (status.startsWith('03-')) return 'orange'
  if (status.startsWith('04-')) return 'purple'
  if (status.startsWith('05-')) return 'teal'
  if (status.startsWith('06-')) return 'emerald'
  if (status.startsWith('07-')) return 'green'
  if (status.startsWith('08-')) return 'lime'
  if (status.startsWith('09-')) return 'cyan'
  if (status.startsWith('70-') || status.startsWith('71-') || status.startsWith('75-')) return 'rose'
  if (status.startsWith('98-')) return 'red'
  return 'grey'
}

function cleanStatusName(status) {
  if (!status) return ''
  return status.replace(/^\d+-\s*/, '')
}

export default function StatusHistory({ claimId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!claimId) return
    let cancelled = false

    async function load() {
      try {
        const result = await rpc('get_claim_status_history', { p_claim_id: claimId })
        if (!cancelled && result?.success) {
          setHistory(result.history || [])
        }
      } catch (err) {
        console.error('Failed to fetch status history:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [claimId])

  if (loading) {
    return (
      <div className="sh-container">
        <div className="sh-loading">Loading status history...</div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="sh-container">
        <div className="sh-bar">
          <div className="sh-bar-left">
            <svg className="sh-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <h4 className="sh-bar-title">Status History</h4>
          </div>
          <span className="sh-empty-label">No history available</span>
        </div>
      </div>
    )
  }

  const displayItems = expanded ? history : history.slice(0, 8)
  const hasMore = history.length > 8

  return (
    <div className="sh-container">
      {/* Header bar */}
      <div className="sh-bar">
        <div className="sh-bar-left">
          <svg className="sh-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <h4 className="sh-bar-title">Status History</h4>
          <span className="sh-count-badge">{history.length} changes</span>
        </div>
        {hasMore && (
          <button className="sh-toggle-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : `Show all ${history.length}`}
            <svg className={`sh-chevron ${expanded ? 'sh-chevron-up' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        )}
      </div>

      {/* Horizontal timeline */}
      <div className="sh-h-scroll">
        <div className="sh-h-timeline">
          {displayItems.map((h, i) => {
            const color = statusColor(h.newStatus)
            const duration = i < displayItems.length - 1 ? timeBetween(h.createdAt, displayItems[i + 1].createdAt) : null
            const isFirst = i === 0
            const isLast = i === displayItems.length - 1

            return (
              <div key={h.id} className={`sh-h-item ${isFirst ? 'sh-h-item-first' : ''} ${isLast ? 'sh-h-item-last' : ''}`}>
                {/* Top: status badge */}
                <div className={`sh-h-badge sh-badge-${color}`}>
                  {cleanStatusName(h.newStatus)}
                </div>

                {/* Middle: dot + line */}
                <div className="sh-h-track">
                  {!isFirst && <div className="sh-h-line sh-h-line-before" />}
                  <div className={`sh-h-dot sh-dot-${color}`} />
                  {!isLast && (
                    <div className="sh-h-line sh-h-line-after">
                      {duration && <span className="sh-h-duration">{duration}</span>}
                    </div>
                  )}
                </div>

                {/* Bottom: time + date + meta */}
                <div className="sh-h-meta">
                  <span className="sh-h-time">{fmtTime(h.createdAt)}</span>
                  <span className="sh-h-date">{fmtDate(h.createdAt)}</span>
                  {h.changedByName && <span className="sh-h-by">{h.changedByName}</span>}
                </div>
              </div>
            )
          })}

          {!expanded && hasMore && (
            <div className="sh-h-more" onClick={() => setExpanded(true)}>
              <div className="sh-h-more-dot">+{history.length - 8}</div>
              <span className="sh-h-more-text">more</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
