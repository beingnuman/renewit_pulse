import { useState, useEffect, useRef } from 'react'
import '../reports-theme.css'
import './Reports.css'
import WipReportTable from '../components/WipReportTable'
import WipCostingTable from '../components/WipCostingTable'
import MovementReportTable from '../components/MovementReportTable'
import MovementSummary from '../components/MovementSummary'
import SalesTeamPerformance from '../components/SalesTeamPerformance'
import PreInvoicingTable from '../components/PreInvoicingTable'
import { getDailyMovements, getPreInvoicing } from '../lib/movements'
import Dashboard from './Dashboard'
import { getAccessToken, SUPABASE_ANON_KEY, refreshAccessToken } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { REPORT_CATALOG, findReport } from '../reports/catalog'
import { getImpl, isLive } from '../reports/registry'

// Which catalog category contains a given report id (for default-expanding the menu).
function categoryKeyOf(reportId) {
  const cat = REPORT_CATALOG.find(c => c.reports.some(r => r.id === reportId))
  return cat ? cat.key : null
}

function Reports() {
  // Real branches come from Pulse's auth (same source as the global switcher).
  const { branches, currentBranchId } = useAuth()
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [selectedReport, setSelectedReport] = useState('wip')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [error, setError] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [branchSearch, setBranchSearch] = useState('')
  const [expandedCats, setExpandedCats] = useState(() => new Set([categoryKeyOf('wip')]))
  const [menuSearch, setMenuSearch] = useState('')
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  )

  // Default the dropdown to the branch chosen in Pulse's global switcher (else
  // the first available branch) once branches have loaded. Users can still
  // switch independently from here afterwards.
  useEffect(() => {
    if (selectedBranch || branches.length === 0) return
    const match = branches.find(b => b.id === currentBranchId)
    setSelectedBranch(match || branches[0])
  }, [branches, currentBranchId, selectedBranch])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
        setBranchSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus search when dropdown opens
  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (!selectedBranch) return
    if (selectedReport === 'commitments') return // renders the Dashboard, no fetch
    if (!isLive(selectedReport)) return // planned report → placeholder, no fetch
    let cancelled = false

    async function fetchReport() {
      setLoading(true)
      setError(null)
      setReportData(null)

      try {
        // Registry-backed reports (new Pulse-native pattern) own their own fetch.
        const impl = getImpl(selectedReport)
        if (impl) {
          const data = await impl.fetch(selectedBranch)
          if (!cancelled) setReportData(data)
          return
        }

        if (selectedReport === 'movement') {
          const data = await getDailyMovements(selectedBranch.id)
          if (cancelled) return
          if (!data.movementReport || data.movementReport.groups.length === 0) {
            setReportData({ _empty: true, message: 'No movements recorded for this day.' })
          } else {
            setReportData(data)
          }
          return
        }

        if (selectedReport === 'pre-invoicing') {
          const data = await getPreInvoicing(selectedBranch.id)
          if (cancelled) return
          setReportData({ preInvoicing: data })
          return
        }

        const edgeFnUrl = 'https://qhnghzqqcjxkqtydurxz.supabase.co/functions/v1/generate-reports-ui'
        const edgeReportType = selectedReport === 'wip-costing' ? 'costing' : selectedReport
        const bodyPayload = JSON.stringify({
          reportType: edgeReportType,
          branchId: selectedBranch.id,
        })

        function buildHeaders() {
          const bearer = getAccessToken() || SUPABASE_ANON_KEY
          return {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${bearer}`,
          }
        }

        let res = await fetch(edgeFnUrl, {
          method: 'POST',
          headers: buildHeaders(),
          body: bodyPayload,
        })

        if (res.status === 401) {
          const newToken = await refreshAccessToken()
          if (newToken) {
            res = await fetch(edgeFnUrl, {
              method: 'POST',
              headers: buildHeaders(),
              body: bodyPayload,
            })
          }
        }

        if (!res.ok) {
          const errText = await res.text()
          try {
            const errJson = JSON.parse(errText)
            if (errJson.error && errJson.error.includes('No') && errJson.error.includes('data found')) {
              if (!cancelled) setReportData({ _empty: true, message: errJson.error })
              return
            }
          } catch { /* not JSON */ }
          throw new Error(errText || `Request failed (${res.status})`)
        }

        const contentType = res.headers.get('content-type') || ''

        if (contentType.includes('application/json')) {
          const data = await res.json()
          if (data && data.success === false) {
            if (!cancelled) setReportData({ _empty: true, message: data.error || 'No data available' })
          } else {
            if (!cancelled) setReportData(data)
          }
        } else {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          const ext = contentType.includes('csv') ? 'csv' : contentType.includes('pdf') ? 'pdf' : 'xlsx'
          a.download = `${selectedReport}-report-${selectedBranch.code}.${ext}`
          a.click()
          URL.revokeObjectURL(url)
          if (!cancelled) setLoading(false)
          return
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchReport()
    return () => { cancelled = true }
  }, [selectedBranch, selectedReport])

  function selectBranch(branch) {
    setSelectedBranch(branch)
    setDropdownOpen(false)
    setBranchSearch('')
  }

  function selectReport(id) {
    if (!isLive(id)) return
    setSelectedReport(id)
  }

  function toggleCat(key) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const impl = getImpl(selectedReport)
  const activeReport = findReport(selectedReport)
  const q = menuSearch.trim().toLowerCase()

  return (
    <div className="reports-page">
      {/* Header bar */}
      <div className="reports-header">
        <div className="reports-header-left">
          <h1 className="reports-title">Reports</h1>

          {/* Branch dropdown */}
          <div className="rbranch-dropdown" ref={dropdownRef}>
            <button
              className={`rbranch-trigger ${dropdownOpen ? 'open' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {selectedBranch ? (
                <>
                  <span className="rbranch-trigger-avatar">{selectedBranch.name.charAt(0)}</span>
                  <span className="rbranch-trigger-name">{selectedBranch.name}</span>
                  <span className="rbranch-trigger-code">{selectedBranch.code}</span>
                </>
              ) : (
                <span className="rbranch-trigger-placeholder">Select branch...</span>
              )}
              <svg className="rbranch-trigger-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="rbranch-menu">
                <div className="rbranch-menu-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search branches..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                  />
                </div>
                <div className="rbranch-menu-list">
                  {filteredBranches.map((branch) => (
                    <button
                      key={branch.id}
                      className={`rbranch-menu-item ${selectedBranch?.id === branch.id ? 'active' : ''}`}
                      onClick={() => selectBranch(branch)}
                    >
                      <span className="rbranch-menu-avatar">{branch.name.charAt(0)}</span>
                      <span className="rbranch-menu-name">{branch.name}</span>
                      <span className="rbranch-menu-code">{branch.code}</span>
                      {selectedBranch?.id === branch.id && (
                        <svg className="rbranch-menu-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                  {filteredBranches.length === 0 && (
                    <div className="rbranch-menu-empty">No branches found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {activeReport && (
          <div className="reports-current">
            <span className="reports-current-cat">{activeReport.category}</span>
            <span className="reports-current-name">{activeReport.name}</span>
          </div>
        )}
      </div>

      {/* Body: report menu (mirrors the Online SSRS tree) + content */}
      <div className="reports-body">
        <aside className="reports-sidebar">
          <div className="rs-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search reports..."
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
            />
          </div>

          <div className="rs-tree">
            {REPORT_CATALOG.map((cat) => {
              const reports = q
                ? cat.reports.filter(r => r.name.toLowerCase().includes(q))
                : cat.reports
              if (reports.length === 0) return null
              const liveCount = cat.reports.filter(r => isLive(r.id)).length
              const open = q ? true : expandedCats.has(cat.key)
              return (
                <div className="rs-cat" key={cat.key}>
                  <button className="rs-cat-head" onClick={() => toggleCat(cat.key)}>
                    <svg className={`rs-chevron ${open ? 'open' : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="rs-cat-label">{cat.label}</span>
                    {liveCount > 0 && <span className="rs-cat-count">{liveCount}</span>}
                  </button>
                  {open && (
                    <ul className="rs-reports">
                      {reports.map((r) => {
                        const live = isLive(r.id)
                        return (
                          <li key={r.id}>
                            <button
                              className={`rs-report ${selectedReport === r.id ? 'active' : ''} ${live ? '' : 'planned'}`}
                              onClick={() => selectReport(r.id)}
                              disabled={!live}
                              title={live ? r.name : `${r.name} — not built yet`}
                            >
                              <span className="rs-report-name">{r.name}</span>
                              {!live && <span className="rs-soon">soon</span>}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* Content */}
        <div className="reports-content">
          {!selectedBranch ? (
            <div className="reports-empty-state">
              <div className="empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h2>Select a branch to begin</h2>
              <p>Choose a branch from the dropdown above to view reports</p>
            </div>
          ) : selectedReport === 'commitments' ? (
            <Dashboard branchOverride={selectedBranch} embedded />
          ) : !isLive(selectedReport) ? (
            <div className="reports-empty-state">
              <div className="empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h2>{activeReport?.name || 'Report'} — coming soon</h2>
              <p>
                This report is in the Online catalog{activeReport?.category ? ` (${activeReport.category})` : ''} and
                hasn’t been re-built in Pulse yet. Pick one of the live reports from the menu.
              </p>
            </div>
          ) : (
            <>
              {loading && (
                <div className="reports-loading">
                  <div className="loading-spinner" />
                  <p>Loading report...</p>
                </div>
              )}

              {error && (
                <div className="reports-error">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <p>{error}</p>
                  <button onClick={() => setSelectedBranch({ ...selectedBranch })}>Retry</button>
                </div>
              )}

              {!loading && !error && reportData && reportData._empty && (
                <div className="reports-empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <h3>No data yet</h3>
                  <p>This branch doesn't have any report data to display yet. Data will appear here once it becomes available.</p>
                </div>
              )}

              {!loading && !error && reportData && !reportData._empty && (
                <>
                  {impl ? (
                    <impl.Component {...impl.propsFrom(reportData, selectedBranch)} />
                  ) : selectedReport === 'wip' && reportData.wipReport ? (
                    <WipReportTable
                      data={reportData}
                      branchId={selectedBranch.id}
                      reportType={selectedReport}
                    />
                  ) : selectedReport === 'wip-costing' && reportData.costingReport ? (
                    <WipCostingTable
                      data={reportData.costingReport}
                      branchName={reportData.branch}
                      branchId={selectedBranch.id}
                    />
                  ) : selectedReport === 'movement' && reportData.movementReport ? (
                    <>
                      <MovementSummary
                        branchName={reportData.branch}
                        reportDate={reportData.reportDate}
                        targets={reportData.targets}
                        branchBid={reportData.branchBid}
                        branchId={selectedBranch.id}
                      />
                      <SalesTeamPerformance data={reportData.salesTeamPerformance} />
                      <SalesTeamPerformance
                        data={reportData.preProduction}
                        title="Pre Production Team"
                        subtitle="Parts Manager, Stripping & Loading"
                      />
                      <SalesTeamPerformance
                        data={reportData.mainProduction}
                        title="Main Production"
                        subtitle="Production Manager, Line Managers, Quality Control"
                      />
                      <SalesTeamPerformance
                        data={reportData.frontOffice}
                        title="Front Office & Finance"
                        subtitle="Delivery & Invoicing"
                      />
                      <MovementReportTable
                        data={reportData.movementReport}
                        branchName={reportData.branch}
                        reportDate={reportData.reportDate}
                        branchId={selectedBranch.id}
                      />
                    </>
                  ) : selectedReport === 'pre-invoicing' && reportData.preInvoicing ? (
                    <PreInvoicingTable
                      data={reportData.preInvoicing}
                      branchName={reportData.branch || selectedBranch.name}
                    />
                  ) : (
                    <pre className="report-json">{JSON.stringify(reportData, null, 2)}</pre>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Reports
