import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCustomersDirectory, getCustomerById, getCustomerVehicles, getCustomerClaims,
  type CustomerRow, type CustomerDetail, type CustomerVehicle, type CustomerClaim,
} from '../lib/api'
import { money } from '../lib/format'
import { Loader } from '../components/Loader'
import { IconSearch, IconUser, IconCar, IconClaims, IconClock, IconMoney, IconBolt, IconExternal } from '../components/icons'

const GRADS = [
  'linear-gradient(135deg,#3b82f6,#2563eb)', 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
  'linear-gradient(135deg,#14b8a6,#0d9488)', 'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#ec4899,#db2777)', 'linear-gradient(135deg,#10b981,#059669)',
]
const gradOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return GRADS[h % GRADS.length] }
const initials = (s: string) => s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Tone = 'green' | 'blue' | 'amber' | 'violet' | 'red' | 'grey'
const statusTone = (s: string | null): Tone => {
  const t = (s ?? '').toLowerCase()
  if (/deliver|invoic|finalis|closed|complete/.test(t)) return 'green'
  if (/cancel|not proceed|reject|decline|^99/.test(t)) return 'red'
  if (/book|^100/.test(t)) return 'blue'
  if (/wip|progress|repair|strip|panel|paint|polish|^0[1-6]/.test(t)) return 'violet'
  if (/quote|tow|drive|await|estimat|moderat|^7\d/.test(t)) return 'amber'
  return 'grey'
}
const isActiveStatus = (s: string | null) => { const x = statusTone(s); return x !== 'green' && x !== 'red' }
const PAGE = 40

