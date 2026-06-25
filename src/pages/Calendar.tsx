import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { getCalendarEvents, getCalendarJobsByDate, type CalendarData, type CalendarEvent, type CalendarEventType, type CalendarJobsData } from '../lib/api'
import { Loader } from '../components/Loader'
import { money } from '../lib/format'
import { IconChevron, IconCalendar, IconSearch } from '../components/icons'

const TYPE_META: Record<CalendarEventType, { label: string; cls: string }> = {
  new_claim: { label: 'New Claim', cls: 'blue' },
  status_change: { label: 'Status Change', cls: 'violet' },
  promised_date: { label: 'Promised Date', cls: 'amber' },
  collection_date: { label: 'Collection Date', cls: 'green' },
  booked_summary: { label: 'Booked', cls: 'booked' },
}
const TYPE_ORDER: CalendarEventType[] = ['new_claim', 'status_change', 'promised_date', 'collection_date', 'booked_summary']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-ZA', { hour: 'numeric', minute: '2-digit', hour12: true })
}
const compactZar = (n: number) => {
  if (n >= 1_000_000) return `R${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`
  if (n >= 1000) return `R${Math.round(n / 1000)}k`
  return `R${Math.round(n)}`
}

export function Calendar() {
  const { branchId } = useAuth()
  const navigate = useNavigate()
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [active, setActive] = useState<Set<CalendarEventType>>(new Set(['booked_summary']))
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [dayJobs, setDayJobs] = useState<CalendarJobsData | null>(null)
  const [jobsLoading, setJobsLoading] = useState(false)

  const monthStart = useMemo(() => dateKey(new Date(view.getFullYear(), view.getMonth(), 1)), [view])
  const monthEnd = useMemo(() => dateKey(new Date(view.getFullYear(), view.getMonth() + 1, 0)), [view])

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true); setErr(null)
      try {
        const d = await getCalendarEvents(branchId, monthStart, monthEnd)
        if (on) setData(d)
      } catch (e: unknown) {
        if (on) setErr(e instanceof Error ? e.message : 'Failed to load calendar')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [branchId, monthStart, monthEnd])

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!selected) { if (on) { setDayJobs(null); setJobsLoading(false) }; return }
      if (on) setJobsLoading(true)
      try {
        const d = await getCalendarJobsByDate(branchId, selected)
        if (on) setDayJobs(d)
      } catch {
        if (on) setDayJobs(null)
      } finally {
        if (on) setJobsLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [selected, branchId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.events ?? []).filter((e) => {
      if (!active.has(e.eventType)) return false
      if (!q) return true
      return [e.customerName, e.vehicleReg, e.roNumber, e.message, e.eventTitle].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [data, active, search])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of filtered) {
      if (!e.eventDate) continue
      if (!map.has(e.eventDate)) map.set(e.eventDate, [])
      map.get(e.eventDate)!.push(e)
    }
    for (const list of map.values()) list.sort((a, b) => a.eventTime.localeCompare(b.eventTime))
    return map
  }, [filtered])

  const cells = useMemo(() => {
    const y = view.getFullYear(), m = view.getMonth()
    const startWeekday = (new Date(y, m, 1).getDay() + 6) % 7 // Monday = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const weeks = Math.ceil((startWeekday + daysInMonth) / 7)
    const gridStart = new Date(y, m, 1 - startWeekday)
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(y, m, gridStart.getDate() + i))
  }, [view])

  const todayKey = dateKey(today)
  const selectedEvents = selected ? (byDay.get(selected) ?? []).filter((e) => e.eventType !== 'booked_summary') : []
  const bookedJobs = active.has('booked_summary') ? (dayJobs?.jobs ?? []) : []

  const toggle = (t: CalendarEventType) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  const counts: { type: CalendarEventType; n: number }[] = data ? [
    { type: 'new_claim', n: data.summary.newClaims },
    { type: 'status_change', n: data.summary.statusChanges },
    { type: 'promised_date', n: data.summary.promisedDates },
    { type: 'collection_date', n: data.summary.collectionDates },
    { type: 'booked_summary', n: data.summary.bookedClaims },
  ] : []

  return (
    <div className="page">
      <div className="page-head cal-head">
        <div>
          <h1>Calendar</h1>
          <div className="muted">Claim activity, promised &amp; collection dates and bookings</div>
        </div>
        <div className="cal-nav">
          <button className="cal-navbtn" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="Previous month">
            <IconChevron size={16} />
          </button>
          <span className="cal-month">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
          <button className="cal-navbtn flip" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label="Next month">
            <IconChevron size={16} />
          </button>
          <button className="cal-today" onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
        </div>
      </div>

      <div className="cal-toolbar">
        <div className="cal-filters">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              className={`cal-filter ${TYPE_META[t].cls}${active.has(t) ? ' on' : ''}`}
              onClick={() => toggle(t)}
            >
              <i className={`cal-dot ${TYPE_META[t].cls}`} />
              {TYPE_META[t].label}
              {counts.find((c) => c.type === t) && <span className="cal-filter-n">{counts.find((c) => c.type === t)!.n}</span>}
            </button>
          ))}
        </div>
        <div className="cal-search">
          <IconSearch size={15} />
          <input placeholder="Search customer, reg, RO…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="cal-card">
        {loading ? (
          <Loader label="Loading calendar…" />
        ) : err ? (
          <div className="empty">{err}</div>
        ) : (
          <>
            <div className="cal-weekrow">
              {WEEKDAYS.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
            </div>
            <div className="cal-grid">
              {cells.map((d) => {
                const key = dateKey(d)
                const inMonth = d.getMonth() === view.getMonth()
                const isToday = key === todayKey
                const dayEvents = byDay.get(key) ?? []
                const shown = dayEvents.slice(0, 3)
                const extra = dayEvents.length - shown.length
                return (
                  <button
                    key={key}
                    className={`cal-cell${inMonth ? '' : ' out'}${isToday ? ' today' : ''}`}
                    onClick={() => setSelected(key)}
                  >
                    <span className="cal-cell-num">{d.getDate()}</span>
                    <span className="cal-cell-events">
                      {shown.map((e, i) => (
                        e.eventType === 'booked_summary' ? (
                          <span key={i} className="cal-chip booked cal-chip-booked">
                            <span className="cal-booked-amt">{compactZar(e.totalApprovedValue)}</span>
                            <span className="cal-booked-sub">{e.bookedClaimsCount} job{e.bookedClaimsCount === 1 ? '' : 's'} booked</span>
                          </span>
                        ) : (
                          <span key={i} className={`cal-chip ${TYPE_META[e.eventType].cls}`}>
                            {e.customerName?.trim() || e.vehicleReg || e.roNumber || TYPE_META[e.eventType].label}
                          </span>
                        )
                      ))}
                      {extra > 0 && <span className="cal-more">+{extra} more</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="cal-modal-overlay" onClick={() => setSelected(null)}>
          <div className="cal-modal" onClick={(ev) => ev.stopPropagation()}>
            <div className="cal-modal-head">
              <div>
                <div className="cal-modal-title">{new Date(`${selected}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div className="cal-modal-sub">
                  {jobsLoading ? 'Loading…' : `${bookedJobs.length} booked job${bookedJobs.length === 1 ? '' : 's'}${dayJobs && dayJobs.totalApprovedValue > 0 ? ` · ${money(dayJobs.totalApprovedValue)} total approved` : ''}`}
                </div>
              </div>
              <button className="cal-modal-close" onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>

            <div className="cal-modal-body">
              {jobsLoading ? (
                <Loader label="Loading booked jobs…" />
              ) : bookedJobs.length === 0 && selectedEvents.length === 0 ? (
                <div className="cal-modal-empty">
                  <span className="cal-side-ic"><IconCalendar size={22} /></span>
                  <div className="cal-side-ptitle">No activity on this day</div>
                  <div className="cal-side-psub">No booked jobs or events match your filters.</div>
                </div>
              ) : (
                <>
                  {bookedJobs.length > 0 && (
                    <div className="cal-table-wrap">
                      <table className="admin-table cal-jobs-table">
                        <colgroup>
                          <col style={{ width: '90px' }} /><col style={{ width: '90px' }} /><col style={{ width: '62px' }} /><col style={{ width: '62px' }} />
                          <col style={{ width: '108px' }} /><col style={{ width: '112px' }} /><col style={{ width: '108px' }} />
                          <col style={{ width: '78px' }} /><col style={{ width: '90px' }} /><col style={{ width: '124px' }} />
                          <col style={{ width: '190px' }} /><col style={{ width: '112px' }} /><col style={{ width: '84px' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>DR Number</th><th>RO Number</th><th className="r">Aging</th><th className="r">DIP</th><th>Registration</th>
                            <th>Claim Status</th><th>Manufacturer</th><th>CSA</th><th>Insurer</th>
                            <th className="r">Approved Value</th><th>Customer</th><th>Contact</th><th className="r">Speed Shop</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookedJobs.map((j) => {
                            const na = (v: string) => (v && v !== 'N/A' ? v : '—')
                            return (
                              <tr key={j.claimId} className="row-clickable" onClick={() => navigate(`/claim/${j.claimId}`)}>
                                <td><span className="cal-dr-link">{na(j.drNumber)}</span></td>
                                <td>{na(j.roNumber)}</td>
                                <td className="r">{j.aging ?? '—'}</td>
                                <td className="r">{j.dip ?? '—'}</td>
                                <td title={na(j.registration)}>{na(j.registration)}</td>
                                <td><span className="cal-status-pill">{j.claimStatus || '—'}</span></td>
                                <td title={na(j.manufacturer)}>{na(j.manufacturer)}</td>
                                <td title={na(j.csa)}>{na(j.csa)}</td>
                                <td title={na(j.insurer)}>{na(j.insurer)}</td>
                                <td className="r cal-val">{money(j.approvedValue)}</td>
                                <td className="cal-cust" title={j.customer}>{na(j.customer)}</td>
                                <td title={na(j.contact)}>{na(j.contact)}</td>
                                <td className="r">{j.speedShop}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedEvents.length > 0 && (
                    <div className="cal-modal-events">
                      <div className="cal-jobs-head"><span className="cal-jobs-title">Other Activity</span></div>
                      <div className="cal-side-list">
                        {selectedEvents.map((e, i) => (
                          <button
                            key={`e-${i}`}
                            className={`cal-ev ${TYPE_META[e.eventType].cls}${e.claimId ? ' link' : ''}`}
                            onClick={() => e.claimId && navigate(`/claim/${e.claimId}`)}
                            disabled={!e.claimId}
                          >
                            <div className="cal-ev-top">
                              <span className={`cal-ev-tag ${TYPE_META[e.eventType].cls}`}>{TYPE_META[e.eventType].label}</span>
                              <span className="cal-ev-time">{fmtTime(e.eventTime)}</span>
                            </div>
                            <div className="cal-ev-title">{e.customerName?.trim() || 'Unknown customer'}</div>
                            <div className="cal-ev-meta">
                              {e.vehicleReg && e.vehicleReg !== 'N/A' ? e.vehicleReg : ''}
                              {e.roNumber && e.roNumber !== '0' ? `${e.vehicleReg && e.vehicleReg !== 'N/A' ? ' · ' : ''}RO ${e.roNumber}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
