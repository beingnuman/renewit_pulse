import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { globalSearch, type SearchResult } from '../lib/api'
import { money } from '../lib/format'
import { Loader } from '../components/Loader'
import { IconSearch } from '../components/icons'

const statusTone = (s: string | null): string => {
  const t = (s ?? '').toLowerCase()
  if (/deliver|invoic|finalis|closed|complete|collect/.test(t)) return 'green'
  if (/cancel|not proceed|reject|decline|^99|imported/.test(t)) return 'grey'
  if (/book|^100/.test(t)) return 'blue'
  if (/wip|progress|repair|strip|panel|paint|polish|^0[2-6]/.test(t)) return 'violet'
  if (/quote|tow|drive|await|estimat|moderat|auth|^7\d|^01/.test(t)) return 'amber'
  return 'grey'
}
const agingClass = (n: number | null): string => {
  if (n == null) return 'rm-age'
  if (n >= 30) return 'rm-age red'
  if (n >= 14) return 'rm-age amber'
  return 'rm-age'
}
const shortStatus = (s: string | null): string => {
  const t = s ?? ''
  return t.length > 20 ? `${t.slice(0, 20).trim()}…` : t
}
const tdTone = (td: string): string => {
  const t = (td || '').toLowerCase()
  if (t === 't' || t === 'tow') return 'tow'
  if (t === 'd' || t === 'drive') return 'drive'
  return ''
}

const COLUMNS = [
  'DR', 'RO', 'Aging', 'DIP', 'Registration', 'Claim Status', 'Manufacture', 'CSA',
  'Insurer', 'Approved Value', 'Customer', 'Contact', 'Speedshop', 'Job Type', 'T/D',
]
const WIDTHS = ['8%', '5%', '4%', '4%', '7%', '12%', '7%', '6%', '9%', '7%', '10%', '7%', '5%', '5%', '4%']

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
          <div className="table-scroll rm-scroll">
            <table className="claims rm-table">
              <colgroup>
                {WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>
                <tr>{COLUMNS.map((c) => <th key={c} title={c}><span className="rm-th-label">{c}</span></th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const speedYes = (r.speedShop || '').toLowerCase() === 'yes'
                  return (
                    <tr key={r.claimId} className="rm-row" onClick={() => navigate(`/claim/${r.claimId}`)}>
                      <td><span className="dr-link">{r.drNumber || '—'}</span></td>
                      <td>{r.roNumber && r.roNumber !== '0' ? r.roNumber : '—'}</td>
                      <td className="r"><span className={agingClass(r.aging)}>{r.aging ?? '—'}</span></td>
                      <td className="r">{r.dip ?? '—'}</td>
                      <td title={r.registration ?? ''}>{r.registration || '—'}</td>
                      <td><span className={`rm-status ${statusTone(r.status)}`} title={r.status ?? ''}>{r.status ? shortStatus(r.status) : '—'}</span></td>
                      <td title={r.manufacturer ?? ''}>{r.manufacturer || '—'}</td>
                      <td title={r.csaName ?? ''}>{r.csaName || '—'}</td>
                      <td title={r.insurer ?? ''}>{r.insurer || '—'}</td>
                      <td className="r val">{r.approvedValue ? money(r.approvedValue) : '—'}</td>
                      <td title={r.customer ?? ''}>{r.customer || '—'}</td>
                      <td>{r.contact || '—'}</td>
                      <td><span className={`rm-ss${speedYes ? ' yes' : ''}`}>{speedYes ? 'Yes' : 'No'}</span></td>
                      <td title={r.jobType ?? ''}>{r.jobType || '—'}</td>
                      <td>{r.towDrive ? <span className={`rm-td ${tdTone(r.towDrive)}`}>{r.towDrive}</span> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
