import { useState, useMemo } from 'react'
import './ConversionsPerInsurerTable.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 'YYYYMM' -> 'Mon YYYY'
function fmtPeriod(p) {
  if (!p || p.length !== 6) return p || '—'
  const y = p.slice(0, 4)
  const m = Number(p.slice(4, 6))
  return `${MONTHS[m - 1] || p.slice(4, 6)} ${y}`
}
function fmtRand(n) {
  if (n == null) return '—'
  return 'R ' + Math.round(Number(n)).toLocaleString('en-ZA')
}
function fmtInt(n) {
  return Number(n || 0).toLocaleString('en-ZA')
}

// Conversions Per Insurer — Pulse-native re-write of the SSRS report. Grouped by
// month (newest first), insurers within (most conversions first), showing Units +
// Approved value, matching the SSRS layout (Period → Insurer → Approved, Units).
export default function ConversionsPerInsurerTable({ data, branchName }) {
  const rows = useMemo(() => data?.rows || [], [data])

  // distinct periods, newest first
  const periods = useMemo(() => {
    const seen = []
    const set = new Set()
    for (const r of rows) {
      if (!set.has(r.period)) { set.add(r.period); seen.push(r.period) }
    }
    return seen.sort((a, b) => (a < b ? 1 : -1))
  }, [rows])

  const [period, setPeriod] = useState('all')
  // Fall back to "all" if the selected month is no longer present (e.g. data changed).
  const activePeriod = period !== 'all' && !periods.includes(period) ? 'all' : period

  // group rows by period (filtered to selection), insurers sorted by units desc
  const groups = useMemo(() => {
    const scope = activePeriod === 'all' ? periods : periods.filter((p) => p === activePeriod)
    return scope.map((p) => {
      const insurers = rows
        .filter((r) => r.period === p)
        .sort((a, b) => Number(b.units) - Number(a.units))
      const units = insurers.reduce((s, r) => s + Number(r.units), 0)
      const approved = insurers.reduce((s, r) => s + Number(r.approved), 0)
      return { period: p, insurers, units, approved }
    })
  }, [rows, periods, activePeriod])

  const scopeUnits = groups.reduce((s, g) => s + g.units, 0)
  const scopeApproved = groups.reduce((s, g) => s + g.approved, 0)

  return (
    <div className="cpi-card">
      <div className="cpi-head">
        <div>
          <h2 className="cpi-title">Conversions Per Insurer</h2>
          <div className="cpi-subtitle">
            Jobs converted (01-Converted) by insurer, grouped by month
            {branchName ? <> — <strong>{branchName}</strong></> : null}
          </div>
        </div>
        <div className="cpi-stats">
          <div className="cpi-stat">
            <span className="cpi-stat-num">{fmtInt(scopeUnits)}</span>
            <span className="cpi-stat-label">Units</span>
          </div>
          <div className="cpi-stat">
            <span className="cpi-stat-num">{fmtRand(scopeApproved)}</span>
            <span className="cpi-stat-label">Approved</span>
          </div>
        </div>
      </div>

      <div className="cpi-toolbar">
        <span className="cpi-toolbar-label">Period</span>
        <select className="cpi-select" value={activePeriod} onChange={(e) => setPeriod(e.target.value)}>
          <option value="all">All months ({periods.length})</option>
          {periods.map((p) => (
            <option key={p} value={p}>{fmtPeriod(p)}</option>
          ))}
        </select>
      </div>

      {groups.length === 0 ? (
        <div className="cpi-empty">No conversions for {branchName || 'this branch'}.</div>
      ) : (
        <div className="cpi-table-wrap">
          <table className="cpi-table">
            <thead>
              <tr>
                <th>Insurer</th>
                <th className="cpi-num">Units</th>
                <th className="cpi-num">Approved</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.period}>
                <tr className="cpi-grp">
                  <td>{fmtPeriod(g.period)}</td>
                  <td className="cpi-num">{fmtInt(g.units)}</td>
                  <td className="cpi-num">{fmtRand(g.approved)}</td>
                </tr>
                {g.insurers.map((r) => (
                  <tr key={g.period + (r.insurer || '')}>
                    <td className="cpi-insurer">{r.insurer || '(Unmapped)'}</td>
                    <td className="cpi-num">{fmtInt(r.units)}</td>
                    <td className="cpi-num">{fmtRand(r.approved)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  )
}
