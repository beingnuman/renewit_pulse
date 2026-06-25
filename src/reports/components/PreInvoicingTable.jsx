import './PreInvoicingTable.css'

function fmtRand(n) {
  if (n == null) return '—'
  return 'R ' + Math.round(Number(n)).toLocaleString('en-ZA')
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Pre-invoicing exception list: jobs invoiced on TMS but never progressed through the
// Online workflow (status not invoiced/closed). These are the compliance exceptions
// the report exists to surface and stop.
export default function PreInvoicingTable({ data, branchName }) {
  const rows = data?.rows || []

  return (
    <div className="pi-card">
      <div className="pi-head">
        <div>
          <h2 className="pi-title">Pre-Invoicing Exceptions</h2>
          <div className="pi-subtitle">
            Jobs invoiced on TMS but not progressed in Online (no <code>09-Invoiced</code> status)
          </div>
        </div>
        <div className="pi-stats">
          <div className="pi-stat">
            <span className="pi-stat-num">{data?.count ?? 0}</span>
            <span className="pi-stat-label">Open jobs</span>
          </div>
          <div className="pi-stat">
            <span className="pi-stat-num">{fmtRand(data?.totalValue)}</span>
            <span className="pi-stat-label">Approved value</span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="pi-empty">No pre-invoicing exceptions for {branchName || 'this branch'}. 🎉</div>
      ) : (
        <div className="pi-table-wrap">
          <table className="pi-table">
            <thead>
              <tr>
                <th>RO No</th>
                <th>Registration</th>
                <th>Current Status</th>
                <th className="pi-num">TMS Invoiced</th>
                <th className="pi-num">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.ro_number}-${i}`}>
                  <td>{r.ro_number || '—'}</td>
                  <td>{r.registration || '—'}</td>
                  <td><span className="pi-status">{r.status}</span></td>
                  <td className="pi-num">{fmtDate(r.tms_inv_date)}</td>
                  <td className="pi-num">{fmtRand(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
