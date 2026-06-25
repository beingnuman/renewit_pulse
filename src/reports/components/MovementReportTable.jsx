import { Fragment, useMemo } from 'react'
import './MovementReportTable.css'

/* ── Formatters ── */
function fmtAmount(val) {
  if (val == null) return ''
  const n = Number(val)
  if (isNaN(n)) return ''
  return n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })
}

function fmtMovedAt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const date = d.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const time = d.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return `${date} ${time}`
}

function fmtReportDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function towDrive(val) {
  const s = String(val || '').toUpperCase()
  if (s === 'D' || s === 'DRIVE' || s === 'DRIVE IN') return 'D'
  if (s === 'T' || s === 'TOW') return 'T'
  return s
}

function sumRows(rows, key) {
  return (rows || []).reduce((acc, r) => acc + (Number(r[key]) || 0), 0)
}

export default function MovementReportTable({ data, branchName, reportDate }) {
  const groups = useMemo(() => data?.groups || [], [data])

  const { grandInvoiced, grandApproved, movementCount } = useMemo(() => {
    let invoiced = 0
    let approved = 0
    let count = 0
    for (const g of groups) {
      invoiced += Number(g.totalInvoiced ?? sumRows(g.rows, 'invoiced')) || 0
      approved += Number(g.totalApproved ?? sumRows(g.rows, 'approved')) || 0
      count += (g.rows || []).length
    }
    return {
      grandInvoiced: data?.grandTotalInvoiced ?? invoiced,
      grandApproved: data?.grandTotalApproved ?? approved,
      movementCount: count,
    }
  }, [groups, data])

  return (
    <div className="mv-outer">
      <div className="mv-table-wrapper">
        <div className="mv-header">
          <div className="mv-header-bg" />
          <div className="mv-header-content">
            <div className="mv-header-left">
              <h2 className="mv-title">Daily Movement Report</h2>
              <div className="mv-meta">
                {branchName && <span className="mv-meta-item">{branchName}</span>}
                {reportDate && <span className="mv-meta-item">{fmtReportDate(reportDate)}</span>}
                <span className="mv-meta-item">{movementCount} movements</span>
              </div>
            </div>
            <div className="mv-header-totals">
              <div className="mv-total-card">
                <span className="mv-total-label">Invoiced</span>
                <span className="mv-total-value">{fmtAmount(grandInvoiced)}</span>
              </div>
              <div className="mv-total-card">
                <span className="mv-total-label">Approved</span>
                <span className="mv-total-value">{fmtAmount(grandApproved)}</span>
              </div>
            </div>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="mv-no-data">No movements recorded for this day.</div>
        ) : (
          <div className="mv-scroll">
            <table className="mv-table">
              <thead>
                <tr>
                  <th className="mv-col-date">Date</th>
                  <th className="mv-col-user">User</th>
                  <th className="mv-col-td">Tow / Drive</th>
                  <th className="mv-col-ro">RO No</th>
                  <th className="mv-col-shop">Shop</th>
                  <th className="mv-col-reg">Vehicle Reg</th>
                  <th className="mv-col-amt">Count</th>
                  <th className="mv-col-amt">Invoiced</th>
                  <th className="mv-col-amt">Approved</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g, gi) => {
                  const totalInvoiced = Number(g.totalInvoiced ?? sumRows(g.rows, 'invoiced')) || 0
                  const totalApproved = Number(g.totalApproved ?? sumRows(g.rows, 'approved')) || 0
                  return (
                    <Fragment key={g.from || gi}>
                      <tr className="mv-group-row">
                        <td className="mv-group-name" colSpan={9}>{g.from}</td>
                      </tr>
                      {(g.rows || []).map((r, i) => {
                        const td = towDrive(r.towDrive)
                        return (
                          <tr key={i} className="mv-row">
                            <td className="mv-col-date">{fmtMovedAt(r.date)}</td>
                            <td className="mv-col-user">{r.user}</td>
                            <td className="mv-col-td">
                              {td && <span className={`mv-badge mv-badge-${td.toLowerCase()}`}>{td}</span>}
                            </td>
                            <td className="mv-col-ro">{r.roNo}</td>
                            <td className="mv-col-shop">{r.shop}</td>
                            <td className="mv-col-reg">{r.vehicleReg}</td>
                            <td className="mv-col-amt" />
                            <td className="mv-col-amt mv-amt">{fmtAmount(r.invoiced)}</td>
                            <td className="mv-col-amt mv-amt">{fmtAmount(r.approved)}</td>
                          </tr>
                        )
                      })}
                      <tr className="mv-subtotal-row">
                        <td className="mv-subtotal-label" colSpan={6}>Total</td>
                        <td className="mv-col-amt mv-amt">{(g.rows || []).length}</td>
                        <td className="mv-col-amt mv-amt">{fmtAmount(totalInvoiced)}</td>
                        <td className="mv-col-amt mv-amt">{fmtAmount(totalApproved)}</td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="mv-grand-row">
                  <td className="mv-grand-label" colSpan={6}>Grand Total</td>
                  <td className="mv-col-amt mv-amt">{movementCount}</td>
                  <td className="mv-col-amt mv-amt">{fmtAmount(grandInvoiced)}</td>
                  <td className="mv-col-amt mv-amt">{fmtAmount(grandApproved)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
