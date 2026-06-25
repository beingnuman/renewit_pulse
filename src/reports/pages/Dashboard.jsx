import { useState, useEffect, useRef } from 'react'
import { rpc } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import './Dashboard.css'

const BUBBLE_URL = 'https://renew-it.bubbleapps.io/console'

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

function overdueLabel(mins) {
  if (mins == null) return ''
  const m = Math.round(mins)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, color }) {
  return (
    <div className={`dash-stat dash-stat-${color}`}>
      <div className="dash-stat-value">{value ?? '-'}</div>
      <div className="dash-stat-label">{label}</div>
      {sub && <div className="dash-stat-sub">{sub}</div>}
    </div>
  )
}

/* ─── Department heatmap ─── */
function DeptHeatmap({ stats }) {
  if (!stats || stats.length === 0) return null
  const maxMissed = Math.max(...stats.map(s => s.missed), 1)

  return (
    <div className="dash-section">
      <h3 className="dash-section-title">Department Heatmap</h3>
      <div className="dash-heatmap">
        {stats.map(s => {
          const intensity = s.missed / maxMissed
          const bg = s.missed === 0
            ? '#d1fae5'
            : `rgba(220, 38, 38, ${0.1 + intensity * 0.5})`
          const textColor = intensity > 0.5 ? '#fff' : '#1e293b'
          return (
            <div key={s.department} className="dash-heat-cell" style={{ background: bg, color: textColor }}>
              <div className="dash-heat-dept">{s.department}</div>
              <div className="dash-heat-numbers">
                <span className="dash-heat-completed">{s.completed} done</span>
                <span className="dash-heat-missed">{s.missed} missed</span>
                <span className="dash-heat-pending">{s.pending} pending</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Person accountability ─── */
function PersonStats({ stats }) {
  if (!stats || stats.length === 0) return null
  return (
    <div className="dash-section">
      <h3 className="dash-section-title">Person Accountability</h3>
      <div className="dash-person-list">
        {stats.map((p, i) => {
          const rate = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
          return (
            <div key={p.personId || i} className="dash-person-row">
              <div className="dash-person-name">{p.personName}</div>
              <div className="dash-person-bar-wrap">
                <div className="dash-person-bar" style={{ width: `${rate}%` }} />
              </div>
              <div className="dash-person-stats">
                <span className="dash-p-completed">{p.completed}</span>
                <span className="dash-p-sep">/</span>
                <span className="dash-p-total">{p.total}</span>
                {p.missed > 0 && <span className="dash-p-missed">({p.missed} missed)</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Overdue vehicles list ─── */
function OverdueList({ vehicles }) {
  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="dash-section">
        <h3 className="dash-section-title">Overdue Vehicles</h3>
        <div className="dash-empty">No overdue vehicles right now.</div>
      </div>
    )
  }
  return (
    <div className="dash-section">
      <h3 className="dash-section-title">
        Overdue Vehicles
        <span className="dash-overdue-count">{vehicles.length}</span>
      </h3>
      <div className="dash-overdue-scroll">
        <table className="dash-overdue-table">
          <thead>
            <tr>
              <th>RO #</th>
              <th>From</th>
              <th>To</th>
              <th>Committed</th>
              <th>Overdue</th>
              <th>Responsible</th>
              <th>Set By</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v, i) => (
              <tr key={v.id} className={i % 2 === 1 ? 'dash-row-alt' : ''}>
                <td className="dash-td-ro">
                  {v.claimId ? (
                    <a href={`${BUBBLE_URL}?claim=${v.claimId}&v=All-Claims`} target="_blank" rel="noopener noreferrer" className="dash-ro-link">
                      {v.roNumber}
                    </a>
                  ) : v.roNumber}
                </td>
                <td>{v.fromDepartment}</td>
                <td className="dash-td-to">{v.toDepartment}</td>
                <td className="dash-td-time">{fmtDateTime(v.committedDatetime)}</td>
                <td className="dash-td-overdue">
                  <span className="dash-overdue-badge">{overdueLabel(v.overdueMinutes)}</span>
                </td>
                <td className="dash-td-person">{v.responsiblePersonName || '-'}</td>
                <td className="dash-td-by">{v.committedByName}</td>
                <td className="dash-td-notes">{v.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Main Dashboard ─── */
export default function Dashboard({ branchOverride, embedded }) {
  // Real branches from Pulse's auth (same source as the global switcher).
  const { branches, currentBranchId } = useAuth()
  const [ownBranch, setOwnBranch] = useState(null)
  const selectedBranch = branchOverride || ownBranch
  const setSelectedBranch = branchOverride ? () => {} : setOwnBranch
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // When used standalone (not embedded in Reports), default to the global
  // switcher's branch, else the first branch, once branches have loaded.
  useEffect(() => {
    if (branchOverride || ownBranch || branches.length === 0) return
    const match = branches.find(b => b.id === currentBranchId)
    setOwnBranch(match || branches[0])
  }, [branches, currentBranchId, ownBranch, branchOverride])

  async function fetchDashboard() {
    if (!selectedBranch) return
    setLoading(true)
    setError(null)
    try {
      const result = await rpc('get_commitment_dashboard', {
        p_branch_id: selectedBranch.id,
        p_date: selectedDate,
      })
      if (result?.success) {
        setData(result)
      } else {
        setError(result?.error || 'Failed to load dashboard')
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [selectedBranch?.id, selectedDate])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchDashboard, 120000)
    return () => clearInterval(interval)
  }, [selectedBranch?.id, selectedDate])

  const summary = data?.summary
  const isToday = selectedDate === new Date().toISOString().slice(0, 10)

  return (
    <div className={`dash-page ${embedded ? 'dash-embedded' : ''}`}>
      <div className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-page-title">Commitments Dashboard</h1>
          {!embedded && <span className="dash-rbranch-name">{selectedBranch?.name}</span>}
        </div>
        <div className="dash-header-controls">
          {!embedded && (
            <select
              className="dash-select"
              value={selectedBranch?.id || ''}
              onChange={e => setSelectedBranch(branches.find(b => b.id === e.target.value))}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            className="dash-date-input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          <button className="dash-btn-refresh" onClick={fetchDashboard} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="dash-error">{error}</div>}

      {/* Summary stats */}
      <div className="dash-stats-grid">
        <StatCard label="Total Commitments" value={summary?.total} color="blue" />
        <StatCard label="Completed" value={summary?.completed} color="green" sub={summary?.completionRate != null ? `${summary.completionRate}% rate` : null} />
        <StatCard label="Missed" value={summary?.missed} color="red" />
        <StatCard label="Pending" value={summary?.pending} color="amber" sub={isToday ? 'Still active' : null} />
      </div>

      {/* Overdue vehicles */}
      <OverdueList vehicles={data?.overdueVehicles} />

      {/* Department heatmap + Person stats side by side */}
      <div className="dash-two-col">
        <DeptHeatmap stats={data?.departmentStats} />
        <PersonStats stats={data?.personStats} />
      </div>
    </div>
  )
}
