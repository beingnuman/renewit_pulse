import { useState, useMemo } from 'react'
import { exportWipCosting, exportWipCostingPdf } from '../lib/exportExcel'
import './WipCostingTable.css'

const fmt = (v) => {
  if (v == null || isNaN(v)) return '-'
  return `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const pct = (v) => {
  if (v == null || v === '#Error' || isNaN(v)) return '-'
  return `${Math.round(v)}%`
}

/* ─── COS% Current WIP to Invoiced ─── */
function CosWipTable({ cosCurrentWIP }) {
  if (!cosCurrentWIP) return null
  const { rows, total } = cosCurrentWIP
  return (
    <div className="cos-section">
      <h4 className="cos-section-title">COS% Current WIP to Invoiced</h4>
      <div className="cos-table-scroll">
        <table className="cos-table">
          <thead>
            <tr>
              <th className="th-left">Tow/Drive</th>
              <th>Units</th>
              <th>Latest Sale</th>
              <th>Pre Costing Value</th>
              <th>Projected COS%</th>
              <th>Highest Parts Value</th>
              <th>Adjusted COS%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.towDrive}>
                <td className="td-label">{r.towDrive}</td>
                <td className="td-num">{r.units}</td>
                <td className="td-num">{fmt(r.latestSale)}</td>
                <td className="td-num">{fmt(r.preCostingValue)}</td>
                <td className="td-pct">{pct(r.projectedCosPercent)}</td>
                <td className="td-num">{fmt(r.highestPartsValue)}</td>
                <td className="td-pct">{pct(r.adjustedCosPercent)}</td>
              </tr>
            ))}
            <tr className="cos-total-row">
              <td className="td-label">Total</td>
              <td className="td-num">{total.units}</td>
              <td className="td-num">{fmt(total.latestSale)}</td>
              <td className="td-num">{fmt(total.preCostingValue)}</td>
              <td className="td-pct">{pct(total.projectedCosPercent)}</td>
              <td className="td-num">{fmt(total.highestPartsValue)}</td>
              <td className="td-pct">{pct(total.adjustedCosPercent)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── COS% On Invoiced Jobs ─── */
function CosInvoicedTable({ cosInvoiced }) {
  if (!cosInvoiced) return null
  const { rows, total } = cosInvoiced
  return (
    <div className="cos-section">
      <h4 className="cos-section-title">COS% On Invoiced Jobs</h4>
      <div className="cos-table-scroll">
        <table className="cos-table">
          <thead>
            <tr>
              <th className="th-left">Tow/Drive</th>
              <th>Units</th>
              <th>Job Invoiced</th>
              <th>Parts Invoiced</th>
              <th>COS%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.towDrive}>
                <td className="td-label">{r.towDrive}</td>
                <td className="td-num">{r.units}</td>
                <td className="td-num">{fmt(r.jobInvoiced)}</td>
                <td className="td-num">{fmt(r.partsInvoiced)}</td>
                <td className="td-pct">{pct(r.cosPercent)}</td>
              </tr>
            ))}
            <tr className="cos-total-row">
              <td className="td-label">Total</td>
              <td className="td-num">{total.units}</td>
              <td className="td-num">{fmt(total.jobInvoiced)}</td>
              <td className="td-num">{fmt(total.partsInvoiced)}</td>
              <td className="td-pct">{pct(total.cosPercent)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Department Summary (clickable rows) ─── */
function DeptSummaryTable({ departmentSummary, onDeptClick, expandedDept }) {
  if (!departmentSummary) return null
  const { departments, grandTotal } = departmentSummary

  return (
    <div className="cos-section cos-section-dept">
      <h4 className="cos-section-title">Department Summary</h4>
      <div className="cos-table-scroll">
        <table className="cos-table dept-summary-table">
          <thead>
            <tr>
              <th className="th-left">Department</th>
              <th>Units</th>
              <th>Original Auth</th>
              <th>Extras</th>
              <th>Total Authorised</th>
              <th>Latest Sale Values</th>
              <th>Pre Costing Parts</th>
              <th>Latest Parts Value</th>
              <th>Projected COS%</th>
              <th>Adjusted COS%</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d, i) => {
              const isExpanded = expandedDept === d.department
              return (
                <tr
                  key={d.department}
                  className={`dept-row ${i % 2 === 1 ? 'dept-row-alt' : ''} ${isExpanded ? 'dept-row-expanded' : ''}`}
                  onClick={() => onDeptClick(d.department)}
                >
                  <td className="td-dept-name">
                    <div className="dept-cell">
                      <svg className={`dept-chevron ${isExpanded ? 'chevron-open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span>{d.department}</span>
                      <span className="dept-unit-badge">{d.units}</span>
                    </div>
                  </td>
                  <td className="td-num">{d.units}</td>
                  <td className="td-num">{fmt(d.originalAuth)}</td>
                  <td className="td-num">{fmt(d.extras)}</td>
                  <td className="td-num">{fmt(d.totalAuthorised)}</td>
                  <td className="td-num">{fmt(d.latestSaleValues)}</td>
                  <td className="td-num">{fmt(d.preCostingParts)}</td>
                  <td className="td-num">{fmt(d.latestPartsValue)}</td>
                  <td className="td-pct">{pct(d.projectedCosPercent)}</td>
                  <td className="td-pct">{pct(d.adjustedCosPercent)}</td>
                </tr>
              )
            })}
            <tr className="dept-grand-total-row">
              <td className="td-label">GRAND TOTAL</td>
              <td className="td-num">{grandTotal.units}</td>
              <td className="td-num">{fmt(grandTotal.originalAuth)}</td>
              <td className="td-num">{fmt(grandTotal.extras)}</td>
              <td className="td-num">{fmt(grandTotal.totalAuthorised)}</td>
              <td className="td-num">{fmt(grandTotal.latestSaleValues)}</td>
              <td className="td-num">{fmt(grandTotal.preCostingParts)}</td>
              <td className="td-num">{fmt(grandTotal.latestPartsValue)}</td>
              <td className="td-pct">{pct(grandTotal.projectedCosPercent)}</td>
              <td className="td-pct">{pct(grandTotal.adjustedCosPercent)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Full Detail Table: ALL jobs grouped by department with subtotals ─── */
function FullDetailTable({ detail, expandedDept }) {
  if (!detail?.departments || detail.departments.length === 0) return null

  // If a department is selected from summary, filter to just that department
  const depts = expandedDept
    ? detail.departments.filter((d) => d.department === expandedDept)
    : detail.departments

  const heading = expandedDept
    ? `${expandedDept} — Detail`
    : `WIP Costing Detail — ${detail.sectionName || 'All'} (${detail.totalCount || '?'} claims)`

  return (
    <div className="cos-section costing-full-detail">
      <div className="detail-heading-row">
        <h4 className="cos-section-title">{heading}</h4>
        {expandedDept && (
          <span className="detail-filter-badge">
            Filtered — click department again to show all
          </span>
        )}
      </div>
      <div className="costing-detail-scroll">
        <table className="costing-detail-table">
          <thead>
            <tr>
              <th className="th-left-detail">RO</th>
              <th className="th-left-detail">T/D</th>
              <th className="th-left-detail">Reg</th>
              <th className="th-left-detail">Model</th>
              <th className="th-left-detail">Make</th>
              <th>Authorised</th>
              <th>Extras</th>
              <th>Total Auth</th>
              <th>Current Value</th>
              <th>Variance</th>
              <th>Parts Auth</th>
              <th>Pre Costing</th>
              <th>Creditors</th>
              <th>Latest Parts</th>
              <th>Exceeding</th>
              <th>Proj COS%</th>
              <th>Adj COS%</th>
              <th>Days Conv</th>
              <th>Days Dep</th>
            </tr>
          </thead>
          <tbody>
            {depts.map((dept) => {
              const rows = []
              // Department header row
              rows.push(
                <tr key={`${dept.department}-header`} className="detail-dept-header-row">
                  <td colSpan={19}>
                    <div className="detail-dept-header-cell">
                      <span className="detail-dept-name">{dept.department}</span>
                      <span className="detail-dept-count">{dept.claims?.length || 0} jobs</span>
                    </div>
                  </td>
                </tr>
              )
              // Vehicle claim rows
              if (dept.claims) {
                dept.claims.forEach((c, i) => {
                  rows.push(
                    <tr key={`${dept.department}-${c.roNumber || i}`} className={i % 2 === 1 ? 'detail-row-alt' : ''}>
                      <td className="td-ro">
                        {c.claimId ? (
                          <a
                            href={`https://renew-it.bubbleapps.io/console?claim=${c.claimId}&v=All-Claims`}
                            className="claim-link"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {c.roNumber}
                          </a>
                        ) : (
                          c.roNumber
                        )}
                      </td>
                      <td className="td-td">{c.towDriveIn}</td>
                      <td className="td-reg">{c.vehicleRegistration}</td>
                      <td className="td-model">{c.vehicleModel}</td>
                      <td className="td-make">{c.vehicleMake}</td>
                      <td className="td-num">{fmt(c.authorised)}</td>
                      <td className="td-num">{fmt(c.extras)}</td>
                      <td className="td-num">{fmt(c.totalAuthorised)}</td>
                      <td className="td-num">{fmt(c.currentValue)}</td>
                      <td className={`td-num ${c.variance < 0 ? 'td-negative' : c.variance > 0 ? 'td-positive' : ''}`}>{fmt(c.variance)}</td>
                      <td className="td-num">{fmt(c.partsAuthMarkup)}</td>
                      <td className="td-num">{fmt(c.preCostingParts)}</td>
                      <td className="td-num">{fmt(c.creditorsPartsValue)}</td>
                      <td className="td-num">{fmt(c.latestPartsValue)}</td>
                      <td className="td-num">{fmt(c.valueExceedingPrecost)}</td>
                      <td className="td-pct">{pct(c.projectedCosPercent)}</td>
                      <td className="td-pct">{pct(c.adjustedCosPercent)}</td>
                      <td className="td-days">{c.daysSinceConversion ?? '-'}</td>
                      <td className="td-days">{c.daysInDepartment ?? '-'}</td>
                    </tr>
                  )
                })
              }
              // Subtotal row
              if (dept.subtotal) {
                rows.push(
                  <tr key={`${dept.department}-subtotal`} className="detail-subtotal-row">
                    <td className="td-subtotal-label" colSpan={5}>
                      {dept.department} Subtotal ({dept.subtotal.count})
                    </td>
                    <td className="td-num">{fmt(dept.subtotal.authorised)}</td>
                    <td className="td-num">{fmt(dept.subtotal.extras)}</td>
                    <td className="td-num">{fmt(dept.subtotal.totalAuthorised)}</td>
                    <td className="td-num">{fmt(dept.subtotal.currentValue)}</td>
                    <td className="td-num">{fmt(dept.subtotal.variance)}</td>
                    <td className="td-num" />
                    <td className="td-num">{fmt(dept.subtotal.preCostingParts)}</td>
                    <td className="td-num" />
                    <td className="td-num">{fmt(dept.subtotal.latestPartsValue)}</td>
                    <td className="td-num" />
                    <td className="td-pct">{pct(dept.subtotal.projectedCosPercent)}</td>
                    <td className="td-pct">{pct(dept.subtotal.adjustedCosPercent)}</td>
                    <td className="td-days" />
                    <td className="td-days" />
                  </tr>
                )
              }
              return rows
            })}
            {/* Grand total */}
            {!expandedDept && detail.grandTotal && (
              <tr className="detail-grand-total-row">
                <td className="td-grand-label" colSpan={5}>GRAND TOTAL ({detail.grandTotal.count})</td>
                <td className="td-num">{fmt(detail.grandTotal.authorised)}</td>
                <td className="td-num">{fmt(detail.grandTotal.extras)}</td>
                <td className="td-num">{fmt(detail.grandTotal.totalAuthorised)}</td>
                <td className="td-num">{fmt(detail.grandTotal.currentValue)}</td>
                <td className="td-num">{fmt(detail.grandTotal.variance)}</td>
                <td className="td-num" />
                <td className="td-num">{fmt(detail.grandTotal.preCostingParts)}</td>
                <td className="td-num" />
                <td className="td-num">{fmt(detail.grandTotal.latestPartsValue)}</td>
                <td className="td-num" />
                <td className="td-pct">{pct(detail.grandTotal.projectedCosPercent)}</td>
                <td className="td-pct">{pct(detail.grandTotal.adjustedCosPercent)}</td>
                <td className="td-days" />
                <td className="td-days" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */
function WipCostingTable({ data, branchName, branchId }) {
  const [activeTab, setActiveTab] = useState('all')
  const [expandedDept, setExpandedDept] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  async function handleExport(format) {
    if (exporting) return
    setExportMenuOpen(false)
    setExporting(true)
    try {
      if (format === 'pdf') {
        await exportWipCostingPdf(branchId)
      } else {
        await exportWipCosting(branchId)
      }
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const tabs = useMemo(() => {
    const t = [{ id: 'all', label: 'All (Incl Pre Inv)' }]
    if (data.newWork) t.push({ id: 'newWork', label: 'New Work Only' })
    if (data.preInvoiced) t.push({ id: 'preInvoiced', label: 'Pre Invoiced' })
    return t
  }, [data])

  const activeData = data[activeTab]
  const summary = activeData?.summary
  const detail = activeData?.detail

  const handleDeptClick = (dept) => {
    setExpandedDept(expandedDept === dept ? null : dept)
  }

  if (!data || !activeData) {
    return <div className="costing-no-data">No costing data available.</div>
  }

  return (
    <div className="costing-wrapper">
      {/* Header */}
      <div className="costing-header-meta">
        <div className="costing-header-top">
          <div>
            <div className="costing-title">{(summary?.title || 'WIP Costing Report').replace(/renew-IT/gi, 'Renew-IT')}</div>
            <div className="costing-meta-row">
              <span>Branch: {branchName}</span>
              <span>Generated: {summary?.generatedAt ? new Date(summary.generatedAt).toLocaleString() : '-'}</span>
            </div>
          </div>
          <div className="export-dropdown-wrap">
            <button className="wip-export-btn" onClick={() => setExportMenuOpen(prev => !prev)} disabled={exporting}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exporting ? 'Exporting...' : 'Export'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {exportMenuOpen && (
              <div className="export-dropdown-menu">
                <button className="export-dropdown-item" onClick={() => handleExport('excel')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                  Excel (.xlsx)
                </button>
                <button className="export-dropdown-item" onClick={() => handleExport('pdf')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  PDF (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tabs for All / New Work / Pre Invoiced */}
      {tabs.length > 1 && (
        <div className="costing-sub-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`costing-sub-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(t.id); setExpandedDept(null) }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Summary section */}
      <div className="costing-summary-grid">
        <CosWipTable cosCurrentWIP={summary?.cosCurrentWIP} />
        <CosInvoicedTable cosInvoiced={summary?.cosInvoiced} />
      </div>

      {/* Department summary — click a row to filter detail below */}
      <DeptSummaryTable
        departmentSummary={summary?.departmentSummary}
        expandedDept={expandedDept}
        onDeptClick={handleDeptClick}
      />

      {/* Full detail: all jobs grouped by department with subtotals */}
      <FullDetailTable detail={detail} expandedDept={expandedDept} />
    </div>
  )
}

export default WipCostingTable
