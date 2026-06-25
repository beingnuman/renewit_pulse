import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { CLAIMS, STATUSES, ZAR, type Claim } from '../data/claims'

type SortKey = 'aging' | 'dip' | 'drNumber'

const COLUMNS: { key: keyof Claim; label: string; sortable?: SortKey }[] = [
  { key: 'drNumber', label: 'DR Number' },
  { key: 'roNumber', label: 'RO Number' },
  { key: 'aging', label: 'Aging', sortable: 'aging' },
  { key: 'dip', label: 'DIP', sortable: 'dip' },
  { key: 'registration', label: 'Registration' },
  { key: 'status', label: 'Claim Status' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'csa', label: 'CSA' },
  { key: 'insurer', label: 'Insurer' },
  { key: 'approvedValue', label: 'Approved Value' },
  { key: 'customer', label: 'Customer' },
  { key: 'contact', label: 'Contact' },
  { key: 'speedShop', label: 'Speed Shop' },
  { key: 'td', label: 'T/D' },
]

export function ClaimsList() {
  const { status } = useParams()
  const navigate = useNavigate()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)

  const def = STATUSES.find((s) => s.code === status)
  const title = def ? def.code : 'All Claims'

  const rows = useMemo(() => {
    let r = status ? CLAIMS.filter((c) => c.status === status) : [...CLAIMS]
    if (sort) {
      r = [...r].sort((a, b) => {
        const av = a[sort.key]
        const bv = b[sort.key]
        const n = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
        return n * sort.dir
      })
    }
    return r
  }, [status, sort])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))

  const downloadCsv = () => {
    const header = COLUMNS.map((c) => c.label).join(',')
    const body = rows
      .map((c) =>
        COLUMNS.map((col) => {
          const v = c[col.key]
          const s = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? '')
          return `"${s.replace(/"/g, '""')}"`
        }).join(','),
      )
      .join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <div className="list-head">
        <button className="back-btn" onClick={() => navigate('/dashboard')} aria-label="Back">
          ←
        </button>
        <div className="list-title">
          <span className="dot" style={def ? { background: def.accent } : undefined} />
          <h1>{title}</h1>
        </div>

        <div className="legend">
          <span className="chip">
            Warranty <span className="swatch" style={{ background: 'var(--warranty)' }} />
          </span>
          <span className="chip">
            Upsell <span className="swatch" style={{ background: 'var(--upsell)' }} />
          </span>
          <button className="csv-btn" onClick={downloadCsv}>
            ⬇ Download CSV
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="claims">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={String(col.key)}
                    className={col.sortable ? 'sortable' : ''}
                    onClick={col.sortable ? () => toggleSort(col.sortable!) : undefined}
                  >
                    {col.label}
                    {col.sortable && (
                      <span className="arrow">
                        {sort?.key === col.sortable ? (sort.dir === 1 ? '▲' : '▼') : '▲'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="empty" colSpan={COLUMNS.length}>
                    No claims in this status.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.drNumber} className={c.warranty ? 'warranty' : c.upsell ? 'upsell' : ''}>
                  <td>
                    <Link className="dr-link" to={`/claims/${c.status}`}>
                      {c.drNumber}
                    </Link>
                  </td>
                  <td>{c.roNumber}</td>
                  <td>{c.aging}</td>
                  <td>{c.dip}</td>
                  <td>{c.registration}</td>
                  <td>
                    <span className="status-pill">{c.status}</span>
                  </td>
                  <td>{c.manufacturer}</td>
                  <td>{c.csa}</td>
                  <td>{c.insurer}</td>
                  <td className="val">{c.approvedValue ? ZAR.format(c.approvedValue) : 'R0'}</td>
                  <td>{c.customer}</td>
                  <td>{c.contact}</td>
                  <td>{c.speedShop ? 'Yes' : 'No'}</td>
                  <td>{c.td}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="list-foot">
          <span>{rows.length} claims</span>
          <span>renew-IT Rivonia</span>
        </div>
      </div>
    </div>
  )
}
