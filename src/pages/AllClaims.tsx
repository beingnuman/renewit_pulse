import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import {
  filterClaims,
  countClaims,
  getCategoryCounts,
  listStatusOptions,
  type ClaimListRow,
  type CategoryCounts,
  type StatusOption,
} from '../lib/api'
import { money, num } from '../lib/format'
import { IconSearch } from '../components/icons'
import { Loader } from '../components/Loader'

const CATEGORY_META: { key: keyof Omit<CategoryCounts, 'total'>; label: string; sub: string; color: string }[] = [
  { key: 'QUOTE', label: 'Quote', sub: 'Active Estimates', color: '#1b3a6b' },
  { key: 'AUTHORISED', label: 'Authorised', sub: 'Approved', color: '#16a34a' },
  { key: 'WIP', label: 'WIP', sub: 'In Workshop', color: '#d97706' },
  { key: 'FINALISED', label: 'Finalised', sub: 'Ready to Bill', color: '#9333ea' },
]

const BADGE: Record<string, string> = {
  QUOTE: '#1b3a6b',
  AUTHORISED: '#16a34a',
  WIP: '#d97706',
  FINALISED: '#9333ea',
  OLD: '#64748b',
}

const COLUMNS = [
  'DR Number', 'RO Number', 'Aging', 'DIP', 'Registration', 'Claim Status', 'Manufacturer',
  'CSA', 'Insurer', 'Approved Value', 'Customer', 'Contact', 'Speed Shop', 'Category', 'T/D',
]

// Header label → server sort column (whitelisted by filter_claims_enhanced)
const SORTABLE: Record<string, string> = {
  'DR Number': 'dr_number',
  'RO Number': 'ro_number',
  'Aging': 'aging',
  'Registration': 'vehicle_registration',
  'Claim Status': 'status_name',
  'Approved Value': 'approved_amount',
}

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
  if (n == null) return ''
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

const SORT_OPTIONS: { label: string; col: string; dir: 'ASC' | 'DESC' }[] = [
  { label: 'Newest first', col: 'created_at', dir: 'DESC' },
  { label: 'Oldest first', col: 'created_at', dir: 'ASC' },
  { label: 'Aging — highest', col: 'aging', dir: 'DESC' },
  { label: 'Aging — lowest', col: 'aging', dir: 'ASC' },
  { label: 'Approved value — high', col: 'approved_amount', dir: 'DESC' },
  { label: 'Approved value — low', col: 'approved_amount', dir: 'ASC' },
  { label: 'DR number', col: 'dr_number', dir: 'ASC' },
  { label: 'Status', col: 'status_name', dir: 'ASC' },
]

