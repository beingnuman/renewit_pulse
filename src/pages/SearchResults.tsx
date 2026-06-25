import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { globalSearch, type SearchResult } from '../lib/api'
import { Loader } from '../components/Loader'
import { IconSearch } from '../components/icons'

export function SearchResults() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { branchId } = useAuth()
  const q = params.get('q') ?? ''
  const [rows, setRows] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const r = await globalSearch(q, branchId, 100, 0)
        if (on) setRows(r)
      } catch {
        if (on) setRows([])
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [q, branchId])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Search results</h1>
          <div className="muted">{loading ? 'Searching…' : `${rows.length} result${rows.length === 1 ? '' : 's'} for “${q}”`}</div>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <Loader label="Searching…" />
        ) : rows.length === 0 ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconSearch size={20} /></span>No claims match “{q}”.</div>
        ) : (
          <table className="admin-table fixed">
            <colgroup>
              <col style={{ width: '12%' }} /><col style={{ width: '22%' }} /><col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} /><col style={{ width: '20%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr><th>DR Number</th><th>Customer</th><th>Vehicle Reg</th><th>Make</th><th>Status</th><th>CSA</th><th>Aging</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.claimId} className="row-clickable" onClick={() => navigate(`/claim/${r.claimId}`)}>
                  <td><span className="cell-name">{r.drNumber || '—'}</span></td>
                  <td title={r.customer ?? ''}>{r.customer || '—'}</td>
                  <td>{r.registration || '—'}</td>
                  <td>{r.manufacturer || '—'}</td>
                  <td title={r.status ?? ''}>{r.status || '—'}</td>
                  <td>{r.csaName || '—'}</td>
                  <td>{r.aging != null ? `${r.aging}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
