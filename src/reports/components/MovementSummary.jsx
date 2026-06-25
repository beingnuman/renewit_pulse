import './MovementSummary.css'
import { useState } from 'react'
import { exportFdSheet, exportMovementExcel, exportMovementPdf } from '../lib/exports/reportExports'

function fmtK(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-ZA')
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

const METRICS = [
  { key: 'monthlyTowQuote', label: 'Tow Quote' },
  { key: 'monthlyDriveQuote', label: 'Drive Quote' },
  { key: 'monthlyConversions', label: 'Conversions' },
  { key: 'monthlyProductivity', label: 'Productivity' },
  { key: 'monthlyInvoicing', label: 'Invoicing' },
]

// NOTE: Renew-IT is moving OFF the legacy SSRS system onto Pulse. This report is a
// Pulse-native replica — there must be NO links back to SSRS. Export (Excel/PDF) must
// be generated in-app from Pulse data, not by linking to rp.renew-it.co.za. See the
// "no-ssrs-replicate-in-pulse" memory note and continuation.md.
// TODO: wire Excel/PDF export to an in-app generator (Pulse-native), then restore buttons.

export default function MovementSummary({ branchName, reportDate, targets, branchId }) {
  const [busy, setBusy] = useState(null)

  async function runExport(kind, fn) {
    if (busy) return
    setBusy(kind)
    try {
      await fn(branchId, reportDate)
    } catch (err) {
      alert(err?.message || 'Export failed. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mvs-card">
      <div className="mvs-head">
        <div className="mvs-head-left">
          <h2 className="mvs-title">Branch Productivity Performance Dashboard</h2>
          <div className="mvs-subtitle">Latest Sale Values</div>
        </div>
        <div className="mvs-head-right">
          <div className="mvs-branch">
            <span className="mvs-branch-label">Branch</span>
            <span className="mvs-branch-name">{branchName || '—'}</span>
            {reportDate && <span className="mvs-date">As at {fmtDate(reportDate)}</span>}
          </div>
          {/* Pulse-native exports: all generated in-app from Pulse data (no SSRS link). */}
          {branchId && (
            <div className="mvs-export-row">
              <button
                type="button"
                className="mvs-export-btn mvs-export-primary"
                disabled={!!busy}
                onClick={() => runExport('fd', exportFdSheet)}
                title="Download the FM daily sheet, pre-filled from Pulse (review before sending to FD)"
              >
                <DownloadIcon />
                {busy === 'fd' ? 'Generating…' : 'FD Sheet'}
              </button>
              <button
                type="button"
                className="mvs-export-btn"
                disabled={!!busy}
                onClick={() => runExport('xlsx', exportMovementExcel)}
                title="Export the full movement report as Excel (SSRS layout)"
              >
                <DownloadIcon />
                {busy === 'xlsx' ? 'Generating…' : 'Excel'}
              </button>
              <button
                type="button"
                className="mvs-export-btn"
                disabled={!!busy}
                onClick={() => runExport('pdf', exportMovementPdf)}
                title="Export the full movement report as PDF (SSRS layout) — opens for Print → Save as PDF"
              >
                <DownloadIcon />
                {busy === 'pdf' ? 'Opening…' : 'PDF'}
              </button>
            </div>
          )}
        </div>
      </div>

      {targets ? (
        <div className="mvs-targets">
          <div className="mvs-targets-head">Monthly Targets (R'000)</div>
          <div className="mvs-grid">
            {METRICS.map((m) => (
              <div className="mvs-metric" key={m.key}>
                <span className="mvs-m-label">{m.label}</span>
                <span className="mvs-m-val">{fmtK(targets[m.key])}</span>
              </div>
            ))}
            <div className="mvs-metric mvs-metric-ratio">
              <span className="mvs-m-label">T / D Ratio</span>
              <span className="mvs-m-val">{targets.tdRatio || '—'}</span>
            </div>
          </div>

          {targets.period && (
            <div className="mvs-period">
              <span><strong>Period</strong> {fmtDate(targets.period.dateStart)} – {fmtDate(targets.period.dateEnd)}</span>
              <span><strong>Total Days</strong> {targets.period.totalDays}</span>
              <span><strong>Total Weeks</strong> {targets.period.totalWeeks}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mvs-no-targets">No targets configured for this branch yet.</div>
      )}
    </div>
  )
}