export function AllClaims() {
  const { branchId } = useAuth()
  const navigate = useNavigate()

  const [cards, setCards] = useState<CategoryCounts | null>(null)
  const cardsRef = useRef<CategoryCounts | null>(null)
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([])

  // single active filter
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // additive advanced filters (combine with category/status/search)
  const [overdue, setOverdue] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortColumn, setSortColumn] = useState('created_at')
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC')

  const [rows, setRows] = useState<ClaimListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // cards + status options (per branch)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [c, s] = await Promise.all([getCategoryCounts(branchId), listStatusOptions().catch(() => [])])
        if (!active) return
        cardsRef.current = c
        setCards(c)
        setStatusOptions(s)
      } catch {
        /* non-fatal */
      }
    }
    void load()
    return () => { active = false }
  }, [branchId])

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // main list + total
  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const offset = (page - 1) * pageSize
        const advanced = overdue || !!dateFrom || !!dateTo
        const list = await filterClaims({
          branchId, category: category || null, status: status || null, search: search || null,
          overdue: overdue || null, dateFrom: dateFrom || null, dateTo: dateTo || null,
          sortColumn, sortDirection, limit: pageSize, offset,
        })
        let count: number
        const cc = cardsRef.current
        if (category && cc && !advanced) count = cc[category as keyof CategoryCounts] as number
        else count = await countClaims({
          branchId, category: category || null, status: status || null, search: search || null,
          overdue: overdue || null, dateFrom: dateFrom || null, dateTo: dateTo || null,
        })
        if (!active) return
        setRows(list)
        setTotal(count)
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load claims')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [branchId, category, status, search, overdue, dateFrom, dateTo, sortColumn, sortDirection, page, pageSize])

  const pickCategory = (c: string) => {
    setCategory((cur) => (cur === c ? '' : c))
    setStatus(''); setSearchInput(''); setSearch(''); setPage(1)
  }
  const pickStatus = (s: string) => {
    setStatus(s); setCategory(''); setSearchInput(''); setSearch(''); setPage(1)
  }
  const onSearch = (v: string) => {
    setSearchInput(v); setCategory(''); setStatus(''); setPage(1)
  }
  const onSortHeader = (label: string) => {
    const col = SORTABLE[label]
    if (!col) return
    if (sortColumn === col) setSortDirection((d) => (d === 'ASC' ? 'DESC' : 'ASC'))
    else { setSortColumn(col); setSortDirection('DESC') }
    setPage(1)
  }
  const onSortSelect = (v: string) => {
    const [col, dir] = v.split('|')
    setSortColumn(col); setSortDirection(dir as 'ASC' | 'DESC'); setPage(1)
  }
  const setRange = (from: string, to: string) => { setDateFrom(from); setDateTo(to); setPage(1) }
  const preset = (days: number) => {
    const to = new Date()
    const from = new Date(); from.setDate(from.getDate() - days)
    setRange(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10))
  }
  const clearAll = () => {
    setCategory(''); setStatus(''); setSearchInput(''); setSearch('')
    setOverdue(false); setDateFrom(''); setDateTo('')
    setSortColumn('created_at'); setSortDirection('DESC'); setPage(1)
  }
  const statusLabel = statusOptions.find((s) => s.code === status)?.label ?? status
  const anyFilter = !!(category || status || search || overdue || dateFrom || dateTo)

  const downloadCsv = () => {
    const header = COLUMNS.join(',')
    const body = rows.map((c) =>
      [c.dr, c.ro, c.aging ?? '', c.dip ?? '', c.registration, c.status, c.manufacturer, c.csa,
       c.insurer, c.approvedValue, c.customer, c.contact, c.speedShop, c.category, c.td]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','),
    ).join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'claims.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * pageSize

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Repair Management</h1>
          <div className="muted">Professional vehicle repair workflow with comprehensive status tracking</div>
        </div>
      </div>

      <div className="rm-cards">
        {CATEGORY_META.map((m) => (
          <button
            key={m.key}
            className={`rm-card${category === m.key ? ' active' : ''}`}
            onClick={() => pickCategory(m.key)}
            style={{ ['--cat' as string]: m.color }}
          >
            <span className="rm-card-accent" />
            <div className="rm-card-top">
              <span className="rm-card-label">{m.label}</span>
              <span className="rm-dot" style={{ background: m.color }} />
            </div>
            <div className="rm-card-value">{cards ? num(cards[m.key]) : '—'}</div>
            <div className="rm-card-sub">{m.sub}</div>
          </button>
        ))}
      </div>

      <div className="rm-bar">
        <div className="rm-bar-row">
          <div className="search rm-search">
            <span className="search-icon" aria-hidden><IconSearch size={17} /></span>
            <input
              placeholder="Search by claim, DR, or RO number…"
              value={searchInput}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <select className="rm-status" value={status} onChange={(e) => pickStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
          <label className="rm-fl">
            <span>Sort</span>
            <select className="rm-fselect" value={`${sortColumn}|${sortDirection}`} onChange={(e) => onSortSelect(e.target.value)}>
              {SORT_OPTIONS.map((o) => <option key={`${o.col}|${o.dir}`} value={`${o.col}|${o.dir}`}>{o.label}</option>)}
            </select>
          </label>
          <button className="csv-btn" onClick={downloadCsv} disabled={rows.length === 0}>⬇ Export</button>
        </div>

        <div className="rm-bar-row second">
          <button className={`rm-toggle${overdue ? ' on' : ''}`} onClick={() => { setOverdue((o) => !o); setPage(1) }}>
            <span className="rm-toggle-dot" /> Overdue only
          </button>
          <label className="rm-fl">
            <span>Created</span>
            <input type="date" className="rm-fdate" value={dateFrom} max={dateTo || undefined} onChange={(e) => setRange(e.target.value, dateTo)} />
            <span className="rm-fdash">→</span>
            <input type="date" className="rm-fdate" value={dateTo} min={dateFrom || undefined} onChange={(e) => setRange(dateFrom, e.target.value)} />
          </label>
          <div className="rm-presets">
            <button onClick={() => preset(7)}>7d</button>
            <button onClick={() => preset(30)}>30d</button>
            <button onClick={() => preset(90)}>90d</button>
          </div>
          <span className="rm-bar-spacer" />
          <span className="rm-legend-inline">
            <span className="chip">Warranty <span className="swatch" style={{ background: 'var(--warranty)' }} /></span>
            <span className="chip">Upsell <span className="swatch" style={{ background: 'var(--upsell)' }} /></span>
          </span>
        </div>

        {anyFilter && (
          <div className="rm-active">
            {category && <span className="rm-fchip">Category: {category}<button onClick={() => setCategory('')}>✕</button></span>}
            {status && <span className="rm-fchip">Status: {statusLabel}<button onClick={() => { setStatus(''); setPage(1) }}>✕</button></span>}
            {search && <span className="rm-fchip">Search: “{search}”<button onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>✕</button></span>}
            {overdue && <span className="rm-fchip">Overdue<button onClick={() => { setOverdue(false); setPage(1) }}>✕</button></span>}
            {(dateFrom || dateTo) && <span className="rm-fchip">{dateFrom || '…'} → {dateTo || '…'}<button onClick={() => setRange('', '')}>✕</button></span>}
            <button className="rm-clear" onClick={clearAll}>Clear all</button>
          </div>
        )}
      </div>

      <div className="table-card">
        {error ? (
          <div className="login-error">Couldn’t load claims: {error}</div>
        ) : (
          <>
            <div className="table-scroll rm-scroll">
              <table className="claims rm-table">
                <colgroup>
                  {['9%','5%','5%','4%','7%','14%','6%','6%','7%','7%','7%','7%','5%','6%','4%'].map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead><tr>{COLUMNS.map((c) => {
                  const col = SORTABLE[c]
                  const activeSort = col && col === sortColumn
                  return (
                    <th key={c} className={col ? 'rm-sortable' : undefined} onClick={col ? () => onSortHeader(c) : undefined} title={c}>
                      <span className="rm-th-label">{c}</span>
                      {col && <span className={`rm-sortarrow${activeSort ? ' on' : ''}`}>{activeSort ? (sortDirection === 'ASC' ? '↑' : '↓') : '↕'}</span>}
                    </th>
                  )
                })}</tr></thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={COLUMNS.length}><Loader label="Loading claims…" compact /></td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td className="empty" colSpan={COLUMNS.length}>No claims found.</td></tr>
                  )}
                  {!loading && rows.map((c) => {
                    const speedYes = (c.speedShop || '').toLowerCase() === 'yes'
                    return (
                    <tr key={c.id} className={`rm-row${c.warranty ? ' warranty' : c.upsell ? ' upsell' : ''}`} onClick={() => navigate(`/claim/${c.id}`)}>
                      <td>
                        <span className="dr-link">{c.dr || '—'}</span>
                        {c.warranty && <span className="rm-flag w" title="Warranty">W</span>}
                        {c.upsell && <span className="rm-flag u" title="Upsell">U</span>}
                      </td>
                      <td>{c.ro && c.ro !== '0' ? c.ro : '—'}</td>
                      <td className="r"><span className={agingClass(c.aging)}>{c.aging ?? '—'}</span></td>
                      <td className="r">{c.dip ?? '—'}</td>
                      <td title={c.registration}>{c.registration || '—'}</td>
                      <td><span className={`rm-status ${statusTone(c.status)}`} title={c.status}>{c.status ? shortStatus(c.status) : '—'}</span></td>
                      <td title={c.manufacturer}>{c.manufacturer || '—'}</td>
                      <td title={c.csa}>{c.csa || '—'}</td>
                      <td title={c.insurer}>{c.insurer || '—'}</td>
                      <td className="r val">{c.approvedValue ? money(c.approvedValue) : '—'}</td>
                      <td title={c.customer}>{c.customer || '—'}</td>
                      <td>{c.contact || '—'}</td>
                      <td><span className={`rm-ss${speedYes ? ' yes' : ''}`}>{speedYes ? 'Yes' : 'No'}</span></td>
                      <td>
                        {c.category && (
                          <span className="cat-badge" style={{ ['--cat' as string]: BADGE[c.category] ?? '#64748b' }}>
                            {c.category}
                          </span>
                        )}
                      </td>
                      <td>{c.td ? <span className={`rm-td ${tdTone(c.td)}`}>{c.td}</span> : '—'}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="list-foot">
              <span>
                {total === 0 ? '0 claims' : `Showing ${start + 1}–${Math.min(start + pageSize, total)} of ${num(total)}`}
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