export function Customers() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([])
  const [claims, setClaims] = useState<CustomerClaim[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), 350)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const r = await getCustomersDirectory(search || null, PAGE, 0)
        if (!on) return
        setRows(r)
        setOffset(r.length)
        setHasMore(r.length === PAGE)
        setSelectedId((cur) => cur && r.some((x) => x.customerId === cur) ? cur : (r[0]?.customerId ?? null))
      } catch {
        if (on) setRows([])
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [search])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const r = await getCustomersDirectory(search || null, PAGE, offset)
      setRows((prev) => [...prev, ...r])
      setOffset((o) => o + r.length)
      setHasMore(r.length === PAGE)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!selectedId) { if (on) { setDetail(null); setVehicles([]); setClaims([]) }; return }
      setDetailLoading(true)
      try {
        const [d, v, c] = await Promise.all([
          getCustomerById(selectedId).catch(() => null),
          getCustomerVehicles(selectedId).catch(() => []),
          getCustomerClaims(selectedId).catch(() => []),
        ])
        if (!on) return
        setDetail(d); setVehicles(v); setClaims(c)
      } finally {
        if (on) setDetailLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [selectedId])

  const totalApproved = useMemo(() => claims.reduce((a, c) => a + c.approvedValue, 0), [claims])
  const activeCount = useMemo(() => claims.filter((c) => isActiveStatus(c.status)).length, [claims])
  const lastActivity = useMemo(() => claims[0]?.createdAt ?? detail?.latestClaimDate ?? null, [claims, detail])
  const toneSegments = useMemo(() => {
    const order: Tone[] = ['blue', 'amber', 'violet', 'green', 'red', 'grey']
    const counts = new Map<Tone, number>()
    for (const c of claims) { const t = statusTone(c.status); counts.set(t, (counts.get(t) ?? 0) + 1) }
    return order.map((t) => ({ tone: t, n: counts.get(t) ?? 0 })).filter((x) => x.n > 0)
  }, [claims])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>All Customers</h1>
          <div className="muted">Every customer with a repair on record, and the jobs linked to them.</div>
        </div>
      </div>

      <div className="cust-layout">
        <aside className="cust-list-pane">
          <div className="cust-search">
            <IconSearch size={16} />
            <input placeholder="Search name, email or phone…" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          {loading ? (
            <Loader label="Loading customers…" />
          ) : rows.length === 0 ? (
            <div className="cust-empty-list">No customers found.</div>
          ) : (
            <div className="cust-list">
              {rows.map((r) => (
                <button key={r.customerId} className={`cust-item${selectedId === r.customerId ? ' active' : ''}`} onClick={() => setSelectedId(r.customerId)}>
                  <span className="cust-ava" style={{ background: gradOf(r.name) }}>{initials(r.name)}</span>
                  <div className="cust-item-main">
                    <span className="cust-item-name">{r.name}</span>
                    <span className="cust-item-sub">{r.mobile || r.email || '—'} · {fmtDate(r.latestClaimDate)}</span>
                  </div>
                  <span className="cust-item-count">{r.totalClaims}</span>
                </button>
              ))}
              {hasMore && (
                <button className="cust-loadmore" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>
              )}
            </div>
          )}
        </aside>

        <div className="cust-detail">
          {!selectedId ? (
            <div className="cust-detail-empty"><span className="cust-detail-ic"><IconUser size={24} /></span>Select a customer to see their details and jobs.</div>
          ) : detailLoading && !detail ? (
            <Loader label="Loading customer…" />
          ) : detail ? (
            <>
              <div className="cust-hero">
                <span className="cust-hero-ava" style={{ background: gradOf(detail.name) }}>{initials(detail.name)}</span>
                <div className="cust-hero-main">
                  <div className="cust-hero-name">{detail.name}</div>
                  <div className="cust-hero-since">
                    Customer since {fmtDate(detail.createdAt)}{lastActivity ? ` · last activity ${fmtDate(lastActivity)}` : ''}
                  </div>
                  <div className="cust-chips">
                    {detail.mobile && <a className="cust-chip" href={`tel:${detail.mobile}`}><IconClock size={13} />{detail.mobile}</a>}
                    {detail.email && <a className="cust-chip" href={`mailto:${detail.email}`}><IconUser size={13} />{detail.email}</a>}
                    {detail.idNumber && <span className="cust-chip ghost">ID {detail.idNumber}</span>}
                  </div>
                </div>
                <div className="cust-kpis">
                  <div className="cust-kpi blue"><span className="cust-kpi-ic"><IconClaims size={15} /></span><b>{detail.totalClaims}</b><span>Jobs</span></div>
                  <div className="cust-kpi amber"><span className="cust-kpi-ic"><IconBolt size={15} /></span><b>{activeCount}</b><span>Active</span></div>
                  <div className="cust-kpi teal"><span className="cust-kpi-ic"><IconCar size={15} /></span><b>{detail.totalVehicles}</b><span>Vehicles</span></div>
                  <div className="cust-kpi green"><span className="cust-kpi-ic"><IconMoney size={15} /></span><b>{money(totalApproved)}</b><span>Approved</span></div>
                </div>
              </div>

              {vehicles.length > 0 && (
                <div className="cust-section">
                  <div className="cust-section-head"><IconCar size={15} /> Vehicles <span className="cust-pill">{vehicles.length}</span></div>
                  <div className="cust-vehicles">
                    {vehicles.map((v) => (
                      <div key={v.id} className="cust-vehicle">
                        <span className="cust-vehicle-ic"><IconCar size={18} /></span>
                        <div className="cust-vehicle-body">
                          <div className="cust-vehicle-reg">{v.registration || '—'}</div>
                          <div className="cust-vehicle-desc">{[v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'}</div>
                          <div className="cust-vehicle-chips">
                            {v.year && <span>{v.year}</span>}
                            {v.color && <span>{v.color}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="cust-section">
                <div className="cust-section-head">
                  <IconClaims size={15} /> Jobs <span className="cust-pill">{claims.length}</span>
                  {toneSegments.length > 0 && (
                    <div className="cust-tonebar" title="Job stages">
                      {toneSegments.map((s) => <span key={s.tone} className={`cust-toneseg ${s.tone}`} style={{ flex: s.n }} />)}
                    </div>
                  )}
                </div>
                {claims.length === 0 ? (
                  <div className="cust-empty-list">No jobs linked to this customer.</div>
                ) : (
                  <div className="table-scroll">
                    <table className="admin-table cust-jobs">
                      <thead>
                        <tr><th>DR Number</th><th>Status</th><th>Vehicle</th><th>Make</th><th>Type</th><th className="r">Approved</th><th>Branch</th><th>Created</th><th></th></tr>
                      </thead>
                      <tbody>
                        {claims.map((c) => (
                          <tr key={c.claimId} className="row-clickable" onClick={() => navigate(`/claim/${c.claimId}`)}>
                            <td>
                              <span className="cust-dr">{c.drNumber || '—'}</span>
                              {c.isUpsell && <span className="cust-tag amber">Upsell</span>}
                              {c.isWarranty && <span className="cust-tag violet">Warranty</span>}
                            </td>
                            <td><span className={`cust-status ${statusTone(c.status)}`}>{c.status || '—'}</span></td>
                            <td>{c.registration || '—'}</td>
                            <td>{c.make || '—'}</td>
                            <td className="cap">{c.jobType || '—'}</td>
                            <td className="r">{c.approvedValue ? money(c.approvedValue) : '—'}</td>
                            <td>{c.branchName || '—'}</td>
                            <td>{fmtDate(c.createdAt)}</td>
                            <td className="cust-open"><IconExternal size={15} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="cust-detail-empty">Couldn’t load this customer.</div>
          )}
        </div>
      </div>
    </div>
  )
}
