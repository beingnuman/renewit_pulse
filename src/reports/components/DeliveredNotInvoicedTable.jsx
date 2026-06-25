import { useState, useEffect } from 'react'
import './DeliveredNotInvoicedTable.css'
import { getDeliveredNotInvoiced } from '../lib/deliveredNotInvoiced'
import { exportDeliveredNotInvoicedExcel, exportDeliveredNotInvoicedPdf } from '../lib/exports/reportExports'

const THRESHOLDS = [
  { days: 0, label: 'All' },
  { days: 30, label: '30d+' },
  { days: 60, label: '60d+' },
  { days: 90, label: '90d+' },
]

// Approved column — 2 decimals, no symbol (matches the SSRS "all days" report).
function fmtNum(n) {
  if (n == null) return ''
  const v = Number(n)
  if (isNaN(v)) return ''
  return v.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
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
function agingClass(days) {
  if (days == null) return ''
  if (days > 90) return 'dni-age-crit'
  if (days > 60) return 'dni-age-high'
  if (days > 30) return 'dni-age-warn'
  return 'dni-age-ok'
}

// Delivered Not yet Invoiced — Pulse-native re-write of the SSRS "Delivered Not yet
// Invoiced all days" report (05.Invoicing). Columns/order/value match the SSRS report.
export default function DeliveredNotInvoicedTable({ data, branchId, branchName }) {
  const [view, setView] = useState(data)
  const [minAge, setMinAge] = useState(data?.minAgeDays ?? 0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [exporting, setExporting] = useState(null) // 'xlsx' | 'pdf' | null

  useEffect(() => {
    setView(data)
    setMinAge(data?.minAgeDays ?? 0)
    setErr(null)
  }, [data])

  async function changeThreshold(days) {
    if (days === minAge || busy) return
    setBusy(true)
    setErr(null)
    try {
      const next = await getDeliveredNotInvoiced(branchId, days)
      setView(next)
      setMinAge(days)
    } catch (e) {
      setErr(e?.message || 'Failed to load')
    } finally {
      setBusy(false)
    }
  }

  const rows = view?.rows || []

  function reportForExport() {
    return {
      rows,
      count: view?.count ?? rows.length,
      totalValue: view?.totalValue ?? 0,
      branchName: branchName || '',
      minAgeDays: minAge,
      generatedAt: new Date().toISOString(),
    }
  }

  async function doExport(kind) {
    if (exporting) return
    setExporting(kind)
    setErr(null)
    try {
      const report = reportForExport()
      if (kind === 'xlsx') await exportDeliveredNotInvoicedExcel(report)
      else await exportDeliveredNotInvoicedPdf(report)
    } catch (e) {
      setErr(e?.message || 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="dni-card">
      <div className="dni-head">
        <div>
          <h2 className="dni-title">Delivered — Not yet Invoiced</h2>
          <div className="dni-subtitle">
            {minAge > 0
              ? <>Delivered jobs aged over <strong>{minAge} days</strong>, not yet invoiced</>
              : <>All delivered jobs not yet invoiced (SSRS “all days”)</>}
          </div>
        </div>
        {/* Summary (matches the SSRS Summary block: Units + Value) */}
        <div className="dni-stats">
          <div className="dni-stat">
            <span className="dni-stat-num">{view?.count ?? 0}</span>
            <span className="dni-stat-label">Units</span>
          </div>
          <div className="dni-stat">
            <span className="dni-stat-num">{fmtRand(view?.totalValue)}</span>
            <span className="dni-stat-label">Value</span>
          </div>
        </div>
      </div>

      <div className="dni-toolbar">
        <span className="dni-toolbar-label">Aging</span>
        <div className="dni-threshold">
          {THRESHOLDS.map((t) => (
            <button
              key={t.days}
              className={`dni-th-btn ${minAge === t.days ? 'active' : ''}`}
              onClick={() => changeThreshold(t.days)}
              disabled={busy}
            >
              {t.label}
            </button>
          ))}
        </div>
        {busy && <span className="dni-busy">Loading…</span>}
        {err && <span className="dni-err">{err}</span>}
        <div className="dni-export">
          <button
            type="button"
            className="dni-export-btn"
            onClick={() => doExport('xlsx')}
            disabled={!!exporting || rows.length === 0}
            title="Download as Excel (SSRS layout)"
          >
            {exporting === 'xlsx' ? 'Exporting…' : 'Excel'}
          </button>
          <button
            type="button"
            className="dni-export-btn"
            onClick={() => doExport('pdf')}
            disabled={!!exporting || rows.length === 0}
            title="Open print view to save as PDF"
          >
            {exporting === 'pdf' ? 'Opening…' : 'PDF'}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="dni-empty">
          {minAge > 0
            ? <>No delivered jobs aged over {minAge} days for {branchName || 'this branch'}. 🎉</>
            : <>No delivered, not-yet-invoiced jobs for {branchName || 'this branch'}. 🎉</>}
        </div>
      ) : (
        <div className="dni-table-wrap">
          <table className="dni-table">
            <thead>
              <tr>
                <th>RO No</th>
                <th>Dr No</th>
                <th>Status</th>
                <th className="dni-num">Approved</th>
                <th className="dni-num">Aging</th>
                <th className="dni-num">Invoiced TMS Date</th>
                <th>Insurer</th>
                <th>Vehicle Reg</th>
                <th>Last Comment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.claim_id || `${r.ro_number}-${r.dr_number}`}>
                  <td>{r.ro_number || '—'}</td>
                  <td>{r.dr_number || '—'}</td>
                  <td><span className="dni-status">{r.status}</span></td>
                  <td className="dni-num">{fmtNum(r.value)}</td>
                  <td className="dni-num">
                    <span className={`dni-age ${agingClass(r.aging_days)}`}>{r.aging_days ?? '—'}</span>
                  </td>
                  <td className="dni-num">{r.tms_inv_date ? fmtDate(r.tms_inv_date) : ''}</td>
                  <td>{r.insurer || ''}</td>
                  <td>{r.registration || ''}</td>
                  <td className="dni-comment">{r.last_comment || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
