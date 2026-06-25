import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { getChDashboardClaims, getClaimsByStatus, type ClaimRow } from '../lib/api'
import { money } from '../lib/format'
import { Loader } from '../components/Loader'

const COLUMNS = [
  'DR Number', 'RO Number', 'Aging', 'DIP', 'Registration', 'Claim Status',
  'Manufacturer', 'CSA', 'Insurer', 'Approved Value', 'Customer', 'Contact', 'Speed Shop', 'T/D',
]

export function ClaimsView({ mode }: { mode: 'kpi' | 'status' }) {
  const { filterType, statusName } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { branchId } = useAuth()

  const key = mode === 'kpi' ? filterType : statusName
  const title = search.get('label') || statusName || filterType || 'Claims'

  const [rows, setRows] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!key) return
      setLoading(true)
      setError(null)
      setPage(1)
      try {
        const data =
          mode === 'kpi'
            ? await getChDashboardClaims(key, branchId)
            : await getClaimsByStatus(key, branchId)
        if (active) setRows(data)
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load claims')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [mode, key, branchId])

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)

  const downloadCsv = useMemo(
    () => () => {
      const header = COLUMNS.join(',')
      const body = rows
        .map((c) =>
          [c.dr, c.ro, c.aging ?? '', c.dip ?? '', c.registration, c.status, c.manufacturer,
           c.csa, c.insurer, c.approvedValue, c.customer, c.contact, c.speedShop, c.td]
            .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n')
      const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.csv`
      a.click()
      URL.revokeObjectURL(url)
    },
    [rows, title],
  )

  return (
    <div className="page">
      <div className="list-head">
        <button className="back-btn" onClick={() => navigate('/dashboard')} aria-label="Back">←</button>
        <div className="list-title">
          <span className="dot" />
          <h1>{title}</h1>
        </div>
        <div className="legend">
          <span className="chip">Warranty <span className="swatch" style={{ background: 'var(--warranty)' }} /></span>
          <span className="chip">Upsell <span className="swatch" style={{ background: 'var(--upsell)' }} /></span>
          <button className="csv-btn" onClick={downloadCsv} disabled={rows.length === 0}>⬇ Download CSV</button>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <Loader label="Loading claims…" />
        ) : error ? (
          <div className="login-error">Couldn’t load claims: {error}</div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="claims claims-fit">
                <colgroup>
                  {['7%','6%','5%','4%','9%','12%','9%','7%','8%','8%','9%','8%','4%','4%'].map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>{COLUMNS.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td className="empty" colSpan={COLUMNS.length}>No claims for this metric.</td></tr>
                  )}
                  {pageRows.map((c) => (
                    <tr key={c.id} className={c.warranty ? 'warranty' : c.upsell ? 'upsell' : ''}>
                      <td><button className="dr-link" onClick={() => navigate(`/claim/${c.id}`)}>{c.dr}</button></td>
                      <td>{c.ro}</td>
                      <td>{c.aging ?? '—'}</td>
                      <td>{c.dip ?? '—'}</td>
                      <td>{c.registration}</td>
                      <td><span className="status-pill">{c.status}</span></td>
                      <td>{c.manufacturer}</td>
                      <td>{c.csa || 'None'}</td>
                      <td>{c.insurer}</td>
                      <td className="val">{c.approvedValue ? money(c.approvedValue) : 'R0'}</td>
                      <td>{c.customer}</td>
                      <td>{c.contact}</td>
                      <td>{c.speedShop || 'No'}</td>
                      <td>{c.td}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="list-foot">
              <span>
                {total === 0
                  ? '0 claims'
                  : `Showing ${start + 1}–${Math.min(start + pageSize, total)} of ${total}`}
              </span>
              {total > 0 && (
                <div className="pager">
                  <label className="page-size">
                    Rows
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                      {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <div className="pager-btns">
                    <button onClick={() => setPage(1)} disabled={current === 1} aria-label="First">«</button>
                    <button onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous">‹</button>
                    <span className="pager-info">Page {current} of {totalPages}</span>
                    <button onClick={() => setPage(current + 1)} disabled={current === totalPages} aria-label="Next">›</button>
                    <button onClick={() => setPage(totalPages)} disabled={current === totalPages} aria-label="Last">»</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
