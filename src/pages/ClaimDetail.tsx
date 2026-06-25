import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import {
  getClaimDetails, getClaimKeyDates, getClaimQuoteSummary, getClaimIssues, getClaimProgress,
  getStatusTransitions, updateClaimStatus, updateCustomerVehicle, updateClaimInsuranceDetails, updateClaimDamageReport,
  getVehicleMakes, getVehicleModels, getInsurers, getBrokersByInsurance, getClaimPriorityDetails, getClaimContactPrefs,
  getJobStaffDetails, updateClaimJobStaffDetails, getTowingCompanies, getStores, getNotProceedingReasons,
  getCsas, getEstimators, getPartsBuyers, getProductionStaff,
  getTmsFinancialData, updateFinancialData,
  getClaimFiles, uploadClaimFile, formatFileSize, UPLOAD_CATEGORIES,
  getModerationUploads, uploadModerationDocument, MODERATION_TYPES,
  getClaimPhotos, downloadPhotosZip,
  getClaimEventDates, updateClaimEventDates,
  getSystemChanges, getClaimTimeline, getAuditTrail, getClaimNotes, addClaimNote, deleteClaimNote,
  getFuelSlips, createFuelSlip, voidFuelSlip,
  createClaimIssue, resolveClaimIssue, deleteClaimIssue, ISSUE_SEVERITIES, ISSUE_TYPES,
  getLinkedClaims,
  getTmsParts, getTmsQuote, getTmsTotals, getTmsUploads, getTmsJobCard,
  type TmsPartsData, type TmsPart, type TmsQuote, type QuoteLineItem,
  type TmsTotals, type TmsTotalsSection, type TmsUploadFile,
  type TmsJobCard, type JobCardFlags,
  type ClaimEventDates, type FeedEntry, type ClaimNote, type FuelSlip, type LinkedClaim,
  type ClaimDetail as Claim, type ClaimKeyDates, type ClaimQuoteSummary, type ClaimIssue, type ClaimProgress,
  type Insurer, type Broker, type ClaimPriorityFlags,
  type IdName, type NotProceedingReason, type RoleMember, type FinancialData, type ClaimFile, type ModerationUpload,
  type ClaimPhoto,
} from '../lib/api'
import { useToast } from '../components/Toast'
import { printVoucher } from '../lib/fuelVoucher'
import { money } from '../lib/format'
import { Loader } from '../components/Loader'
import {
  IconChevron, IconBriefcase, IconCar, IconShield, IconHash, IconUser, IconBuilding,
  IconPalette, IconClock, IconMoney, IconAlert, IconBolt, IconCalendar, IconReports,
  IconDocuments, IconFilePdf, IconDashboard, IconClaims, IconCamera, IconFuel,
  IconAllocate, IconExternal, IconGauge, IconFlag, IconPlus, IconSearch, IconDownload, IconTrash, IconPrinter, IconLock,
} from '../components/icons'

import type { ReactNode, ComponentType, DragEvent, WheelEvent as RWheelEvent, MouseEvent as RMouseEvent } from 'react'

const TABS: { label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { label: 'Overview', Icon: IconDashboard },
  { label: 'Customer & Vehicle Details', Icon: IconUser },
  { label: 'Damage Report', Icon: IconAlert },
  { label: 'Job/Branch Details', Icon: IconBriefcase },
  { label: 'Financial Data', Icon: IconMoney },
  { label: 'Uploads', Icon: IconExternal },
  { label: 'Moderation', Icon: IconShield },
  { label: 'Photos', Icon: IconCamera },
  { label: 'Key Dates', Icon: IconCalendar },
  { label: 'Comments', Icon: IconDocuments },
  { label: 'TMS Parts Ord', Icon: IconClaims },
  { label: 'TMS Quote', Icon: IconFilePdf },
  { label: 'TMS Total', Icon: IconReports },
  { label: 'TMS Uploads', Icon: IconExternal },
  { label: 'Fuel Slips', Icon: IconFuel },
  { label: 'Job Card', Icon: IconFilePdf },
  { label: 'Issues', Icon: IconAlert },
  { label: 'Linked Jobs', Icon: IconAllocate },
]

function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: ReactNode }) {
  const resolved = value ?? 'N/A'
  const isEmpty = resolved === 'N/A' || resolved === '0'
  return (
    <div className={`cd-field${isEmpty ? ' is-empty' : ''}`}>
      {icon && <span className="cd-field-icon">{icon}</span>}
      <div className="cd-field-body">
        <div className="cd-field-label">{label}</div>
        <div className={`cd-field-value${isEmpty ? ' is-na' : ''}`}>{resolved}</div>
      </div>
    </div>
  )
}

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || String(v).trim() === '') return 'N/A'
  return String(v)
}

export function ClaimDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, branchId } = useAuth()

  const [claim, setClaim] = useState<Claim | null>(null)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('Overview')
  const [reloadKey, setReloadKey] = useState(0)
  const [unsaved, setUnsaved] = useState(false)

  // Warn on browser close/refresh while there are unsaved edits.
  useEffect(() => {
    if (!unsaved) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [unsaved])

  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null)
  const guard = (fn: () => void) => {
    if (!unsaved) { fn(); return }
    setPendingNav(() => fn)
  }
  const proceedNav = () => {
    const fn = pendingNav
    setPendingNav(null)
    setUnsaved(false)
    fn?.()
  }
  const switchTab = (label: string) => {
    if (label === tab) return
    guard(() => setTab(label))
  }

  const uid = profile?.id
  useEffect(() => {
    let on = true
    const run = async () => {
      if (!id || !uid) return
      // Only show the full-page loader when this claim isn't loaded yet (first
      // load or switching claims). Refetches for the same claim (status changes,
      // uploads, saves) refresh quietly so the page doesn't flash.
      if (!claim || claim.claim_id !== id) setLoading(true)
      setError(null)
      try {
        const c = await getClaimDetails(id, uid)
        if (on) setClaim(c)
        // Supplementary Overview endpoints — best-effort, never block the page.
        const [keyDates, quote, issues, progress] = await Promise.all([
          getClaimKeyDates(id).catch(() => null),
          getClaimQuoteSummary(id, uid).catch(() => null),
          getClaimIssues(id).catch(() => []),
          getClaimProgress(id).catch(() => null),
        ])
        const timeLeft = computeTimeLeft(keyDates)
        if (on) setOverview({ keyDates, quote, issues, progress, timeLeft })
      } catch (e: unknown) {
        if (on) setError(e instanceof Error ? e.message : 'Failed to load claim')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [id, uid, reloadKey])

  // Transition guards. Each returns a list of blocking issues; empty = allowed.
  const validateTransition = async (from: string | null, target: string): Promise<TransitionIssue[]> => {
    const issues: TransitionIssue[] = []
    if (!claim) return issues

    // Rule A: Drive-Quote Sent → Drive-Authorisation Received needs approved values.
    const fromQuoteSent = /drive[-\s]?quote\s*sent/i.test(from || '')
    const toAuthReceived = /authoris|authoriz/i.test(target) && /received/i.test(target)
    if (fromQuoteSent && toAuthReceived) {
      const drNo = parseInt(claim.dr_number ?? '', 10)
      if (!Number.isFinite(drNo)) {
        issues.push({ title: 'No DR number', detail: 'Cannot verify financial values for this claim.' })
        return issues
      }
      let fin: FinancialData | null = null
      try {
        fin = await getTmsFinancialData(claim.claim_id, drNo, branchId)
      } catch {
        issues.push({ title: 'Financial data unavailable', detail: 'Could not load financial data to validate this change. Please try again.' })
        return issues
      }
      if (!((fin?.approvedQuote ?? 0) > 0)) issues.push({ title: 'Approved Quote is 0', detail: 'Please import the Authorised quote into TMS.' })
      if (!((fin?.approvedParts ?? 0) > 0)) issues.push({ title: 'Approved Parts is 0', detail: 'Please import the Authorised quote into TMS.' })
      return issues
    }

    // Rule B: Parts Available - Contact Client → 100-Booked needs CSA + booking & promise dates.
    const fromPartsAvail = /parts available\s*-\s*contact client/i.test(from || '')
    const toBooked = /^100-?\s*booked/i.test(target.trim())
    if (fromPartsAvail && toBooked) {
      const csaName = claim.assigned_staff?.csa?.name
      if (!csaName || !String(csaName).trim()) {
        issues.push({ title: 'CSA not assigned', detail: 'Please assign a CSA in the Job/Branch Details tab to proceed.' })
      }
      let kd: ClaimEventDates | null = null
      try {
        kd = await getClaimEventDates(claim.claim_id)
      } catch {
        issues.push({ title: 'Could not load dates', detail: 'Unable to verify booking and promise dates. Please try again.' })
        return issues
      }
      if (!kd?.bookingDate || !String(kd.bookingDate).trim()) {
        issues.push({ title: 'Booking Date empty', detail: 'Please select a booking date in the Key Dates tab to proceed.' })
      }
      if (!kd?.promiseDate || !String(kd.promiseDate).trim()) {
        issues.push({ title: 'Promise Date empty', detail: 'Please select a promise date in the Key Dates tab to proceed.' })
      }
      return issues
    }

    return issues
  }

  if (loading) return <div className="page"><div className="table-card"><Loader label="Loading claim…" /></div></div>
  if (error || !claim) {
    const denied = /permission|access|denied/i.test(error ?? '')
    return (
      <div className="page">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="cd-denied">
          <svg className="cd-denied-art" viewBox="0 0 220 200" role="img" aria-label="No access">
            <defs>
              <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#1b3a6b" />
                <stop offset="1" stopColor="#b00830" />
              </linearGradient>
            </defs>
            <ellipse cx="110" cy="178" rx="66" ry="9" fill="rgba(16,24,40,0.06)" />
            <circle cx="110" cy="92" r="72" fill="#eef1f8" />
            <circle cx="44" cy="56" r="3.5" fill="#b00830" opacity="0.4" />
            <circle cx="182" cy="70" r="4.5" fill="#1b3a6b" opacity="0.3" />
            <circle cx="174" cy="140" r="3" fill="#b00830" opacity="0.35" />
            <path d="M85 90 v-16 a25 25 0 0 1 50 0 v16" fill="none" stroke="url(#dg)" strokeWidth="11" strokeLinecap="round" />
            <rect x="70" y="88" width="80" height="66" rx="14" fill="url(#dg)" />
            <circle cx="110" cy="114" r="9" fill="#fff" />
            <rect x="106" y="118" width="8" height="20" rx="4" fill="#fff" />
          </svg>
          <h2 className="cd-denied-title">{denied ? 'No access to this claim' : 'Claim not found'}</h2>
          <p className="cd-denied-sub">
            {denied
              ? 'This claim belongs to a branch you’re not currently in. Switch to its branch to view it, or head back.'
              : error ?? 'We couldn’t find this claim.'}
          </p>
          <div className="cd-denied-actions">
            <button className="btn-ghost" onClick={() => navigate(-1)}>← Go back</button>
            <button className="new-claim" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  const v = claim.vehicle_information
  const ins = claim.insurance_details
  const staff = claim.assigned_staff
  const warranty = v?.warranty
  const warrantyText = warranty === null || warranty === undefined ? 'N/A' : (warranty === false || warranty === 'false' ? 'NO' : warranty === true || warranty === 'true' ? 'YES' : String(warranty))

  return (
    <div className="page">
      <div className="cd-breadcrumb">
        <span onClick={() => guard(() => navigate('/dashboard'))}>Dashboard</span>
        <span>›</span>
        <span onClick={() => guard(() => navigate('/claims'))}>Claims</span>
        <span>›</span>
        <span className="cur">{claim.dr_number}</span>
      </div>

      <div className="cd-head">
        <button className="back-btn" onClick={() => guard(() => navigate(-1))} aria-label="Back">←</button>
        <h1 className="cd-title">{claim.dr_number || claim.claim_no}</h1>
        {claim.relationship && (() => {
          const isW = /warrant/i.test(claim.relationship)
          const isU = /upsell/i.test(claim.relationship)
          const RelIcon = isW ? IconShield : isU ? IconBolt : IconBriefcase
          const base = claim.relationship.toUpperCase()
          const label = /\bJOB\b/.test(base) ? base : `${base} JOB`
          return (
            <span className={`cd-rel${isW ? ' warranty' : isU ? ' upsell' : ''}`}>
              <RelIcon size={14} />
              {label}
            </span>
          )
        })()}
        <StatusControl
          claimId={claim.claim_id}
          current={claim.status}
          userId={profile?.id ?? ''}
          userType={profile?.role ?? 'USER'}
          onChanged={() => setReloadKey((k) => k + 1)}
          disabled={/upsell/i.test(claim.relationship || '')}
          disabledReason="Status follows the main job"
          validateTransition={validateTransition}
          hint={/preliminary conversion/i.test(claim.status || '')
            ? 'Upload a quote in the Moderation tab to initiate the moderation process.'
            : undefined}
        />
      </div>

      <div className="cd-panel">
        <div className="cd-col">
          <div className="cd-col-title"><span className="cd-col-icon job"><IconBriefcase size={16} /></span> Job Information</div>
          <Field icon={<IconHash size={16} />} label="DR Number" value={val(claim.dr_number)} />
          <Field icon={<IconHash size={16} />} label="RO Number" value={val(claim.ro_number)} />
          <Field icon={<IconCar size={16} />} label="Job Type" value={claim.job_type ? claim.job_type.toUpperCase() : 'N/A'} />
          <Field icon={<IconShield size={16} />} label="Under Manufacturer Warranty" value={warrantyText} />
          <Field icon={<IconUser size={16} />} label="CSA" value={val(staff?.csa?.name)} />
          <Field icon={<IconUser size={16} />} label="Estimator" value={val(staff?.estimator?.name)} />
        </div>

        <div className="cd-col">
          <div className="cd-col-title"><span className="cd-col-icon veh"><IconCar size={16} /></span> Vehicle Information</div>
          <Field icon={<IconCar size={16} />} label="Make" value={val(v?.make)} />
          <Field icon={<IconCar size={16} />} label="Model" value={val(v?.model)} />
          <Field icon={<IconCalendar size={16} />} label="Year" value={val(v?.year)} />
          <Field icon={<IconHash size={16} />} label="Registration" value={val(v?.license_plate)} />
          <Field icon={<IconHash size={16} />} label="VIN" value={val(v?.vin)} />
          <Field icon={<IconPalette size={16} />} label="Colour" value={val(v?.color)} />
        </div>

        <div className="cd-col">
          <div className="cd-col-title"><span className="cd-col-icon ins"><IconShield size={16} /></span> Insurance Details</div>
          <Field icon={<IconBuilding size={16} />} label="Insurance Company" value={val(ins?.company_name)} />
          <Field icon={<IconUser size={16} />} label="Insurance Broker" value={val(ins?.broker_name)} />
          <Field icon={<IconFilePdf size={16} />} label="Policy Number" value={val(ins?.policy_no)} />
          <Field icon={<IconHash size={16} />} label="Insurance Claim Number" value={val(ins?.insurer_claim_no)} />
        </div>
      </div>

      <div className="cd-tabs">
        {TABS.filter((t) => t.label !== 'Fuel Slips' || profile?.canFuelSlips).map(({ label, Icon }) => (
          <button key={label} className={`cd-tab${tab === label ? ' active' : ''}`} onClick={() => switchTab(label)}>
            <span className="cd-tab-ic"><Icon size={15} /></span>
            {label}
          </button>
        ))}
      </div>

      {tab === 'Overview' ? (
        <Overview claim={claim} data={overview} />
      ) : tab === 'Customer & Vehicle Details' ? (
        <CustomerVehicleTab
          claim={claim}
          userId={profile?.id ?? ''}
          onDirtyChange={setUnsaved}
          onSaved={() => { setUnsaved(false); setReloadKey((k) => k + 1) }}
        />
      ) : tab === 'Damage Report' ? (
        <DamageReportTab
          claim={claim}
          userId={profile?.id ?? ''}
          onDirtyChange={setUnsaved}
          onSaved={() => { setUnsaved(false); setReloadKey((k) => k + 1) }}
        />
      ) : tab === 'Job/Branch Details' ? (
        <JobStaffTab
          claim={claim}
          userId={profile?.id ?? ''}
          onDirtyChange={setUnsaved}
          onSaved={() => { setUnsaved(false); setReloadKey((k) => k + 1) }}
        />
      ) : tab === 'Financial Data' ? (
        <FinancialTab
          claim={claim}
          userId={profile?.id ?? ''}
          onDirtyChange={setUnsaved}
          onSaved={() => { setUnsaved(false); setReloadKey((k) => k + 1) }}
        />
      ) : tab === 'Uploads' ? (
        <UploadsTab claim={claim} userId={profile?.id ?? ''} onChanged={() => setReloadKey((k) => k + 1)} />
      ) : tab === 'Moderation' ? (
        <ModerationTab claim={claim} userId={profile?.id ?? ''} onChanged={() => setReloadKey((k) => k + 1)} />
      ) : tab === 'Photos' ? (
        <PhotosTab claim={claim} />
      ) : tab === 'Key Dates' ? (
        <KeyDatesTab
          claim={claim}
          userId={profile?.id ?? ''}
          onDirtyChange={setUnsaved}
          onSaved={() => { setUnsaved(false); setReloadKey((k) => k + 1) }}
        />
      ) : tab === 'Comments' ? (
        <CommentsTab claim={claim} userId={profile?.id ?? ''} />
      ) : tab === 'Fuel Slips' && profile?.canFuelSlips ? (
        <FuelSlipsTab claim={claim} branchId={branchId ?? ''} isAdmin={!!profile?.isAdmin} />
      ) : tab === 'Issues' ? (
        <IssuesTab claim={claim} isAdmin={!!profile?.isAdmin} />
      ) : tab === 'Linked Jobs' ? (
        <LinkedJobsTab claim={claim} />
      ) : tab === 'TMS Parts Ord' ? (
        <TmsPartsTab claim={claim} />
      ) : tab === 'TMS Quote' ? (
        <TmsQuoteTab claim={claim} />
      ) : tab === 'TMS Total' ? (
        <TmsTotalsTab claim={claim} />
      ) : tab === 'TMS Uploads' ? (
        <TmsUploadsTab claim={claim} />
      ) : tab === 'Job Card' ? (
        <JobCardTab claim={claim} />
      ) : (
        <div className="cd-tab-body">
          <div className="empty">🚧 {tab} — coming soon.</div>
        </div>
      )}

      {pendingNav && (
        <div className="modal-overlay" onClick={() => setPendingNav(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Unsaved changes</div>
            <div className="modal-body">
              <p>You have unsaved changes on this claim. If you leave now, your changes will be lost.</p>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-right">
                <button className="btn-ghost" onClick={() => setPendingNav(null)}>Stay on page</button>
                <button className="btn-danger" onClick={proceedNav}>Leave without saving</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A'
  const dateOnly = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const d = dateOnly ? new Date(`${iso}T00:00:00`) : new Date(iso)
  if (isNaN(d.getTime())) return 'N/A'
  const p = (n: number) => String(n).padStart(2, '0')
  const datePart = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
  const hasTime = typeof iso === 'string' ? /[T ]\d{2}:\d{2}/.test(iso) : true
  return hasTime ? `${datePart} ${p(d.getHours())}:${p(d.getMinutes())}` : datePart
}
const m = (n: number | null | undefined) => (n ? money(n) : 'N/A')

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`cd-toggle${on ? ' on' : ''}`}>
      <span className="cd-toggle-knob" />
    </span>
  )
}

function DateRow({ label, value }: { label: string; value: string }) {
  const set = value !== 'N/A'
  return (
    <div className="cd-date-row">
      <span className={`cd-date-dot${set ? ' on' : ''}`}>{set ? '✓' : '○'}</span>
      <span className="cd-date-label">{label}</span>
      <span className="cd-date-value">{value}</span>
    </div>
  )
}

function CField({
  label, value, onChange, required, error, readOnly, maxLength, digitsOnly, placeholder,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  required?: boolean
  error?: string
  readOnly?: boolean
  maxLength?: number
  digitsOnly?: boolean
  placeholder?: string
}) {
  const handle = (raw: string) => {
    let v = raw
    if (digitsOnly) v = v.replace(/\D/g, '')
    if (maxLength != null) v = v.slice(0, maxLength)
    onChange?.(v)
  }
  const ph = readOnly ? undefined : (placeholder ?? `Enter ${label.toLowerCase()}`)
  return (
    <label className="field">
      <span>{label}{required && <span className="req">*</span>}</span>
      <input
        value={value}
        onChange={(e) => handle(e.target.value)}
        readOnly={readOnly}
        maxLength={maxLength}
        inputMode={digitsOnly ? 'numeric' : undefined}
        placeholder={ph}
        className={error ? 'field-invalid' : undefined}
      />
      {error && <span className="field-err">{error}</span>}
    </label>
  )
}

// ---- South African public holidays + working-day calc ----
function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(y, month - 1, day)
}
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const _holCache: Record<number, Set<string>> = {}
function saHolidays(year: number): Set<string> {
  if (_holCache[year]) return _holCache[year]
  const set = new Set<string>()
  const add = (mo: number, da: number) => set.add(isoDay(new Date(year, mo - 1, da)))
  // Fixed-date public holidays
  ;[[1, 1], [3, 21], [4, 27], [5, 1], [6, 16], [8, 9], [9, 24], [12, 16], [12, 25], [12, 26]].forEach(([mo, da]) => add(mo, da))
  // Easter-based
  const easter = easterSunday(year)
  const gf = new Date(easter); gf.setDate(easter.getDate() - 2)   // Good Friday
  const fam = new Date(easter); fam.setDate(easter.getDate() + 1) // Family Day
  set.add(isoDay(gf)); set.add(isoDay(fam))
  // Any holiday on a Sunday is observed the following Monday
  const observed: string[] = []
  set.forEach((s) => { const d = new Date(`${s}T00:00:00`); if (d.getDay() === 0) { const mon = new Date(d); mon.setDate(d.getDate() + 1); observed.push(isoDay(mon)) } })
  observed.forEach((o) => set.add(o))
  _holCache[year] = set
  return set
}

// Working days from today (exclusive) to the target date (inclusive), excluding
// weekends and SA public holidays.
function workingDaysFromToday(target: string): number {
  if (!target) return 0
  const end = new Date(`${target}T00:00:00`)
  if (isNaN(end.getTime())) return 0
  const cur = new Date(); cur.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  if (end <= cur) return 0
  let count = 0
  while (cur < end) {
    cur.setDate(cur.getDate() + 1)
    const day = cur.getDay()
    if (day === 0 || day === 6) continue
    if (saHolidays(cur.getFullYear()).has(isoDay(cur))) continue
    count++
  }
  return count
}

const DP_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DP_WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const dp2 = (n: number) => String(n).padStart(2, '0')

function DatePicker({ label, value, onChange, disabled, minToday = true }: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  minToday?: boolean
}) {
  const [open, setOpen] = useState(false)
  const sel = value ? new Date(`${value}T00:00:00`) : null
  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const [view, setView] = useState(() => {
    const base = sel ?? today
    return { y: base.getFullYear(), m: base.getMonth() }
  })

  const startOffset = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))
  const dayDisabled = (d: number) => minToday && new Date(view.y, view.m, d) < today
  const isSel = (d: number) => !!sel && sel.getFullYear() === view.y && sel.getMonth() === view.m && sel.getDate() === d
  const isToday = (d: number) => today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d
  const pick = (d: number) => { onChange(`${view.y}-${dp2(view.m + 1)}-${dp2(d)}`); setOpen(false) }
  const display = sel ? `${dp2(sel.getDate())} ${DP_MONTHS[sel.getMonth()].slice(0, 3)} ${sel.getFullYear()}` : ''

  return (
    <div className="field">
      <span>{label}</span>
      <div className="dp">
        <button
          type="button"
          className="dp-control"
          disabled={disabled}
          onClick={() => { if (disabled) return; if (sel) setView({ y: sel.getFullYear(), m: sel.getMonth() }); setOpen((o) => !o) }}
        >
          <span className={display ? '' : 'cbx-placeholder'}>{display || 'Select date…'}</span>
          <IconCalendar size={16} />
        </button>
        {open && !disabled && (
          <>
            <div className="cbx-backdrop" onClick={() => setOpen(false)} />
            <div className="dp-panel">
              <div className="dp-head">
                <button type="button" onClick={prevMonth} aria-label="Previous month">‹</button>
                <span>{DP_MONTHS[view.m]} {view.y}</span>
                <button type="button" onClick={nextMonth} aria-label="Next month">›</button>
              </div>
              <div className="dp-wd">{DP_WD.map((w) => <span key={w}>{w}</span>)}</div>
              <div className="dp-grid">
                {cells.map((d, i) => d == null
                  ? <span key={i} className="dp-empty" />
                  : (
                    <button
                      key={i}
                      type="button"
                      className={`dp-day${isSel(d) ? ' sel' : ''}${isToday(d) ? ' today' : ''}`}
                      disabled={dayDisabled(d)}
                      onClick={() => pick(d)}
                    >
                      {d}
                    </button>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KeyDatesTab({ claim, userId, onDirtyChange, onSaved }: { claim: Claim; userId: string; onDirtyChange: (d: boolean) => void; onSaved: () => void }) {
  const toast = useToast()
  const [data, setData] = useState<ClaimEventDates | null>(null)
  const [form, setForm] = useState<Record<string, string> | null>(null)
  const [initialJSON, setInitialJSON] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const dpart = (v: string | null) => (v ? v.slice(0, 10) : '')

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const d = await getClaimEventDates(claim.claim_id)
        if (!on) return
        setData(d)
        if (d) {
          const f = {
            bookingDate: dpart(d.bookingDate),
            promiseDays: d.promiseDays != null ? String(d.promiseDays) : '',
            promiseDate: dpart(d.promiseDate),
            dateConverted: dpart(d.dateConverted),
            expectedFinishDate: dpart(d.expectedFinishDate),
            expectedCollectionDate: dpart(d.expectedCollectionDate),
          }
          setForm(f)
          setInitialJSON(JSON.stringify(f))
        }
      } catch {
        if (on) setData(null)
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id])

  const dirty = !!form && JSON.stringify(form) !== initialJSON
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  if (loading) return <div className="cd-tab-body"><Loader label="Loading dates…" /></div>
  if (!data || !form) return <div className="cd-tab-body"><div className="empty">Could not load claim dates.</div></div>
  const f = form
  const disabled = data.editingDisabled
  const set = (k: string) => (v: string) => setForm((p) => (p ? { ...p, [k]: v } : p))
  const onPromiseDate = (v: string) =>
    setForm((p) => (p ? {
      ...p,
      promiseDate: v,
      promiseDays: v ? String(workingDaysFromToday(v)) : '',
      expectedFinishDate: v || p.expectedFinishDate,
    } : p))

  const save = async () => {
    if (!dirty || disabled) return
    setSaving(true)
    try {
      await updateClaimEventDates(claim.claim_id, userId, f)
      toast('Dates saved', 'success')
      onSaved()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconCalendar size={18} /></span>
            <div>
              <div className="cv-card-title">Key Dates</div>
              <div className="cv-card-sub">Booking, promise and conversion dates</div>
            </div>
          </div>
          {!disabled && (
            <div className="cv-save-area">
              {dirty && <span className="cv-flag ok">✓ Ready to save</span>}
              <button className="new-claim" onClick={save} disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
        {disabled && (
          <div className="cv-note">
            <span className="cv-note-ic">ⓘ</span>
            <span>{data.editingDisabledMessage || 'Editing of dates is currently disabled for this claim.'}</span>
          </div>
        )}
        <div className="form-grid" style={disabled ? { marginTop: 14 } : undefined}>
          <DatePicker label="Booking Date" value={f.bookingDate} onChange={set('bookingDate')} disabled={disabled} />
          <DatePicker label="Promise Date" value={f.promiseDate} onChange={onPromiseDate} disabled={disabled} />
          <CField label="Promise Days (working days)" value={f.promiseDays} onChange={() => {}} readOnly placeholder="Auto from promise date" />
          <DatePicker label="Date Converted" value={f.dateConverted} onChange={set('dateConverted')} disabled={disabled} />
          <DatePicker label="Expected Finish Date (auto)" value={f.expectedFinishDate} onChange={() => {}} disabled />

          <DatePicker label="Expected Collection Date" value={f.expectedCollectionDate} onChange={set('expectedCollectionDate')} disabled={disabled} />
        </div>
      </section>
    </div>
  )
}

function TArea({
  label, value, onChange, required, error, rows = 4, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  error?: string
  rows?: number
  placeholder?: string
}) {
  return (
    <label className="field">
      <span>{label}{required && <span className="req">*</span>}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
        className={error ? 'field-invalid' : undefined}
      />
      {error && <span className="field-err">{error}</span>}
    </label>
  )
}

function SelectField({
  label, value, onChange, options, required, error, disabled, placeholder, allowUnknown = true,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean
  error?: string
  disabled?: boolean
  placeholder?: string
  allowUnknown?: boolean
}) {
  // Keep an out-of-list current value selectable so we never silently drop data,
  // unless allowUnknown is false (then an unknown value shows as the placeholder).
  const hasCurrent = !allowUnknown || !value || options.some((o) => o.value === value)
  return (
    <label className="field">
      <span>{label}{required && <span className="req">*</span>}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={error ? 'field-invalid' : undefined}
      >
        <option value="">{placeholder ?? 'Select…'}</option>
        {!hasCurrent && <option value={value}>{value}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span className="field-err">{error}</span>}
    </label>
  )
}

function Combobox({
  label, value, onChange, options, required, error, disabled, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  required?: boolean
  error?: string
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { shown, total } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q ? options.filter((o) => o.toLowerCase().includes(q)) : options
    return { shown: base.slice(0, 60), total: base.length }
  }, [options, query])

  return (
    <div className="field">
      <span>{label}{required && <span className="req">*</span>}</span>
      <div className="cbx">
        <button
          type="button"
          className={`cbx-control${error ? ' field-invalid' : ''}`}
          disabled={disabled}
          onClick={() => { setOpen((o) => !o); setQuery('') }}
        >
          <span className={value ? '' : 'cbx-placeholder'}>{value || placeholder || 'Select…'}</span>
          <IconChevron size={16} />
        </button>
        {open && !disabled && (
          <>
            <div className="cbx-backdrop" onClick={() => setOpen(false)} />
            <div className="cbx-panel">
              <input
                className="cbx-search"
                autoFocus
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="cbx-list">
                {shown.length === 0 ? (
                  <div className="cbx-empty">No matches</div>
                ) : (
                  shown.map((o) => (
                    <button
                      type="button"
                      key={o}
                      className={`cbx-opt${o === value ? ' sel' : ''}`}
                      onClick={() => { onChange(o); setOpen(false) }}
                    >
                      {o}
                    </button>
                  ))
                )}
                {total > shown.length && (
                  <div className="cbx-more">Showing {shown.length} of {total} — keep typing to narrow…</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {error && <span className="field-err">{error}</span>}
    </div>
  )
}

function MultiChips({
  label, options, selected, onToggle,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="cv-chips">
        {options.map((o) => {
          const on = selected.includes(o)
          return (
            <button
              key={o}
              type="button"
              className={`cv-chip${on ? ' on' : ''}`}
              onClick={() => onToggle(o)}
            >
              {on && <span className="cv-chip-tick">✓</span>}{o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SwitchRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="cv-switch cv-switch-btn" onClick={onToggle}>
      <span>{label}</span>
      <Toggle on={on} />
    </button>
  )
}

const isDigits = (s: string) => /^\d+$/.test(s.trim())

const SEVERITY_OPTS = ['Minor', 'Moderate', 'Severe', 'Write-off']
const UPSELL_STATUS_OPTS = [
  'Upsell Requested', 'Client Contacted - Accepted', 'Client not Reachable',
  'No Upsell Required', 'No Action',
]
const TITLE_OPTS = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr']
const CONTACT_OPTS = ['WhatsApp', 'SMS', 'Phone', 'Email', 'Text']
// Years from current year down to 1970 (computed once at module load).
const YEAR_OPTS: string[] = (() => {
  const now = new Date().getFullYear()
  const ys: string[] = []
  for (let y = now; y >= 1970; y--) ys.push(String(y))
  return ys
})()

function parsePrefs(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((t) => CONTACT_OPTS.find((o) => o.toLowerCase() === t.trim().toLowerCase())).filter((o): o is string => !!o)
  }
  if (typeof raw !== 'string' || !raw) return []
  return raw
    .split(/[,;/|]+/)
    .map((t) => t.trim())
    .map((t) => CONTACT_OPTS.find((o) => o.toLowerCase() === t.toLowerCase()))
    .filter((o): o is string => !!o)
}

function CustomerVehicleTab({ claim, userId, onDirtyChange, onSaved }: { claim: Claim; userId: string; onDirtyChange: (d: boolean) => void; onSaved: () => void }) {
  const toast = useToast()
  const c = claim.customer_information
  const v = claim.vehicle_information
  const ins = claim.insurance_details
  const ai = claim.additional_info
  const w = v?.warranty
  const warrantyInit = w === true || w === 'true' || w === 'YES' || w === 'Yes'

  const initialForm = {
    salutation: c?.salutation ?? '',
    firstname: c?.first_name ?? '',
    lastname: c?.last_name ?? '',
    email: c?.email ?? '',
    mobile: c?.mobile ?? '',
    altPhone: c?.phone ?? '',
    make: v?.make ?? '',
    model: v?.model ?? '',
    year: v?.year != null ? String(v.year) : '',
    color: v?.color ?? '',
    vin: v?.vin ?? '',
    registration: v?.license_plate ?? '',
    mmCode: v?.mm_code != null ? String(v.mm_code) : '',
    mileage: v?.mileage != null ? String(v.mileage) : '',
    company: ins?.company_name ?? '',
    broker: ins?.broker_name ?? '',
    policyNo: ins?.policy_no != null ? String(ins.policy_no) : '',
    insurerClaimNo: ins?.insurer_claim_no != null ? String(ins.insurer_claim_no) : '',
  }
  const [flags, setFlags] = useState<ClaimPriorityFlags | null>(null)
  const initialToggles = {
    warranty: warrantyInit,
    speedshop: flags?.speedshop ?? (ai?.speed_shop === 'Yes'),
    priority: flags?.priority ?? !!claim.priority,
    vip: !!ai?.vip_client,
    bumper: flags?.bumper ?? false,
    backorder: flags?.backorder ?? false,
    rental: flags?.rental ?? false,
    bag: flags?.bag ?? false,
  }
  const [seededPrefs, setSeededPrefs] = useState<string[] | null>(null)
  const initialPrefs = seededPrefs ?? parsePrefs(c?.preferred_contact)
  const [form, setForm] = useState(initialForm)
  const [toggles, setToggles] = useState(initialToggles)
  const [contactPrefs, setContactPrefs] = useState<string[]>(parsePrefs(c?.preferred_contact))
  const [saving, setSaving] = useState(false)

  // Dropdown option sources
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [insurers, setInsurers] = useState<Insurer[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [brokersLoading, setBrokersLoading] = useState(false)
  const [insurerId, setInsurerId] = useState('')

  const set = (k: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [k]: val }))
  const tog = (k: keyof typeof toggles) => () => setToggles((t) => ({ ...t, [k]: !t[k] }))
  const togglePref = (v: string) =>
    setContactPrefs((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))
  const onInsurerChange = (name: string) => {
    setForm((f) => ({ ...f, company: name, broker: '' }))
    const m = insurers.find((i) => i.name === name)
    setInsurerId(m ? m.id : '')
  }
  const onMakeChange = (make: string) => setForm((f) => ({ ...f, make, model: '' }))

  // Load makes + insurers once; preselect the insurer matching the saved company.
  useEffect(() => {
    let on = true
    const run = async () => {
      const [mk, inss] = await Promise.all([
        getVehicleMakes().catch(() => []),
        getInsurers().catch(() => []),
      ])
      if (!on) return
      setMakes(mk)
      setInsurers(inss)
      const match = inss.find((i) => i.name.toLowerCase() === (initialForm.company || '').toLowerCase())
      if (match) setInsurerId(match.id)
    }
    void run()
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load the stored special-handling flags and seed the toggles (they aren't in get_claim_details).
  useEffect(() => {
    let on = true
    const run = async () => {
      const [f, prefsRaw] = await Promise.all([
        getClaimPriorityDetails(claim.claim_id).catch(() => null),
        getClaimContactPrefs(claim.claim_id).catch(() => ''),
      ])
      if (!on) return
      if (f) {
        setFlags(f)
        setToggles((t) => ({
          ...t,
          speedshop: f.speedshop,
          priority: f.priority,
          bumper: f.bumper,
          backorder: f.backorder,
          rental: f.rental,
          bag: f.bag,
        }))
      }
      const prefs = parsePrefs(prefsRaw)
      setSeededPrefs(prefs)
      setContactPrefs(prefs)
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id])

  // Load models for the current make.
  useEffect(() => {
    let on = true
    const run = async () => {
      const mdl = await getVehicleModels(form.make).catch(() => [])
      if (on) setModels(mdl)
    }
    void run()
    return () => { on = false }
  }, [form.make])

  // Load brokers for the selected insurer.
  useEffect(() => {
    let on = true
    const run = async () => {
      if (!insurerId) { setBrokers([]); setBrokersLoading(false); return }
      setBrokersLoading(true)
      const bks = await getBrokersByInsurance(insurerId).catch(() => [])
      if (on) { setBrokers(bks); setBrokersLoading(false) }
    }
    void run()
    return () => { on = false }
  }, [insurerId])

  const noBrokers = !!insurerId && !brokersLoading && brokers.length === 0

  // Only validate / show banner once the user has actually changed something.
  const dirty =
    JSON.stringify(form) !== JSON.stringify(initialForm) ||
    JSON.stringify(contactPrefs) !== JSON.stringify(initialPrefs) ||
    JSON.stringify(toggles) !== JSON.stringify(initialToggles)

  // Report unsaved-changes state up so the parent can guard navigation.
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  // Field validation (required + format)
  const tFirst = form.firstname.trim()
  const tLast = form.lastname.trim()
  const tEmail = form.email.trim()
  const tVin = form.vin.trim()
  const mobileDigits = form.mobile.replace(/\D/g, '')
  const altDigits = form.altPhone.replace(/\D/g, '')
  const nameRe = /^[A-Za-z][A-Za-z\s'.-]*$/
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const vinRe = /^[A-HJ-NPR-Z0-9]{17}$/i

  const fieldErr = {
    salutation: !form.salutation.trim() ? 'Title is required' : '',
    firstname: !tFirst ? 'Firstname is required' : !nameRe.test(tFirst) ? 'Firstname must be a valid name (no numbers)' : '',
    lastname: !tLast ? 'Surname is required' : !nameRe.test(tLast) ? 'Surname must be a valid name (no numbers)' : '',
    email: !tEmail ? 'Email address is required' : !emailRe.test(tEmail) ? 'Enter a valid email address' : '',
    mobile: !form.mobile.trim() ? 'Cell phone number is required' : mobileDigits.length !== 10 ? 'Cell phone number must be 10 digits' : '',
    altPhone: form.altPhone.trim() && altDigits.length !== 10 ? 'Alternative phone must be 10 digits' : '',
    make: !form.make.trim() ? 'Make is required' : '',
    model: !form.model.trim() ? 'Model is required' : '',
    vin: !tVin ? 'VIN number is required' : !vinRe.test(tVin) ? 'VIN must be 17 characters and exclude I, O, Q' : '',
    registration: !form.registration.trim() ? 'Registration is required' : '',
  }
  const errors = Object.values(fieldErr).filter(Boolean)
  const valid = errors.length === 0
  // Only surface a field's error message once the user has edited something.
  const errOf = (err: string) => (dirty && err ? err : undefined)

  const save = async () => {
    if (!dirty || !valid) return
    setSaving(true)
    try {
      await updateCustomerVehicle(claim.claim_id, {
        customer: {
          salutation: form.salutation,
          firstname: form.firstname,
          lastname: form.lastname,
          email: form.email,
          mobile: form.mobile,
          alternative_phone: form.altPhone,
          communication_preferences: { preferred: contactPrefs.join(', ') },
        },
        vehicle: {
          make: form.make,
          model: form.model,
          year: isDigits(form.year) ? form.year : '',
          color: form.color,
          vin: form.vin,
          registration: form.registration,
          mm_code: isDigits(form.mmCode) ? form.mmCode : '',
          mileage: isDigits(form.mileage) ? form.mileage : '',
          warranty: toggles.warranty,
        },
        priority: {
          speedshop_job: toggles.speedshop,
          targeted_priority: toggles.priority,
          vip_client: toggles.vip,
          bumper_repair_only: toggles.bumper,
          backorder: toggles.backorder,
          bag: toggles.bag,
        },
        claimDetails: { rental_car: toggles.rental },
      })
      // Insurance is saved separately (uses insurer/broker IDs from the dropdowns).
      const selectedBroker = brokers.find((b) => b.name === form.broker)
      await updateClaimInsuranceDetails(claim.claim_id, userId, {
        insuranceCompanyId: insurerId,
        brokerId: selectedBroker?.legacyId ?? null,
        brokerName: form.broker,
        policyNo: form.policyNo,
        insurerClaimNo: form.insurerClaimNo,
      })
      toast('Changes saved', 'success')
      onSaved()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save changes', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconUser size={18} /></span>
            <div>
              <div className="cv-card-title">Client Information</div>
              <div className="cv-card-sub">Customer details and contact information</div>
            </div>
          </div>
          <div className="cv-save-area">
            {dirty && (
              valid ? (
                <span className="cv-flag ok">✓ Ready to save</span>
              ) : (
                <span className="cv-flag err" title={errors.join('\n')}>
                  {errors.length} field{errors.length > 1 ? 's' : ''} need attention
                </span>
              )
            )}
            <button className="new-claim" onClick={save} disabled={saving || !dirty || !valid}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
        <SelectField
          label="Title"
          value={form.salutation}
          onChange={set('salutation')}
          options={TITLE_OPTS.map((t) => ({ value: t, label: t }))}
          required
          error={errOf(fieldErr.salutation)}
          placeholder="Select title…"
        />
        <div className="form-grid">
          <CField label="First Name" value={form.firstname} onChange={set('firstname')} required error={errOf(fieldErr.firstname)} />
          <CField label="Surname" value={form.lastname} onChange={set('lastname')} required error={errOf(fieldErr.lastname)} />
          <CField label="Email Address" value={form.email} onChange={set('email')} required error={errOf(fieldErr.email)} />
          <CField label="Cell Phone Number" value={form.mobile} onChange={set('mobile')} required error={errOf(fieldErr.mobile)} digitsOnly maxLength={10} />
          <CField label="Alternative Phone" value={form.altPhone} onChange={set('altPhone')} error={errOf(fieldErr.altPhone)} digitsOnly maxLength={10} />
        </div>
        <MultiChips label="Contact Preference" options={CONTACT_OPTS} selected={contactPrefs} onToggle={togglePref} />
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic green"><IconCar size={18} /></span>
            <div>
              <div className="cv-card-title">Vehicle Details</div>
              <div className="cv-card-sub">Vehicle information and identification</div>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <Combobox
            label="Make"
            value={form.make}
            onChange={onMakeChange}
            options={makes}
            required
            error={errOf(fieldErr.make)}
            placeholder="Select make…"
          />
          <Combobox
            label="Model"
            value={form.model}
            onChange={set('model')}
            options={models}
            required
            error={errOf(fieldErr.model)}
            disabled={!form.make}
            placeholder={form.make ? 'Select model…' : 'Select make first'}
          />
          <SelectField label="Year" value={form.year} onChange={set('year')} options={YEAR_OPTS.map((y) => ({ value: y, label: y }))} placeholder="Select year…" />
          <CField label="Color" value={form.color} onChange={set('color')} />
          <CField label="VIN Number" value={form.vin} onChange={set('vin')} required error={errOf(fieldErr.vin)} maxLength={17} />
          <CField label="Registration" value={form.registration} onChange={set('registration')} required error={errOf(fieldErr.registration)} />
          <CField label="MM Code" value={form.mmCode} onChange={set('mmCode')} />
          <CField label="Mileage" value={form.mileage} onChange={set('mileage')} />
        </div>
        <button type="button" className="cv-switch cv-switch-btn" style={{ marginTop: 14 }} onClick={tog('warranty')}>
          <span>Under Manufacturer Warranty</span>
          <Toggle on={toggles.warranty} />
        </button>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic violet"><IconShield size={18} /></span>
            <div>
              <div className="cv-card-title">Insurance Details</div>
              <div className="cv-card-sub">Policy and insurer information</div>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <Combobox
            label="Insurance Company"
            value={form.company}
            onChange={onInsurerChange}
            options={insurers.map((i) => i.name)}
            placeholder="Select insurer…"
          />
          <Combobox
            label="Broker"
            value={form.broker}
            onChange={set('broker')}
            options={brokers.map((b) => b.name)}
            disabled={!insurerId || noBrokers}
            placeholder={!insurerId ? 'Select insurer first' : noBrokers ? 'No linked brokers' : 'Select broker…'}
          />
          <CField label="Insurance Policy Number" value={form.policyNo} onChange={set('policyNo')} />
          <CField label="Insurance Claim Number" value={form.insurerClaimNo} onChange={set('insurerClaimNo')} />
        </div>
        {noBrokers && (
          <div className="cv-note">
            <span className="cv-note-ic">ⓘ</span>
            <span>This insurance company has no linked brokers. You may proceed without selecting a broker or choose a different insurer.</span>
          </div>
        )}
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic amber"><IconBolt size={18} /></span>
            <div>
              <div className="cv-card-title">Special Handling &amp; Priority</div>
              <div className="cv-card-sub">Specific handling instructions for this job</div>
            </div>
          </div>
        </div>
        <div className="cv-switches">
        <SwitchRow label="Speedshop Job" on={toggles.speedshop} onToggle={tog('speedshop')} />
        <SwitchRow label="Targeted Priority" on={toggles.priority} onToggle={tog('priority')} />
        <SwitchRow label="VIP Client" on={toggles.vip} onToggle={tog('vip')} />
        <SwitchRow label="Bumper Repair Only" on={toggles.bumper} onToggle={tog('bumper')} />
        <SwitchRow label="Car Collected – Awaiting Backorder Parts" on={toggles.backorder} onToggle={tog('backorder')} />
        <SwitchRow label="Client Rental Car" on={toggles.rental} onToggle={tog('rental')} />
        <SwitchRow label="Client Bag Onsite" on={toggles.bag} onToggle={tog('bag')} />
        </div>
      </section>
    </div>
  )
}

function DamageReportTab({ claim, userId, onDirtyChange, onSaved }: { claim: Claim; userId: string; onDirtyChange: (d: boolean) => void; onSaved: () => void }) {
  const toast = useToast()
  const j = claim.job_information
  const initial = {
    damageDescription: j?.damage_description ?? '',
    severityLevel: j?.severity_level ?? '',
  }
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [k]: val }))

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  const fieldErr = {
    damageDescription: !form.damageDescription.trim() ? 'Damage description is required' : '',
  }
  const errors = Object.values(fieldErr).filter(Boolean)
  const valid = errors.length === 0
  const errOf = (e: string) => (dirty && e ? e : undefined)

  const save = async () => {
    if (!dirty || !valid) return
    setSaving(true)
    try {
      await updateClaimDamageReport(claim.claim_id, userId, {
        damageDescription: form.damageDescription,
        severityLevel: form.severityLevel,
      })
      toast('Damage report saved', 'success')
      onSaved()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save damage report', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic amber"><IconAlert size={18} /></span>
            <div>
              <div className="cv-card-title">Damage Report</div>
              <div className="cv-card-sub">DR / RO references and accident details</div>
            </div>
          </div>
          <div className="cv-save-area">
            {dirty && (
              valid ? <span className="cv-flag ok">✓ Ready to save</span>
                : <span className="cv-flag err" title={errors.join('\n')}>{errors.length} field{errors.length > 1 ? 's' : ''} need attention</span>
            )}
            <button className="new-claim" onClick={save} disabled={saving || !dirty || !valid}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
        <div className="cv-note">
          <span className="cv-note-ic">ⓘ</span>
          <span><strong>Note:</strong> DR and RO numbers are generated in TMS and synced to this system.</span>
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <CField label="DR Number" value={claim.dr_number ?? ''} readOnly />
          <CField label="RO Number (Repair Order)" value={claim.ro_number ?? ''} readOnly />
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic violet"><IconAlert size={18} /></span>
            <div>
              <div className="cv-card-title">Accident &amp; Damage Details</div>
              <div className="cv-card-sub">Description, severity and repair information</div>
            </div>
          </div>
        </div>
        <TArea label="Damage Description" value={form.damageDescription} onChange={set('damageDescription')} required error={errOf(fieldErr.damageDescription)} rows={4} />
        <SelectField
          label="Severity Level"
          value={form.severityLevel}
          onChange={set('severityLevel')}
          options={SEVERITY_OPTS.map((s) => ({ value: s, label: s }))}
          placeholder="Select severity…"
        />
      </section>
    </div>
  )
}

const UPLOAD_MAX = 25 * 1024 * 1024

function UploadsTab({ claim, userId, onChanged }: { claim: Claim; userId: string; onChanged?: () => void }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<ClaimFile[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const fs = await getClaimFiles(claim.claim_id)
        if (on) setFiles(fs)
      } catch {
        if (on) setFiles([])
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id, reload])

  const pick = (f: File | null) => {
    if (f && f.size > UPLOAD_MAX) { toast('File is too large (max 25 MB).', 'error'); return }
    setFile(f)
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0] ?? null) }

  const upload = async () => {
    if (!file) { toast('Choose a file to upload.', 'error'); return }
    if (!title.trim()) { toast('Enter a document title.', 'error'); return }
    setUploading(true)
    try {
      await uploadClaimFile(claim.claim_id, file, title.trim(), category || null, userId)
      toast('File uploaded', 'success')
      setFile(null); setTitle(''); setCategory('')
      if (fileRef.current) fileRef.current.value = ''
      setReload((r) => r + 1)
      // The backend may auto-advance the claim status on upload (e.g.
      // "Drive-Quote Required" → "Drive-Quote Sent"); refresh so the header reflects it.
      onChanged?.()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconExternal size={18} /></span>
            <div>
              <div className="cv-card-title">Upload a File</div>
              <div className="cv-card-sub">Attach documents to this claim</div>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <CField label="Document Title" value={title} onChange={setTitle} required />
          <SelectField label="Category" value={category} onChange={setCategory} options={UPLOAD_CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Select category…" />
        </div>
        <div
          className={`upload-drop${dragging ? ' drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input ref={fileRef} type="file" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          {file ? (
            <div className="upload-picked">
              <span className="doc-row-icon"><IconFilePdf size={20} /></span>
              <div>
                <div className="upload-picked-name">{file.name}</div>
                <div className="doc-row-meta">{formatFileSize(file.size)}</div>
              </div>
              <button type="button" className="btn-ghost sm" onClick={(e) => { e.stopPropagation(); pick(null); if (fileRef.current) fileRef.current.value = '' }}>Remove</button>
            </div>
          ) : (
            <div className="upload-hint">
              <strong>Click to choose a file</strong> or drag &amp; drop it here
              <div className="muted">PDF, Word, Excel or image — up to 25 MB</div>
            </div>
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: 14 }}>
          <div className="modal-actions-right">
            <button className="new-claim" onClick={upload} disabled={uploading || !file || !title.trim()}>
              <IconPlus size={16} /> {uploading ? 'Uploading…' : 'Upload File'}
            </button>
          </div>
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic green"><IconDocuments size={18} /></span>
            <div>
              <div className="cv-card-title">Uploaded Files</div>
              <div className="cv-card-sub">{files.length} file{files.length === 1 ? '' : 's'} attached</div>
            </div>
          </div>
        </div>
        {loading ? (
          <Loader label="Loading files…" />
        ) : files.length === 0 ? (
          <div className="up-empty">No files uploaded yet.</div>
        ) : (
          <div className="up-list">
            {files.map((f) => (
              <a key={f.id} className="up-file" href={f.fileUrl ?? '#'} target="_blank" rel="noreferrer">
                <span className="up-file-ic"><IconFilePdf size={20} /></span>
                <div className="up-file-main">
                  <span className="up-file-title">{f.documentTitle || 'Untitled'}</span>
                  <span className="up-file-meta">
                    {f.category && <span className="up-file-cat">{f.category}</span>}
                    {f.uploaderName ? `${f.uploaderName} · ` : ''}{fmtDate(f.createdAt)}
                  </span>
                </div>
                <span className="up-file-open"><IconExternal size={16} /></span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function LinkedJobsTab({ claim }: { claim: Claim }) {
  const navigate = useNavigate()
  const [links, setLinks] = useState<LinkedClaim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const d = await getLinkedClaims(claim.claim_id)
        if (on) setLinks(d)
      } catch {
        if (on) setLinks([])
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id])

  const relTone = (rel: string | null) => {
    const r = (rel ?? '').toLowerCase()
    if (r.includes('upsell')) return 'amber'
    if (r.includes('warranty')) return 'violet'
    return 'blue'
  }

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconAllocate size={18} /></span>
            <div>
              <div className="cv-card-title">Linked Jobs</div>
              <div className="cv-card-sub">Main job, upsells and warranty jobs on this vehicle</div>
            </div>
          </div>
        </div>
        {loading ? (
          <Loader label="Loading linked jobs…" />
        ) : links.length === 0 ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconAllocate size={20} /></span>No linked jobs for this repair.</div>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>DR Number</th><th>RO Number</th><th>Status</th><th>Job Type</th>
                  <th>Is Main?</th><th>Is Upsell?</th><th>Is Warranty</th>
                  <th>Description</th><th>Relationship</th><th>Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const isCurrent = l.claimId === claim.claim_id
                  const yn = (b: boolean) => <span className={`lj-yn${b ? ' yes' : ''}`}>{b ? 'Yes' : 'No'}</span>
                  return (
                    <tr key={l.claimId} className={isCurrent ? 'lj-current-row' : 'row-clickable'} onClick={isCurrent ? undefined : () => navigate(`/claim/${l.claimId}`)}>
                      <td><span className="cell-name">{l.drNumber || '—'}</span>{isCurrent && <span className="lj-current-tag">Current</span>}</td>
                      <td>{l.roNumber && l.roNumber !== '0' ? l.roNumber : '—'}</td>
                      <td>{l.status || '—'}</td>
                      <td>{l.jobType || '—'}</td>
                      <td className="cell-badge">{yn(l.isMainJob)}</td>
                      <td className="cell-badge">{yn(l.isUpsell)}</td>
                      <td className="cell-badge">{yn(l.isWarranty)}</td>
                      <td>{l.description || '—'}</td>
                      <td className="cell-badge"><span className={`lj-rel lj-rel-${relTone(l.relationship)}`}>{l.relationship || 'Job'}</span></td>
                      <td>{fmtDate(l.createdAt)}</td>
                      <td className="cell-badge">{!isCurrent && <span className="lj-open"><IconExternal size={16} /></span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function partStatusTone(status: string | null): string {
  const s = (status ?? '').toLowerCase()
  if (s.includes('received')) return 'green'
  if (s.includes('back')) return 'red'
  if (s.includes('ordered') && !s.includes('not')) return 'blue'
  return 'muted'
}

function TmsPartsTab({ claim }: { claim: Claim }) {
  const { branchId } = useAuth()
  const drNo = parseInt(claim.dr_number ?? '', 10)
  const [data, setData] = useState<TmsPartsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!Number.isFinite(drNo)) { setLoadErr('This claim has no DR number, so TMS parts are unavailable.'); setLoading(false); return }
      setLoading(true); setLoadErr(null)
      try {
        const d = await getTmsParts(drNo, branchId)
        if (on) setData(d)
      } catch (e: unknown) {
        if (on) setLoadErr(e instanceof Error ? e.message : 'Failed to load parts data')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [drNo, branchId])

  const statuses = useMemo(() => {
    const set = new Set<string>()
    for (const p of data?.parts ?? []) if (p.orderStatus) set.add(p.orderStatus)
    return Array.from(set)
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.parts ?? []).filter((p) => {
      if (statusFilter !== 'all' && (p.orderStatus ?? '') !== statusFilter) return false
      if (!q) return true
      return [p.description, p.operation, p.partNo, p.supplierCode].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [data, search, statusFilter])

  if (loadErr) return <div className="cd-tab-body"><div className="empty">{loadErr}</div></div>
  if (loading || !data) return <div className="cd-tab-body"><Loader label="Loading parts from TMS…" /></div>

  const s = data.summary
  const dash = (v: string | null) => (v && v.trim() ? v : '—')

  const tot = Math.max(s.totalParts, 1)
  const segs = [
    { key: 'Received', n: s.received, cls: 'green' },
    { key: 'Ordered', n: s.ordered, cls: 'blue' },
    { key: 'Back Ordered', n: s.backOrdered, cls: 'red' },
    { key: 'Not Ordered', n: s.notOrdered, cls: 'grey' },
  ].filter((x) => x.n > 0)
  const receivedPct = Math.round((s.received / tot) * 100)
  const margin = s.totalSaleValue - s.totalCostValue
  const marginPct = s.totalSaleValue > 0 ? Math.round((margin / s.totalSaleValue) * 100) : null

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconClaims size={18} /></span>
            <div>
              <div className="cv-card-title">Parts Order</div>
              <div className="cv-card-sub">DR {data.drNo} · live from TMS{data.shopSerial != null ? ` · shop ${data.shopSerial}` : ''}</div>
            </div>
          </div>
          <span className="tp-count-badge">{s.totalParts} part{s.totalParts === 1 ? '' : 's'}</span>
        </div>

        <div className="tp-hero">
          <div className="tp-value tp-value-sale">
            <span className="tp-value-ic"><IconMoney size={17} /></span>
            <div>
              <div className="tp-value-lbl">Total Sale Value</div>
              <div className="tp-value-num">{money(s.totalSaleValue)}</div>
            </div>
          </div>
          <div className="tp-value tp-value-cost">
            <span className="tp-value-ic"><IconReports size={17} /></span>
            <div>
              <div className="tp-value-lbl">Total Cost Value</div>
              <div className="tp-value-num">{money(s.totalCostValue)}</div>
            </div>
          </div>
          <div className="tp-value tp-value-margin">
            <span className="tp-value-ic"><IconGauge size={17} /></span>
            <div>
              <div className="tp-value-lbl">Gross Margin{marginPct != null ? ` · ${marginPct}%` : ''}</div>
              <div className="tp-value-num">{money(margin)}</div>
            </div>
          </div>
        </div>

        <div className="tp-progress">
          <div className="tp-progress-head">
            <span className="tp-progress-title">Order Progress</span>
            <span className="tp-progress-pct">{receivedPct}% received</span>
          </div>
          <div className="tp-bar" role="img" aria-label={`${receivedPct}% of parts received`}>
            {segs.length === 0 ? (
              <div className="tp-seg grey" style={{ width: '100%' }} />
            ) : segs.map((sg) => (
              <div key={sg.key} className={`tp-seg ${sg.cls}`} style={{ width: `${(sg.n / tot) * 100}%` }} title={`${sg.key}: ${sg.n}`} />
            ))}
          </div>
          <div className="tp-legend">
            <span className="tp-leg"><i className="tp-dot green" />Received <b>{s.received}</b></span>
            <span className="tp-leg"><i className="tp-dot blue" />Ordered <b>{s.ordered}</b></span>
            <span className="tp-leg"><i className="tp-dot red" />Back Ordered <b>{s.backOrdered}</b></span>
            <span className="tp-leg"><i className="tp-dot grey" />Not Ordered <b>{s.notOrdered}</b></span>
            {s.extrasParts > 0 && <span className="tp-leg tp-leg-sep"><i className="tp-dot amber" />Extras <b>{s.extrasParts}</b></span>}
            {s.rfcCount > 0 && <span className="tp-leg"><i className="tp-dot violet" />RFC <b>{s.rfcCount}</b></span>}
          </div>
        </div>

        {data.parts.length === 0 ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconClaims size={20} /></span>No parts captured for this repair in TMS.</div>
        ) : (
          <>
            <div className="tp-toolbar">
              <div className="tp-search">
                <IconSearch size={15} />
                <input placeholder="Search description, part no, operation…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="tp-chips">
                <button className={`tp-chip${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                {statuses.map((st) => (
                  <button key={st} className={`tp-chip${statusFilter === st ? ' active' : ''}`} onClick={() => setStatusFilter(st)}>{st}</button>
                ))}
              </div>
            </div>

            <div className="table-scroll tp-scroll">
              <table className="admin-table tp-table">
                <thead>
                  <tr>
                    <th>#</th><th>Operation</th><th>Description</th><th>Part No</th>
                    <th className="r">Qty</th><th>Status</th><th>Order Date</th><th>Supplier</th>
                    <th>Received</th><th className="r">Sale</th><th className="r">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: TmsPart, i) => (
                    <tr key={`${p.lineNo}-${i}`}>
                      <td className="tp-line">{p.lineNo ?? '—'}</td>
                      <td>{dash(p.operation)}</td>
                      <td>
                        <span className="cell-name">{dash(p.description)}</span>
                        {(p.extras || p.suppliedByInsurer || p.outSourced) && (
                          <span className="tp-tags">
                            {p.extras && <span className="tp-tag amber">Extra</span>}
                            {p.suppliedByInsurer && <span className="tp-tag blue">Insurer</span>}
                            {p.outSourced && <span className="tp-tag violet">Outsourced</span>}
                          </span>
                        )}
                      </td>
                      <td>{dash(p.partNo)}</td>
                      <td className="r">{p.qty ?? '—'}</td>
                      <td className="cell-badge"><span className={`tp-status tp-${partStatusTone(p.orderStatus)}`}>{p.orderStatus || 'Unknown'}</span></td>
                      <td>{p.orderDate ? fmtDate(p.orderDate) : '—'}</td>
                      <td>{dash(p.supplierCode)}</td>
                      <td>{p.receivedQty != null ? `${p.receivedQty}${p.receivedDate ? ` · ${fmtDate(p.receivedDate)}` : ''}` : '—'}</td>
                      <td className="r">{p.salePrice != null ? money(p.salePrice) : '—'}</td>
                      <td className="r">{p.cost != null ? money(p.cost) : '—'}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} className="tp-noresult">No parts match your filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function TmsQuoteTab({ claim }: { claim: Claim }) {
  const { branchId } = useAuth()
  const drNo = parseInt(claim.dr_number ?? '', 10)
  const [data, setData] = useState<TmsQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!Number.isFinite(drNo)) { setLoadErr('This claim has no DR number, so the TMS quote is unavailable.'); setLoading(false); return }
      setLoading(true); setLoadErr(null)
      try {
        const d = await getTmsQuote(drNo, branchId)
        if (on) setData(d)
      } catch (e: unknown) {
        if (on) setLoadErr(e instanceof Error ? e.message : 'Failed to load quote')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [drNo, branchId])

  if (loadErr) return <div className="cd-tab-body"><div className="empty">{loadErr}</div></div>
  if (loading || !data) return <div className="cd-tab-body"><Loader label="Loading quote from TMS…" /></div>

  const items = data.lineItems
  const sum = (pick: (l: QuoteLineItem) => number | null) => items.reduce((a, l) => a + (pick(l) ?? 0), 0)
  const totParts = sum((l) => l.parts)
  const totSale = sum((l) => l.saleParts)
  const totLabour = sum((l) => l.labour)
  const totPaint = sum((l) => l.paint)
  const totStrip = sum((l) => l.stripAssm)
  const totFrame = sum((l) => l.frame)
  const totMisc = sum((l) => l.miscOutwork)

  const cell = (n: number | null) => (n != null && n !== 0 ? money(n) : <span className="tq-zero">—</span>)
  const tcell = (n: number) => (n !== 0 ? money(n) : '—')

  const fin: { label: string; value: string }[] = [
    { label: 'Quote Value', value: money(data.quoteValue ?? 0) },
    { label: 'Parts Value', value: money(data.partsValue ?? 0) },
    { label: 'Approved Value', value: money(data.approvedValue ?? 0) },
    { label: 'Approved Parts', value: money(data.partsAppValue ?? data.approvedParts ?? 0) },
    { label: 'Extras', value: money(data.extrasValue ?? data.extrasTotal ?? 0) },
    { label: 'Pre-costing', value: money(data.precosting ?? 0) },
    { label: 'Projected COS', value: `${Math.round(data.projectedCosPercent ?? 0)}%` },
    { label: 'Actual COS', value: `${Math.round(data.actualCosPercent ?? 0)}%` },
  ]

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconFilePdf size={18} /></span>
            <div>
              <div className="cv-card-title">Quote</div>
              <div className="cv-card-sub">
                DR {data.drNo}{data.roNo && data.roNo !== '0' ? ` · RO ${data.roNo}` : ''} · live from TMS{data.shopSerial != null ? ` · shop ${data.shopSerial}` : ''}
              </div>
            </div>
          </div>
          <span className="tp-count-badge">{items.length} line{items.length === 1 ? '' : 's'}</span>
        </div>

        <div className="tp-hero">
          <div className="tp-value tp-value-sale">
            <span className="tp-value-ic"><IconMoney size={17} /></span>
            <div>
              <div className="tp-value-lbl">Quote Total</div>
              <div className="tp-value-num">{money(data.quoteTotal ?? 0)}</div>
            </div>
          </div>
          <div className="tp-value tp-value-cost">
            <span className="tp-value-ic"><IconClaims size={17} /></span>
            <div>
              <div className="tp-value-lbl">Approved Parts</div>
              <div className="tp-value-num">{money(data.approvedParts ?? 0)}</div>
            </div>
          </div>
          <div className="tp-value tp-value-margin">
            <span className="tp-value-ic"><IconReports size={17} /></span>
            <div>
              <div className="tp-value-lbl">Sale (excl VAT)</div>
              <div className="tp-value-num">{money(data.saleAmtExclVat ?? 0)}</div>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconFilePdf size={20} /></span>No quote line items in TMS for this repair.</div>
        ) : (
          <div className="table-scroll tp-scroll">
            <table className="admin-table tp-table tq-table">
              <thead>
                <tr>
                  <th>#</th><th>Operation</th><th>Description</th>
                  <th className="r">Parts</th><th className="r">Sale Parts</th><th className="r">Labour</th>
                  <th className="r">Paint</th><th className="r">Strip/Asm</th><th className="r">Frame</th><th className="r">Misc</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l, i) => (
                  <tr key={`${l.no}-${i}`}>
                    <td className="tp-line">{l.no ?? '—'}</td>
                    <td>{l.oper ? <span className={`tq-oper tq-oper-${(l.oper || '').toLowerCase().replace(/[^a-z]/g, '')}`}>{l.oper}</span> : '—'}</td>
                    <td><span className="cell-name">{l.description || '—'}</span></td>
                    <td className="r">{cell(l.parts)}</td>
                    <td className="r">{cell(l.saleParts)}</td>
                    <td className="r">{cell(l.labour)}</td>
                    <td className="r">{cell(l.paint)}</td>
                    <td className="r">{cell(l.stripAssm)}</td>
                    <td className="r">{cell(l.frame)}</td>
                    <td className="r">{cell(l.miscOutwork)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tq-foot">
                  <td colSpan={3}>Totals</td>
                  <td className="r">{tcell(totParts)}</td>
                  <td className="r">{tcell(totSale)}</td>
                  <td className="r">{tcell(totLabour)}</td>
                  <td className="r">{tcell(totPaint)}</td>
                  <td className="r">{tcell(totStrip)}</td>
                  <td className="r">{tcell(totFrame)}</td>
                  <td className="r">{tcell(totMisc)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="tq-fin">
          {fin.map((f) => (
            <div key={f.label} className="tq-fin-cell">
              <div className="tq-fin-lbl">{f.label}</div>
              <div className="tq-fin-val">{f.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TmsTotalsTab({ claim }: { claim: Claim }) {
  const { branchId } = useAuth()
  const drNo = parseInt(claim.dr_number ?? '', 10)
  const [data, setData] = useState<TmsTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!Number.isFinite(drNo)) { setLoadErr('This claim has no DR number, so TMS totals are unavailable.'); setLoading(false); return }
      setLoading(true); setLoadErr(null)
      try {
        const d = await getTmsTotals(drNo, branchId)
        if (on) setData(d)
      } catch (e: unknown) {
        if (on) setLoadErr(e instanceof Error ? e.message : 'Failed to load totals')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [drNo, branchId])

  if (loadErr) return <div className="cd-tab-body"><div className="empty">{loadErr}</div></div>
  if (loading || !data) return <div className="cd-tab-body"><Loader label="Loading totals from TMS…" /></div>

  const hr = data.hourlyRates
  const mh = (s: TmsTotalsSection, k: 'labour' | 'paint' | 'stripAssm' | 'frame') => s[k]
  const cell = (n: number) => (n !== 0 ? money(n) : <span className="tq-zero">—</span>)
  const hrs = (h: number) => (h > 0 ? `${h.toFixed(1)} hrs` : null)

  // category, hourly rate (if labour-type), accessor
  const rows: { label: string; rate?: number; kind: 'money' | 'mh'; get: (s: TmsTotalsSection) => number; getHours?: (s: TmsTotalsSection) => number }[] = [
    { label: 'Parts', kind: 'money', get: (s) => s.parts },
    { label: 'Labour', rate: hr.labourRate, kind: 'mh', get: (s) => mh(s, 'labour').money, getHours: (s) => mh(s, 'labour').hours },
    { label: 'Paint', rate: hr.paintRate, kind: 'mh', get: (s) => mh(s, 'paint').money, getHours: (s) => mh(s, 'paint').hours },
    { label: 'Strip / Assemble', rate: hr.stripAssmRate, kind: 'mh', get: (s) => mh(s, 'stripAssm').money, getHours: (s) => mh(s, 'stripAssm').hours },
    { label: 'Frame', rate: hr.frameRate, kind: 'mh', get: (s) => mh(s, 'frame').money, getHours: (s) => mh(s, 'frame').hours },
    { label: 'Misc Outwork', kind: 'money', get: (s) => s.miscOutwork },
    { label: 'Shop Supplies', kind: 'money', get: (s) => s.shopSupplies },
    { label: 'Paint Supplies', kind: 'money', get: (s) => s.paintSupplies },
  ]

  const summary: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Combined Subtotal', value: money(data.combinedSubtotal) },
    { label: 'Less Discounts', value: data.lessDiscounts ? `– ${money(data.lessDiscounts)}` : money(0) },
    { label: 'After Discount', value: money(data.afterDiscount) },
    { label: `VAT (${data.taxRate}%)`, value: money(data.vatAmount) },
  ]

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconReports size={18} /></span>
            <div>
              <div className="cv-card-title">TMS Totals</div>
              <div className="cv-card-sub">
                DR {data.drNo}{data.roNo && data.roNo !== '0' ? ` · RO ${data.roNo}` : ''} · live from TMS{data.shopSerial != null ? ` · shop ${data.shopSerial}` : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="tp-hero">
          <div className="tp-value tp-value-sale">
            <span className="tp-value-ic"><IconMoney size={17} /></span>
            <div>
              <div className="tp-value-lbl">Subtotal (excl VAT)</div>
              <div className="tp-value-num">{money(data.combinedSubtotal)}</div>
            </div>
          </div>
          <div className="tp-value tp-value-cost">
            <span className="tp-value-ic"><IconReports size={17} /></span>
            <div>
              <div className="tp-value-lbl">VAT ({data.taxRate}%)</div>
              <div className="tp-value-num">{money(data.vatAmount)}</div>
            </div>
          </div>
          <div className="tp-value tp-value-margin">
            <span className="tp-value-ic"><IconGauge size={17} /></span>
            <div>
              <div className="tp-value-lbl">Total Incl VAT</div>
              <div className="tp-value-num">{money(data.totalIncVat)}</div>
            </div>
          </div>
        </div>

        {data.empty ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconReports size={20} /></span>No totals available in TMS for this repair.</div>
        ) : (
          <div className="tt-grid">
            <div className="table-scroll">
              <table className="admin-table tp-table tt-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="r">DR / RO</th>
                    <th className="r">Extras</th>
                    <th className="r">Combined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const combinedHours = r.getHours ? r.getHours(data.combined) : 0
                    return (
                      <tr key={r.label}>
                        <td>
                          <span className="cell-name">{r.label}</span>
                          {r.kind === 'mh' && (
                            <span className="tt-meta">
                              {hrs(combinedHours) ?? '0 hrs'}{r.rate ? ` @ ${money(r.rate)}/hr` : ''}
                            </span>
                          )}
                        </td>
                        <td className="r">{cell(r.get(data.drRo))}</td>
                        <td className="r">{cell(r.get(data.extras))}</td>
                        <td className="r tt-combined">{cell(r.get(data.combined))}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="tq-foot">
                    <td>Subtotal</td>
                    <td className="r">{money(data.drRo.subtotal)}</td>
                    <td className="r">{money(data.extras.subtotal)}</td>
                    <td className="r tt-combined">{money(data.combined.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="tt-summary">
              <div className="tt-summary-title">Invoice Summary</div>
              {summary.map((s) => (
                <div key={s.label} className="tt-sum-row">
                  <span className="tt-sum-lbl">{s.label}</span>
                  <span className="tt-sum-val">{s.value}</span>
                </div>
              ))}
              <div className="tt-sum-row tt-sum-total">
                <span className="tt-sum-lbl">Total Incl VAT</span>
                <span className="tt-sum-val">{money(data.totalIncVat)}</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function tmsFileIcon(name: string): ReactNode {
  const n = name.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|bmp|heic)$/.test(n)) return <IconCamera size={20} />
  if (/\.pdf$/.test(n)) return <IconFilePdf size={20} />
  return <IconDocuments size={20} />
}

function TmsUploadsTab({ claim }: { claim: Claim }) {
  const { branchId } = useAuth()
  const drNo = parseInt(claim.dr_number ?? '', 10)
  const [files, setFiles] = useState<TmsUploadFile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!Number.isFinite(drNo)) { setLoadErr('This claim has no DR number, so TMS uploads are unavailable.'); setLoading(false); return }
      setLoading(true); setLoadErr(null)
      try {
        const d = await getTmsUploads(drNo, branchId)
        if (on) setFiles(d.files)
      } catch (e: unknown) {
        if (on) setLoadErr(e instanceof Error ? e.message : 'Failed to load TMS uploads')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [drNo, branchId])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const f of files) set.add(f.category || 'General')
    return Array.from(set).sort()
  }, [files])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return files.filter((f) => {
      if (catFilter !== 'all' && (f.category || 'General') !== catFilter) return false
      if (!q) return true
      return f.name.toLowerCase().includes(q)
    })
  }, [files, search, catFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, TmsUploadFile[]>()
    for (const f of filtered) {
      const c = f.category || 'General'
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(f)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  if (loadErr) return <div className="cd-tab-body"><div className="empty">{loadErr}</div></div>
  if (loading) return <div className="cd-tab-body"><Loader label="Loading TMS uploads…" /></div>

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconExternal size={18} /></span>
            <div>
              <div className="cv-card-title">TMS Uploads</div>
              <div className="cv-card-sub">Documents synced from TMS for DR {claim.dr_number}</div>
            </div>
          </div>
          <span className="tp-count-badge">{files.length} file{files.length === 1 ? '' : 's'}</span>
        </div>

        {files.length === 0 ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconExternal size={20} /></span>No documents uploaded in TMS for this repair.</div>
        ) : (
          <>
            <div className="tp-toolbar">
              <div className="tp-search">
                <IconSearch size={15} />
                <input placeholder="Search file name…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="tp-chips">
                <button className={`tp-chip${catFilter === 'all' ? ' active' : ''}`} onClick={() => setCatFilter('all')}>All</button>
                {categories.map((c) => (
                  <button key={c} className={`tp-chip${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
                ))}
              </div>
            </div>

            {grouped.length === 0 ? (
              <div className="cm-empty"><span className="cm-empty-ic"><IconExternal size={20} /></span>No files match your filter.</div>
            ) : (
              <div className="tu-groups">
                {grouped.map(([cat, list]) => (
                  <div key={cat} className="tu-group">
                    <div className="tu-group-head">
                      <span className="tu-group-name">{cat}</span>
                      <span className="tu-group-count">{list.length}</span>
                    </div>
                    <div className="up-list">
                      {list.map((f, i) => (
                        <a key={`${f.name}-${i}`} className="up-file" href={f.url || '#'} target="_blank" rel="noreferrer">
                          <span className="up-file-ic">{tmsFileIcon(f.name)}</span>
                          <div className="up-file-main">
                            <span className="up-file-title">{f.name}</span>
                            <span className="up-file-meta"><span className="up-file-cat">{cat}</span></span>
                          </div>
                          <span className="up-file-open"><IconExternal size={16} /></span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function opClass(op: string | null): string {
  return `tq-oper-${(op || '').toLowerCase().replace(/[^a-z]/g, '')}`
}

function JobCardTab({ claim }: { claim: Claim }) {
  const { branchId } = useAuth()
  const drNo = parseInt(claim.dr_number ?? '', 10)
  const [data, setData] = useState<TmsJobCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [opFilter, setOpFilter] = useState('all')

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!Number.isFinite(drNo)) { setLoadErr('This claim has no DR number, so the job card is unavailable.'); setLoading(false); return }
      setLoading(true); setLoadErr(null)
      try {
        const d = await getTmsJobCard(drNo, branchId)
        if (on) setData(d)
      } catch (e: unknown) {
        if (on) setLoadErr(e instanceof Error ? e.message : 'Failed to load job card')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [drNo, branchId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.lineItems ?? []).filter((l) => {
      if (opFilter !== 'all' && (l.operation ?? '') !== opFilter) return false
      if (!q) return true
      return [l.description, l.partNo, l.operation].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [data, search, opFilter])

  if (loadErr) return <div className="cd-tab-body"><div className="empty">{loadErr}</div></div>
  if (loading || !data) return <div className="cd-tab-body"><Loader label="Loading job card from TMS…" /></div>

  const items = filtered
  const cols: { key: keyof JobCardFlags; label: string }[] = [
    { key: 'parts', label: 'Parts' },
    { key: 'repNewPart', label: 'Rep New Part' },
    { key: 'labour', label: 'Labour' },
    { key: 'paint', label: 'Paint' },
    { key: 'stripAssm', label: 'Strip?Assm' },
    { key: 'frame', label: 'Frame' },
    { key: 'misc', label: 'Misc' },
  ]
  const colTotals = cols.map((c) => items.reduce((a, l) => a + (l.flags[c.key] ? 1 : 0), 0))

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconFilePdf size={18} /></span>
            <div>
              <div className="cv-card-title">Job Card</div>
              <div className="cv-card-sub">DR {data.drNo} · live from TMS</div>
            </div>
          </div>
        </div>

        {data.lineItems.length === 0 ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconFilePdf size={20} /></span>No job card line items in TMS for this repair.</div>
        ) : (
          <>
            <div className="tp-toolbar">
              <div className="tp-search">
                <IconSearch size={15} />
                <input placeholder="Search description, part no, operation…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="tp-chips">
                <button className={`tp-chip${opFilter === 'all' ? ' active' : ''}`} onClick={() => setOpFilter('all')}>All</button>
                {data.operationBreakdown.map((o) => (
                  <button key={o.op} className={`tp-chip${opFilter === o.op ? ' active' : ''}`} onClick={() => setOpFilter(o.op)}>{o.op} · {o.count}</button>
                ))}
              </div>
            </div>

            <div className="table-scroll tp-scroll">
              <table className="admin-table tp-table jc-grid">
                <thead>
                  <tr>
                    <th className="jc-op-col">Operation</th>
                    <th>Part Description</th>
                    {cols.map((c) => <th key={c.key} className="jc-c">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.map((l, i) => (
                    <tr key={`${l.lineNo}-${i}`}>
                      <td className="jc-op-col">
                        {l.operation ? <span className={`tq-oper ${opClass(l.operation)}`}>{l.operation}</span> : ''}
                      </td>
                      <td>
                        <span className="cell-name">{l.description || '—'}</span>
                        {(l.extras || l.suppliedByInsurer) && (
                          <span className="tp-tags">
                            {l.extras && <span className="tp-tag amber">Extra</span>}
                            {l.suppliedByInsurer && <span className="tp-tag blue">Insurer</span>}
                          </span>
                        )}
                      </td>
                      {cols.map((c) => (
                        <td key={c.key} className="jc-c"><JcCheck on={l.flags[c.key]} /></td>
                      ))}
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={9} className="tp-noresult">No lines match your filter.</td></tr>
                  )}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr className="tq-foot">
                      <td className="jc-op-col" />
                      <td>Lines with each operation</td>
                      {colTotals.map((t, idx) => <td key={idx} className="jc-c">{t}</td>)}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="jc-summary">
              <span className="jc-sum-item"><span className="jc-sum-lbl">Total Lines</span><span className="jc-sum-pill grey">{data.totalLines}</span></span>
              <span className="jc-sum-item"><span className="jc-sum-lbl">DR</span><span className="jc-sum-pill blue">{data.drRoLines}</span></span>
              <span className="jc-sum-item"><span className="jc-sum-lbl">Extras</span><span className="jc-sum-pill amber">{data.extrasLines}</span></span>
              <span className="jc-sum-divide" />
              {data.operationBreakdown.map((o) => (
                <span key={o.op} className="jc-sum-item">
                  <span className="jc-sum-lbl">{o.op}</span>
                  <span className={`jc-sum-pill op ${opClass(o.op)}`}>{o.count}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function JcCheck({ on }: { on: boolean }) {
  return (
    <span className={`jc-check${on ? ' on' : ''}`} aria-hidden>
      {on && (
        <svg viewBox="0 0 16 16" width="11" height="11"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </span>
  )
}

function issueTone(sev: string | null): string {
  const s = (sev ?? '').toLowerCase()
  if (s === 'critical' || s === 'high' || s === 'urgent') return 'red'
  if (s === 'medium') return 'amber'
  return 'blue'
}

function LogIssueModal({ claim, onClose, onSaved }: { claim: Claim; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState('Medium')
  const [issueType, setIssueType] = useState('Production')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) { toast('Enter an issue title.', 'error'); return }
    setSaving(true)
    try {
      await createClaimIssue(claim.claim_id, { title: title.trim(), severity, issueType, description: description.trim() || null })
      toast('Issue logged', 'success')
      onSaved()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to log issue', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    createPortal(<div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Log an Issue</div>
            <div className="modal-sub">Flag a blocker or action item on this repair.</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-form">
          <CField label="Title" value={title} onChange={setTitle} required />
          <div className="form-grid">
            <SelectField label="Severity" value={severity} onChange={setSeverity} options={ISSUE_SEVERITIES.map((s) => ({ value: s, label: s }))} required />
            <SelectField label="Type" value={issueType} onChange={setIssueType} options={ISSUE_TYPES.map((t) => ({ value: t, label: t }))} required />
          </div>
          <TArea label="Description" value={description} onChange={setDescription} rows={3} />
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="new-claim" onClick={submit} disabled={saving}>{saving ? 'Logging…' : 'Log Issue'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>, document.body)
  )
}

function ResolveIssueModal({ claimId, issue, onClose, onResolved }: { claimId: string; issue: ClaimIssue; onClose: () => void; onResolved: () => void }) {
  const toast = useToast()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const confirm = async () => {
    setSaving(true)
    try {
      await resolveClaimIssue(claimId, issue.id, notes.trim())
      toast('Issue resolved', 'success')
      onResolved()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to resolve', 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    createPortal(<div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Resolve issue</div>
        <div className="modal-body">
          <p><strong>{issue.title}</strong></p>
          <TArea label="Resolution notes" value={notes} onChange={setNotes} rows={3} placeholder="How was it resolved?" />
        </div>
        <div className="modal-actions">
          <div className="modal-actions-right">
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="new-claim" onClick={confirm} disabled={saving}>{saving ? 'Resolving…' : 'Mark Resolved'}</button>
          </div>
        </div>
      </div>
    </div>, document.body)
  )
}

function IssuesTab({ claim, isAdmin }: { claim: Claim; isAdmin: boolean }) {
  const toast = useToast()
  const [issues, setIssues] = useState<ClaimIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [showLog, setShowLog] = useState(false)
  const [resolveTarget, setResolveTarget] = useState<ClaimIssue | null>(null)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const d = await getClaimIssues(claim.claim_id)
        if (on) setIssues(d)
      } catch {
        if (on) setIssues([])
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id, reload])

  const remove = async (id: string) => {
    try {
      await deleteClaimIssue(claim.claim_id, id)
      toast('Issue deleted', 'success')
      setReload((r) => r + 1)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to delete', 'error')
    }
  }

  const open = issues.filter((i) => !i.isResolved)
  const resolved = issues.filter((i) => i.isResolved)

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic amber"><IconAlert size={18} /></span>
            <div>
              <div className="cv-card-title">Issues</div>
              <div className="cv-card-sub">{open.length} open · {resolved.length} resolved</div>
            </div>
          </div>
          <button className="new-claim" onClick={() => setShowLog(true)}><IconPlus size={15} /> Log Issue</button>
        </div>

        {loading ? (
          <Loader label="Loading issues…" />
        ) : issues.length === 0 ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconAlert size={20} /></span>No issues logged for this repair.</div>
        ) : (
          <div className="iss-list">
            {[...open, ...resolved].map((i) => (
              <div key={i.id} className={`iss-card${i.isResolved ? ' resolved' : ''}`}>
                <span className={`iss-sev iss-sev-${issueTone(i.severity)}`}>{(i.severity ?? 'low').toUpperCase()}</span>
                <div className="iss-main">
                  <div className="iss-title">{i.title || 'Issue'}</div>
                  <div className="iss-meta">
                    {i.issueType && <span className="iss-type">{i.issueType}</span>}
                    {i.reportedByName ? `${i.reportedByName} · ` : ''}{fmtDate(i.createdAt)}
                    {i.subStatus ? ` · ${i.subStatus}` : ''}
                  </div>
                  {i.isResolved && i.resolutionNotes && <div className="iss-resolution">Resolved: {i.resolutionNotes}</div>}
                </div>
                <div className="iss-actions">
                  {i.isResolved ? (
                    <span className="iss-done">✓ Resolved</span>
                  ) : (
                    <button className="btn-ghost sm" onClick={() => setResolveTarget(i)}>Resolve</button>
                  )}
                  {isAdmin && (
                    <button className="icon-btn sm danger" title="Delete issue" onClick={() => remove(i.id)}><IconTrash size={15} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showLog && <LogIssueModal claim={claim} onClose={() => setShowLog(false)} onSaved={() => { setShowLog(false); setReload((r) => r + 1) }} />}
      {resolveTarget && <ResolveIssueModal claimId={claim.claim_id} issue={resolveTarget} onClose={() => setResolveTarget(null)} onResolved={() => { setResolveTarget(null); setReload((r) => r + 1) }} />}
    </div>
  )
}

const FUEL_TYPES = [
  { value: 'driver', label: 'Driver Slip' },
  { value: 'client', label: 'Client Slip' },
  { value: 'workshop', label: 'Workshop Slip' },
]
const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

function FuelSlipModal({ claim, branchId, onClose, onSaved }: { claim: Claim; branchId: string; onClose: () => void; onSaved: (s: FuelSlip) => void }) {
  const toast = useToast()
  const [slipType, setSlipType] = useState('driver')
  const [recipient, setRecipient] = useState('')
  const [reg, setReg] = useState((claim.vehicle_information?.license_plate ?? '').toUpperCase())
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!recipient.trim()) { toast('Enter the recipient name.', 'error'); return }
    if (!reg.trim()) { toast('Enter the vehicle registration.', 'error'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast('Please enter a valid fuel amount.', 'error'); return }
    setSaving(true)
    try {
      const slip = await createFuelSlip({
        slipType, recipientName: recipient.trim(), vehicleReg: reg.trim(), amount: amt,
        branchId, comment: comment.trim() || null, claimId: claim.claim_id,
      })
      toast('Fuel slip created', 'success')
      onSaved(slip)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to create fuel slip', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    createPortal(<div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Add Fuel Slip</div>
            <div className="modal-sub">Create a fuel voucher for this repair.</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-form">
          <div className="form-grid">
            <CField label="DR Number" value={claim.dr_number ?? ''} readOnly />
            <SelectField label="Type of Slip" value={slipType} onChange={setSlipType} options={FUEL_TYPES} required />
          </div>
          <CField label="Client / Driver Name" value={recipient} onChange={setRecipient} required />
          <div className="form-grid">
            <CField label="Vehicle Reg" value={reg} onChange={(v) => setReg(v.toUpperCase())} required />
            <CField label="Fuel Amount (R)" value={amount} onChange={setAmount} required placeholder="R 0,00" />
          </div>
          <TArea label="Comment" value={comment} onChange={setComment} rows={2} placeholder="Optional note" />
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="new-claim" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create Slip'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>, document.body)
  )
}

function VoidFuelSlipModal({ slip, onClose, onVoided }: { slip: FuelSlip; onClose: () => void; onVoided: () => void }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const confirm = async () => {
    if (!reason.trim()) { toast('Enter a reason for voiding.', 'error'); return }
    setSaving(true)
    try {
      await voidFuelSlip(slip.id, reason.trim())
      toast('Fuel slip voided', 'success')
      onVoided()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to void', 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    createPortal(<div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Void fuel slip {slip.refNumber}?</div>
        <div className="modal-body">
          <p>This marks the slip as voided. This cannot be undone.</p>
          <TArea label="Reason" value={reason} onChange={setReason} rows={2} placeholder="e.g. Wrong vehicle registration" />
        </div>
        <div className="modal-actions">
          <div className="modal-actions-right">
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn-danger" onClick={confirm} disabled={saving}>{saving ? 'Voiding…' : 'Void Slip'}</button>
          </div>
        </div>
      </div>
    </div>, document.body)
  )
}

function FuelSlipsTab({ claim, branchId, isAdmin }: { claim: Claim; branchId: string; isAdmin: boolean }) {
  const [slips, setSlips] = useState<FuelSlip[]>([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [voidTarget, setVoidTarget] = useState<FuelSlip | null>(null)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const s = await getFuelSlips(claim.claim_id, true)
        if (on) setSlips(s)
      } catch {
        if (on) setSlips([])
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id, reload])

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic green"><IconFuel size={18} /></span>
            <div>
              <div className="cv-card-title">Fuel Slips</div>
              <div className="cv-card-sub">Fuel vouchers issued for this repair</div>
            </div>
          </div>
          <button className="new-claim" onClick={() => setShowAdd(true)}><IconPlus size={15} /> Add Fuel Slip</button>
        </div>

        {loading ? (
          <Loader label="Loading fuel slips…" />
        ) : slips.length === 0 ? (
          <div className="cm-empty"><span className="cm-empty-ic"><IconFuel size={20} /></span>No fuel slips captured for this repair yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ref Number</th><th>Type</th><th>Recipient</th><th>Vehicle Reg</th>
                  <th>Amount</th><th>Issued By</th><th>Date</th><th>Expiry</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => (
                  <tr key={s.id} className={s.isVoided ? 'fuel-voided' : ''}>
                    <td><span className="cell-name">{s.refNumber}</span></td>
                    <td>{cap(s.slipType)}</td>
                    <td>{s.recipientName}</td>
                    <td>{s.vehicleReg}</td>
                    <td>{s.amount != null ? money(s.amount) : '—'}</td>
                    <td>{s.createdByName ?? '—'}</td>
                    <td>{fmtDate(s.issueDate)}</td>
                    <td>{fmtDate(s.expiryDate)}</td>
                    <td className="cell-badge">{s.isVoided ? <span className="fuel-badge">VOIDED</span> : <span className="pill-status on">Active</span>}</td>
                    <td className="cell-badge">
                      <div className="fuel-actions">
                        <button className="icon-btn sm" title="Print voucher" onClick={() => printVoucher(s)}><IconPrinter size={15} /></button>
                        {isAdmin && !s.isVoided && (
                          <button className="icon-btn sm danger" title="Void slip" onClick={() => setVoidTarget(s)}><IconTrash size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAdd && (
        <FuelSlipModal
          claim={claim}
          branchId={branchId}
          onClose={() => setShowAdd(false)}
          onSaved={(slip) => { setShowAdd(false); setReload((r) => r + 1); printVoucher(slip) }}
        />
      )}
      {voidTarget && (
        <VoidFuelSlipModal slip={voidTarget} onClose={() => setVoidTarget(null)} onVoided={() => { setVoidTarget(null); setReload((r) => r + 1) }} />
      )}
    </div>
  )
}

const COMMENT_SUBS = [
  { key: 'system', label: 'System', Icon: IconBolt },
  { key: 'journal', label: 'Journal', Icon: IconClock },
  { key: 'notes', label: 'Notes', Icon: IconDocuments },
  { key: 'audit', label: 'Audit Trail', Icon: IconReports },
  { key: 'moderation', label: 'Moderation', Icon: IconShield },
] as const

function initialsOf(name?: string | null): string {
  if (!name || !name.trim()) return '—'
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

function eventTone(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('status')) return 'blue'
  if (t.includes('note')) return 'green'
  if (t.includes('upload') || t.includes('photo') || t.includes('document') || t.includes('file')) return 'amber'
  if (t.includes('moderation') || t.includes('approval')) return 'violet'
  if (t.includes('delete') || t.includes('cancel') || t.includes('removed')) return 'red'
  return 'grey'
}

const AVATAR_GRADS = [
  '#1b3a6b,#2f80ed', '#16794f,#1faa6c', '#b45309,#e08a1e',
  '#6d4ad9,#8b6cf0', '#9a3b5e,#d8557a', '#0e7490,#22b8cf',
]
function avatarGrad(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_GRADS[h % AVATAR_GRADS.length]
}

function FeedAvatar({ user }: { user: string | null }) {
  if (!user || user === 'System') return <span className="cm-tl-avatar sys">⚙</span>
  const [c1, c2] = avatarGrad(user).split(',')
  return <span className="cm-tl-avatar" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>{initialsOf(user)}</span>
}

function FeedList({ items, empty }: { items: FeedEntry[]; empty: string }) {
  if (items.length === 0) return <div className="cm-empty"><span className="cm-empty-ic"><IconClock size={20} /></span>{empty}</div>
  return (
    <div className="cm-timeline">
      {items.map((e) => {
        const tone = eventTone(e.title)
        const isStatus = e.title.toLowerCase().includes('status') && (e.oldValue || e.newValue)
        return (
          <div key={e.id} className="cm-tl">
            <FeedAvatar user={e.user} />
            <div className="cm-tl-card">
              <div className="cm-item-head">
                <span className={`cm-type cm-type-${tone}`}>{e.title.replace(/_/g, ' ').toLowerCase()}</span>
                <span className="cm-item-date">{e.date ?? ''}</span>
              </div>
              {isStatus ? (
                <div className="cm-status-change">
                  {e.oldValue && <span className="cm-spill old">{e.oldValue}</span>}
                  {e.oldValue && e.newValue && <span className="cm-arrow">→</span>}
                  {e.newValue && <span className="cm-spill new">{e.newValue}</span>}
                </div>
              ) : (
                e.body && <div className="cm-item-body">{e.body}</div>
              )}
              {!isStatus && (e.oldValue || e.newValue) && (e.oldValue !== e.newValue) && (
                <div className="cm-item-change">
                  {e.oldValue && <span className="cm-old">{e.oldValue}</span>}
                  {e.oldValue && e.newValue && <span className="cm-arrow">→</span>}
                  {e.newValue && <span className="cm-new">{e.newValue}</span>}
                </div>
              )}
              {e.user && <div className="cm-item-user"><span className="cm-by">by</span> {e.user}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CommentsTab({ claim, userId }: { claim: Claim; userId: string }) {
  const toast = useToast()
  const [sub, setSub] = useState<typeof COMMENT_SUBS[number]['key']>('system')
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [notes, setNotes] = useState<ClaimNote[]>([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        if (sub === 'system') { const d = await getSystemChanges(claim.claim_id); if (on) setFeed(d) }
        else if (sub === 'journal') { const d = await getClaimTimeline(claim.claim_id); if (on) setFeed(d) }
        else if (sub === 'audit') { const d = await getAuditTrail(claim.claim_id, userId); if (on) setFeed(d) }
        else { const d = await getClaimNotes(claim.claim_id); if (on) setNotes(d) }
      } catch {
        if (on) { setFeed([]); setNotes([]) }
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [sub, claim.claim_id, userId, reload])

  const addNote = async () => {
    if (!noteBody.trim()) { toast('Enter a note.', 'error'); return }
    setPosting(true)
    try {
      await addClaimNote(claim.claim_id, noteTitle.trim() || 'Note', noteBody.trim())
      setNoteTitle(''); setNoteBody('')
      setReload((r) => r + 1)
      toast('Note added', 'success')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to add note', 'error')
    } finally {
      setPosting(false)
    }
  }
  const removeNote = async (id: string) => {
    try {
      await deleteClaimNote(claim.claim_id, id)
      setReload((r) => r + 1)
      toast('Note deleted', 'success')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to delete', 'error')
    }
  }

  const generalNotes = notes.filter((n) => (n.noteType ?? '').toLowerCase() !== 'moderation')
  const modNotes = notes.filter((n) => (n.noteType ?? '').toLowerCase() === 'moderation')

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic violet"><IconDocuments size={18} /></span>
            <div>
              <div className="cv-card-title">Activity &amp; Comments</div>
              <div className="cv-card-sub">History, journal, notes and moderation</div>
            </div>
          </div>
        </div>
        <div className="cm-subtabs">
          {COMMENT_SUBS.map((s) => (
            <button key={s.key} className={`cm-subtab${sub === s.key ? ' active' : ''}`} onClick={() => setSub(s.key)}>
              <s.Icon size={15} /> {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loader label="Loading…" />
        ) : sub === 'notes' ? (
          <>
            <div className="cm-noteform">
              <input className="cm-note-title" placeholder="Title (optional)" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
              <textarea className="cm-note-body" rows={3} placeholder="Write a note…" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              <div className="cm-note-actions">
                <button className="new-claim" onClick={addNote} disabled={posting || !noteBody.trim()}>
                  <IconPlus size={15} /> {posting ? 'Adding…' : 'Add Note'}
                </button>
              </div>
            </div>
            {generalNotes.length === 0 ? (
              <div className="cm-empty"><span className="cm-empty-ic"><IconDocuments size={20} /></span>No notes yet — add the first one above.</div>
            ) : (
              <div className="cm-timeline">
                {generalNotes.map((n) => (
                  <div key={n.id} className="cm-tl">
                    <FeedAvatar user={n.author} />
                    <div className={`cm-tl-card${n.pinned ? ' pinned' : ''}`}>
                      <div className="cm-item-head">
                        <span className="cm-type cm-type-green">{n.title || 'Note'}{n.pinned ? ' 📌' : ''}</span>
                        <span className="cm-item-date">{n.date ?? ''}</span>
                      </div>
                      {n.content && <div className="cm-item-body">{n.content}</div>}
                      <div className="cm-note-foot">
                        {n.author && <span className="cm-item-user">{n.author}</span>}
                        <button className="cm-note-del" onClick={() => removeNote(n.id)} title="Delete note"><IconTrash size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : sub === 'moderation' ? (
          modNotes.length === 0 ? (
            <div className="cm-empty"><span className="cm-empty-ic"><IconShield size={20} /></span>No moderation comments.</div>
          ) : (
            <div className="cm-timeline">
              {modNotes.map((n) => (
                <div key={n.id} className="cm-tl">
                  <FeedAvatar user={n.author} />
                  <div className="cm-tl-card">
                    <div className="cm-item-head">
                      <span className="cm-type cm-type-violet">{n.title || 'Moderation'}</span>
                      <span className="cm-item-date">{n.date ?? ''}</span>
                    </div>
                    {n.content && <div className="cm-item-body">{n.content}</div>}
                    {n.author && <div className="cm-item-user">{n.author}</div>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : sub === 'journal' ? (
          <FeedList items={feed} empty="No journal entries." />
        ) : sub === 'audit' ? (
          <FeedList items={feed} empty="No audit trail entries." />
        ) : (
          <FeedList items={feed} empty="No system changes." />
        )}
      </section>
    </div>
  )
}

const clampZoom = (v: number) => Math.min(12, Math.max(1, v))

function PhotoLightbox({
  photo, index, total, onClose, onPrev, onNext, onDownload,
}: {
  photo: ClaimPhoto
  index: number
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onDownload: () => void
}) {
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [rot, setRot] = useState(0)
  const [grabbing, setGrabbing] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [base, setBase] = useState({ w: 0, h: 0 })
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const reset = () => { setScale(1); setTx(0); setTy(0); setRot(0) }
  const zoomBy = (factor: number) => setScale((s) => {
    const ns = clampZoom(s * factor)
    if (ns === 1) { setTx(0); setTy(0) }
    return ns
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
      else if (e.key === '+' || e.key === '=') zoomBy(1.2)
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.2)
      else if (e.key.toLowerCase() === 'r') setRot((r) => (r + 90) % 360)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  const onWheel = (e: RWheelEvent) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left - rect.width / 2
    const cy = e.clientY - rect.top - rect.height / 2
    // Gentle, scroll-amount-proportional zoom. Trackpads fire many tiny deltas,
    // so keep the coefficient low and clamp per-event so it never jumps.
    const delta = Math.max(-50, Math.min(50, e.deltaY))
    const factor = Math.exp(-delta * 0.0018)
    setScale((prev) => {
      const ns = clampZoom(prev * factor)
      const k = ns / prev
      if (ns === 1) { setTx(0); setTy(0) } else { setTx((t) => cx - (cx - t) * k); setTy((t) => cy - (cy - t) * k) }
      return ns
    })
  }
  const onDown = (e: RMouseEvent) => {
    if (scale <= 1) return
    drag.current = { x: e.clientX, y: e.clientY, tx, ty }
    setGrabbing(true)
  }
  const onMove = (e: RMouseEvent) => {
    if (!drag.current) return
    setTx(drag.current.tx + (e.clientX - drag.current.x))
    setTy(drag.current.ty + (e.clientY - drag.current.y))
  }
  const onUp = () => { drag.current = null; setGrabbing(false) }

  return (
    <div className="ph-lightbox" onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ph-lb-toolbar" onClick={(e) => e.stopPropagation()}>
        <span className="ph-lb-counter">{index + 1} / {total}</span>
        <span className="ph-lb-sep" />
        <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out" aria-label="Zoom out">−</button>
        <span className="ph-lb-zoom">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(1.2)} title="Zoom in" aria-label="Zoom in">+</button>
        <button onClick={() => setRot((r) => (r + 90) % 360)} title="Rotate" aria-label="Rotate">⟳</button>
        <button onClick={reset} title="Reset view">Reset</button>
        <button onClick={onDownload} title="Download photo" aria-label="Download"><IconDownload size={16} /></button>
        <a href={photo.originalUrl ?? '#'} target="_blank" rel="noreferrer" title="Open original"><IconExternal size={16} /></a>
        <button onClick={onClose} title="Close" aria-label="Close">✕</button>
      </div>

      {index > 0 && <button className="ph-lb-nav prev" onClick={onPrev} aria-label="Previous">‹</button>}
      <div
        className="ph-lb-stage"
        ref={stageRef}
        onWheel={onWheel}
        onDoubleClick={() => (scale > 1 ? reset() : setScale(2.5))}
        onMouseDown={onDown}
        style={{ cursor: scale > 1 ? (grabbing ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        {!imgLoaded && <span className="ph-spin" aria-label="Loading" />}
        <img
          className="ph-lb-img"
          src={photo.originalUrl ?? photo.largeUrl ?? ''}
          alt={photo.fileName ?? 'Photo'}
          draggable={false}
          onLoad={(e) => { setImgLoaded(true); setBase({ w: e.currentTarget.offsetWidth, h: e.currentTarget.offsetHeight }) }}
          onError={() => setImgLoaded(true)}
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rot}deg)`, opacity: imgLoaded ? 1 : 0 }}
        />
      </div>
      {scale > 1 && base.w > 0 && rot % 360 === 0 && (() => {
        const SW = window.innerWidth, SH = window.innerHeight
        const cl = (v: number) => Math.min(1, Math.max(0, v))
        const l = cl(((-SW / 2 - tx) / scale + base.w / 2) / base.w)
        const r = cl(((SW / 2 - tx) / scale + base.w / 2) / base.w)
        const t = cl(((-SH / 2 - ty) / scale + base.h / 2) / base.h)
        const b = cl(((SH / 2 - ty) / scale + base.h / 2) / base.h)
        return (
          <div className="ph-map" onClick={(e) => e.stopPropagation()}>
            <img src={photo.largeUrl ?? photo.thumbUrl ?? ''} alt="" />
            <span className="ph-map-rect" style={{ left: `${l * 100}%`, top: `${t * 100}%`, width: `${(r - l) * 100}%`, height: `${(b - t) * 100}%` }} />
          </div>
        )
      })()}
      {index < total - 1 && <button className="ph-lb-nav next" onClick={onNext} aria-label="Next">›</button>}

      <div className="ph-lb-caption">{photo.fileName || 'Photo'}</div>
    </div>
  )
}

type CatPhoto = ClaimPhoto & { cat: string }

function PhotoThumb({ photo, onOpen, onDownload }: { photo: CatPhoto; onOpen: () => void; onDownload: () => void }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="ph-thumb" onClick={onOpen} role="button" tabIndex={0} title={photo.fileName ?? ''}>
      {!loaded && <span className="ph-skel" />}
      <img
        src={photo.thumbUrl ?? ''}
        alt={photo.fileName ?? 'Photo'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
      <button type="button" className="ph-dl" title="Download photo" onClick={(e) => { e.stopPropagation(); onDownload() }}>
        <IconDownload size={15} />
      </button>
      <span className="ph-thumb-cap">{photo.fileName || photo.cat}</span>
    </div>
  )
}

function photoCategory(t: string | null): string {
  const s = (t || '').trim().toLowerCase()
  if (!s) return 'Other'
  if (s.includes('check')) return 'Check In'
  if (s.includes('additional')) return 'Additional'
  if (s.includes('ready')) return 'Ready'
  if (s.includes('assess')) return 'Assessment'
  if (s.includes('stock')) return 'Stock In'
  if (s === 'photos' || s === 'photo' || /\bphotos?\b/.test(s)) return 'Photos'
  return 'Other'
}

function PhotosTab({ claim }: { claim: Claim }) {
  const toast = useToast()
  const [all, setAll] = useState<ClaimPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [light, setLight] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [prog, setProg] = useState({ done: 0, total: 0 })

  const v = claim.vehicle_information
  const vehicleName = [v?.make, v?.model, v?.license_plate].filter(Boolean).join(' ').trim() || claim.dr_number || 'photos'

  const download = async (photos: ClaimPhoto[], suffix?: string) => {
    if (downloading) return
    const files = photos
      .filter((p) => p.originalUrl)
      .map((p) => ({ url: p.originalUrl as string, name: p.fileName || 'photo', date: p.createdAt }))
    if (files.length === 0) { toast('No downloadable photos here.', 'error'); return }
    setDownloading(true)
    setProg({ done: 0, total: files.length })
    try {
      await downloadPhotosZip(
        suffix ? `${vehicleName} - ${suffix}` : vehicleName,
        files,
        (done, total) => setProg({ done, total }),
      )
      toast('Download ready', 'success')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Download failed', 'error')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const acc: ClaimPhoto[] = []
        let offset = 0
        for (let i = 0; i < 10; i++) {
          const r = await getClaimPhotos(claim.claim_id, null, 100, offset)
          acc.push(...r.photos)
          if (!r.hasMore || r.photos.length === 0) break
          offset += r.photos.length
        }
        if (on) setAll(acc)
      } catch {
        if (on) setAll([])
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id])

  const withCat = useMemo<CatPhoto[]>(() => all.map((p) => ({ ...p, cat: photoCategory(p.photoType) })), [all])
  const categories = useMemo(() => {
    const m = new Map<string, number>()
    withCat.forEach((p) => m.set(p.cat, (m.get(p.cat) ?? 0) + 1))
    return Array.from(m.entries()).map(([name, count]) => ({ name, count }))
  }, [withCat])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return withCat.filter((p) =>
      (cat === 'all' || p.cat === cat) &&
      (!q || (p.fileName ?? '').toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)),
    )
  }, [withCat, search, cat])
  const groups = useMemo(() => {
    const order = categories.map((c) => c.name)
    const byCat = new Map<string, CatPhoto[]>()
    filtered.forEach((p) => { const a = byCat.get(p.cat) ?? []; a.push(p); byCat.set(p.cat, a) })
    return order.filter((n) => byCat.has(n)).map((n) => ({ name: n, photos: byCat.get(n)! }))
  }, [filtered, categories])
  const flat = useMemo(() => groups.flatMap((g) => g.photos), [groups])
  const indexById = useMemo(() => {
    const m = new Map<string, number>()
    flat.forEach((p, i) => m.set(p.id, i))
    return m
  }, [flat])

  const cur = light != null ? flat[light] : null
  const step = (d: number) => setLight((i) => {
    if (i == null) return i
    const n = i + d
    return n >= 0 && n < flat.length ? n : i
  })

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconCamera size={18} /></span>
            <div>
              <div className="cv-card-title">Photos</div>
              <div className="cv-card-sub">{all.length} photo{all.length === 1 ? '' : 's'} on this claim</div>
            </div>
          </div>
          <div className="ph-head-actions">
            <div className="search rm-search" style={{ maxWidth: 240 }}>
              <span className="search-icon" aria-hidden><IconSearch size={17} /></span>
              <input placeholder="Search photos…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {flat.length > 0 && (
              <button className="btn-ghost" onClick={() => download(flat, cat === 'all' ? undefined : cat)} disabled={downloading}>
                <IconDownload size={15} /> {downloading ? 'Zipping…' : 'Download all'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <Loader label="Loading photos…" />
        ) : all.length === 0 ? (
          <div className="ph-empty">
            <svg className="ph-empty-art" viewBox="0 0 220 170" role="img" aria-label="No photos">
              <defs>
                <linearGradient id="phg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#1b3a6b" />
                  <stop offset="1" stopColor="#b00830" />
                </linearGradient>
              </defs>
              <ellipse cx="110" cy="150" rx="70" ry="9" fill="rgba(16,24,40,0.06)" />
              <rect x="44" y="44" width="132" height="92" rx="12" fill="#eef1f8" />
              <rect x="44" y="44" width="132" height="92" rx="12" fill="none" stroke="#dbe3f0" strokeWidth="2" />
              <circle cx="150" cy="68" r="9" fill="#f5c84b" />
              <path d="M56 124l30-34 22 24 16-16 28 26z" fill="url(#phg)" opacity="0.85" />
              <path d="M56 124l30-34 22 24 16-16 28 26" fill="none" stroke="url(#phg)" strokeWidth="2" strokeLinejoin="round" />
              <g>
                <rect x="118" y="96" width="58" height="42" rx="9" fill="#fff" stroke="url(#phg)" strokeWidth="3" />
                <path d="M129 96l5-7h26l5 7" fill="none" stroke="url(#phg)" strokeWidth="3" strokeLinejoin="round" />
                <circle cx="147" cy="116" r="11" fill="none" stroke="url(#phg)" strokeWidth="3" />
              </g>
            </svg>
            <div className="ph-empty-title">No photos on this claim yet</div>
            <div className="ph-empty-sub">Photos synced from the workshop will show up here automatically.</div>
          </div>
        ) : (
          <>
            <div className="ph-cats">
              <button className={`chip-f${cat === 'all' ? ' active' : ''}`} onClick={() => setCat('all')}>
                All <span className="chip-count">{all.length}</span>
              </button>
              {categories.map((c) => (
                <button key={c.name} className={`chip-f${cat === c.name ? ' active' : ''}`} onClick={() => setCat(c.name)}>
                  {c.name} <span className="chip-count">{c.count}</span>
                </button>
              ))}
            </div>

            {groups.length === 0 ? (
              <div className="up-empty">No photos match your search.</div>
            ) : (
              groups.map((g) => (
                <div key={g.name} className="ph-block">
                  <div className="ph-block-head">
                    <span>{g.name} <span className="ph-block-count">{g.photos.length}</span></span>
                    <button className="ph-dl-block" onClick={() => download(g.photos, g.name)} disabled={downloading} title={`Download all ${g.name} photos`}>
                      <IconDownload size={14} /> Download
                    </button>
                  </div>
                  <div className="ph-grid">
                    {g.photos.map((p) => (
                      <PhotoThumb key={p.id} photo={p} onOpen={() => setLight(indexById.get(p.id) ?? null)} onDownload={() => download([p])} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </section>

      {cur && light != null && (
        <PhotoLightbox
          key={cur.id}
          photo={cur}
          index={light}
          total={flat.length}
          onClose={() => setLight(null)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onDownload={() => download([cur])}
        />
      )}

      {downloading && (
        <div className="ph-dl-toast">
          <span className="ph-dl-spin" />
          <span>Preparing photos… {prog.done} / {prog.total}{prog.done >= prog.total && prog.total > 0 ? ' · zipping' : ''}</span>
        </div>
      )}
    </div>
  )
}

function ModerationTab({ claim, userId, onChanged }: { claim: Claim; userId: string; onChanged: () => void }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<ModerationUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [modType, setModType] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const u = await getModerationUploads(claim.claim_id)
        if (on) setUploads(u)
      } catch {
        if (on) setUploads([])
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id, reload])

  const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
  const pick = (f: File | null) => {
    if (f && !isPdf(f)) { toast('Only PDF files can be uploaded here.', 'error'); return }
    if (f && f.size > UPLOAD_MAX) { toast('File is too large (max 25 MB).', 'error'); return }
    setFile(f)
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0] ?? null) }

  const upload = async () => {
    if (!file) { toast('Choose a file to upload.', 'error'); return }
    if (!modType) { toast('Select a moderation document type.', 'error'); return }
    setUploading(true)
    try {
      await uploadModerationDocument(claim.claim_id, userId, modType, file)
      toast('Moderation document uploaded', 'success')
      setFile(null); setModType('')
      if (fileRef.current) fileRef.current.value = ''
      setReload((r) => r + 1)
      // The backend may auto-advance the status (Preliminary Conversion → Moderation).
      // Refresh now and again shortly after, in case the change lands just after upload.
      onChanged()
      setTimeout(() => onChanged(), 1800)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic violet"><IconShield size={18} /></span>
            <div>
              <div className="cv-card-title">Upload Moderation Document</div>
              <div className="cv-card-sub">Some types auto-advance the claim status</div>
            </div>
          </div>
        </div>
        <SelectField label="Moderation Document Type" value={modType} onChange={setModType} options={MODERATION_TYPES.map((t) => ({ value: t, label: t }))} required placeholder="Select type…" />
        <div
          className={`upload-drop${dragging ? ' drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          {file ? (
            <div className="upload-picked">
              <span className="doc-row-icon"><IconFilePdf size={20} /></span>
              <div>
                <div className="upload-picked-name">{file.name}</div>
                <div className="doc-row-meta">{formatFileSize(file.size)}</div>
              </div>
              <button type="button" className="btn-ghost sm" onClick={(e) => { e.stopPropagation(); pick(null); if (fileRef.current) fileRef.current.value = '' }}>Remove</button>
            </div>
          ) : (
            <div className="upload-hint">
              <strong>Click to choose a PDF</strong> or drag &amp; drop it here
              <div className="muted">PDF only — up to 25 MB</div>
            </div>
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: 14 }}>
          <div className="modal-actions-right">
            <button className="new-claim" onClick={upload} disabled={uploading || !file || !modType}>
              <IconPlus size={16} /> {uploading ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic green"><IconDocuments size={18} /></span>
            <div>
              <div className="cv-card-title">Moderation Documents</div>
              <div className="cv-card-sub">{uploads.length} document{uploads.length === 1 ? '' : 's'}</div>
            </div>
          </div>
        </div>
        {loading ? (
          <Loader label="Loading documents…" />
        ) : uploads.length === 0 ? (
          <div className="up-empty">No moderation documents uploaded yet.</div>
        ) : (
          <div className="up-list">
            {uploads.map((u) => (
              <a key={u.id} className="up-file" href={u.fileUrl ?? '#'} target="_blank" rel="noreferrer">
                <span className="up-file-ic"><IconFilePdf size={20} /></span>
                <div className="up-file-main">
                  <span className="up-file-title">{u.fileName || u.moderationType || 'Document'}</span>
                  <span className="up-file-meta">
                    {u.moderationType && <span className="up-file-cat">{u.moderationType}</span>}
                    {u.uploadedBy ? `${u.uploadedBy} · ` : ''}{u.date ?? ''}
                  </span>
                </div>
                <span className="up-file-open"><IconExternal size={16} /></span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface FinForm {
  originalQuote: string; originalParts: string
  approvedQuote: string; approvedParts: string
  additionalQuote: string; additionalParts: string
  precosting: string; jobFinalCosting: string; partsFinalCosting: string
  finalComments: string
}

function ROField({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} readOnly />
    </label>
  )
}

function ROCheck({ label, on }: { label: string; on: boolean }) {
  return (
    <label className="fin-check">
      <input type="checkbox" checked={on} disabled readOnly />
      <span>{label}</span>
    </label>
  )
}

function FinancialTab({ claim, userId, onDirtyChange, onSaved }: { claim: Claim; userId: string; onDirtyChange: (d: boolean) => void; onSaved: () => void }) {
  const toast = useToast()
  const { branchId } = useAuth()
  const drNo = parseInt(claim.dr_number ?? '', 10)
  const [data, setData] = useState<FinancialData | null>(null)
  const [form, setForm] = useState<FinForm | null>(null)
  const [initialJSON, setInitialJSON] = useState('')
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!Number.isFinite(drNo)) { setLoadErr('This claim has no DR number, so financial data is unavailable.'); return }
      try {
        const d = await getTmsFinancialData(claim.claim_id, drNo, branchId)
        if (!on) return
        if (!d) { setLoadErr('Could not load financial data.'); return }
        setData(d)
        const str = (n: number | null) => (n != null ? String(n) : '')
        const f: FinForm = {
          originalQuote: str(d.originalQuote), originalParts: str(d.originalParts),
          approvedQuote: str(d.approvedQuote), approvedParts: str(d.approvedParts),
          additionalQuote: str(d.additionalQuote), additionalParts: str(d.additionalParts),
          precosting: str(d.precosting), jobFinalCosting: str(d.jobFinalCosting),
          partsFinalCosting: str(d.partsFinalCosting), finalComments: d.finalComments,
        }
        setForm(f); setInitialJSON(JSON.stringify(f))
      } catch (e: unknown) {
        if (on) setLoadErr(e instanceof Error ? e.message : 'Failed to load financial data')
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id, drNo, branchId])

  const dirty = !!form && JSON.stringify(form) !== initialJSON
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  if (loadErr) return <div className="cd-tab-body"><div className="empty">{loadErr}</div></div>
  if (!data || !form) return <div className="cd-tab-body"><Loader label="Loading financial data…" /></div>
  const f = form
  const set = (k: keyof FinForm) => (v: string) => setForm((p) => (p ? { ...p, [k]: v } : p))
  const ro = (n: number | null) => money(n ?? 0)

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      await updateFinancialData(claim.claim_id, drNo, userId, f)
      toast('Financial data saved', 'success')
      onSaved()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const cosTone = (pct: number | null) => (pct == null ? 'muted' : pct > 75 ? 'red' : pct > 60 ? 'amber' : 'green')

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconMoney size={18} /></span>
            <div>
              <div className="cv-card-title">Conversions &amp; Quoting</div>
              <div className="cv-card-sub">Parts value includes markup · ex. VAT</div>
            </div>
          </div>
          <div className="cv-save-area">
            {dirty && <span className="cv-flag ok">✓ Ready to save</span>}
            <button className="new-claim" onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
        <div className="form-grid">
          <CField label="Original Quote" value={f.originalQuote} onChange={set('originalQuote')} placeholder="R 0,00" />
          <CField label="Original Parts" value={f.originalParts} onChange={set('originalParts')} placeholder="R 0,00" />
          <CField label="Approved Quote" value={f.approvedQuote} onChange={set('approvedQuote')} placeholder="R 0,00" />
          <CField label="Approved Parts" value={f.approvedParts} onChange={set('approvedParts')} placeholder="R 0,00" />
          <CField label="Additional Quote" value={f.additionalQuote} onChange={set('additionalQuote')} placeholder="R 0,00" />
          <CField label="Additional Parts" value={f.additionalParts} onChange={set('additionalParts')} placeholder="R 0,00" />
          <ROField label="Current Job Value" value={ro(data.currentJobValue)} />
          <ROField label="Current Parts Value" value={ro(data.currentPartsValue)} />
          <label className="field">
            <span>Pre - Costing / Projected Parts Cost</span>
            <div className="fin-cos">
              <input value={f.precosting} onChange={(e) => set('precosting')(e.target.value)} placeholder="R 0,00" />
              <span className={`fin-cos-pct ${cosTone(data.projectedCos)}`}>Projected COS {data.projectedCos ?? 0}%</span>
            </div>
          </label>
          <label className="field">
            <span>Creditors Parts Cost</span>
            <div className="fin-cos">
              <input value={ro(data.creditorsPartsCost)} readOnly />
              <span className={`fin-cos-pct ${cosTone(data.actualCos)}`}>Actual COS {data.actualCos ?? 0}%</span>
            </div>
          </label>
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic violet"><IconCar size={18} /></span>
            <div>
              <div className="cv-card-title">Vehicle Evaluation</div>
              <div className="cv-card-sub">Insurer valuation figures</div>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <ROField label="Insured Value" value={ro(data.insuredValue)} />
          <ROField label="Retail" value={ro(data.retail)} />
          <ROField label="Trade" value={ro(data.trade)} />
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic green"><IconReports size={18} /></span>
            <div>
              <div className="cv-card-title">Final Costing</div>
              <div className="cv-card-sub">Parts exclude markup</div>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <CField label="Job Final Costing / Latest Value" value={f.jobFinalCosting} onChange={set('jobFinalCosting')} placeholder="R 0,00" />
          <CField label="Parts Final Costing / Latest Value" value={f.partsFinalCosting} onChange={set('partsFinalCosting')} placeholder="R 0,00" />
        </div>
        <TArea label="Final Comments" value={f.finalComments} onChange={set('finalComments')} rows={3} />
        <div className="fin-checks">
          <ROCheck label="Confirm Costing Sent" on={data.costingSent} />
          <ROCheck label="Confirm Costing Received" on={data.costingReceived} />
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic amber"><IconFilePdf size={18} /></span>
            <div>
              <div className="cv-card-title">Invoicing &amp; Distribution</div>
              <div className="cv-card-sub">Parts exclude markup</div>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <ROField label="Job Invoiced Value (incl Excess)" value={ro(data.jobInvoicedValue)} />
          <ROField label="Parts Invoiced Value" value={ro(data.partsInvoicedValue)} />
          <ROField label="Excess Amount" value={ro(data.excessAmount)} />
        </div>
        <div className="fin-disttrack">
          <div className="fin-disttrack-head">Insured Value</div>
          <div className="fin-checks">
            <ROCheck label="Invoice Sent" on={data.invoiceSent} />
            <ROCheck label="Invoice Confirmed" on={data.invoiceConfirmed} />
          </div>
        </div>
      </section>
    </div>
  )
}

interface JSForm {
  towingId: string; towingName: string
  storeId: string; storeName: string
  diagnosticReff: string
  partsBuyerId: string; csaId: string; estimatorId: string; productiveStaffId: string
  towReference: string
  reasonId: string
  upsellStatus: string; upsellComment: string; upsellValue: string
  upsellSuggested: boolean; hail: boolean; otherBranch: boolean; nonComm: boolean
}

function JobStaffTab({ claim, userId, onDirtyChange, onSaved }: { claim: Claim; userId: string; onDirtyChange: (d: boolean) => void; onSaved: () => void }) {
  const toast = useToast()
  const { branchId } = useAuth()
  const [form, setForm] = useState<JSForm | null>(null)
  const [initialJSON, setInitialJSON] = useState('')
  const [meta, setMeta] = useState<{ isComeback: boolean; towDriveIn: string | null }>({ isComeback: false, towDriveIn: null })
  const [saving, setSaving] = useState(false)
  const [towing, setTowing] = useState<IdName[]>([])
  const [stores, setStores] = useState<IdName[]>([])
  const [reasons, setReasons] = useState<NotProceedingReason[]>([])
  const [csas, setCsas] = useState<RoleMember[]>([])
  const [estimators, setEstimators] = useState<RoleMember[]>([])
  const [partsBuyers, setPartsBuyers] = useState<RoleMember[]>([])
  const [production, setProduction] = useState<RoleMember[]>([])

  useEffect(() => {
    let on = true
    const run = async () => {
      const [d, tw, st, rs, cs, es, pb, pr] = await Promise.all([
        getJobStaffDetails(claim.claim_id, userId).catch(() => null),
        getTowingCompanies().catch(() => []),
        getStores().catch(() => []),
        getNotProceedingReasons().catch(() => []),
        getCsas({ branchId, active: true }).catch(() => []),
        getEstimators({ branchId, active: true }).catch(() => []),
        getPartsBuyers({ branchId, active: true }).catch(() => []),
        getProductionStaff({ branchId, active: true }).catch(() => []),
      ])
      if (!on) return
      setTowing(tw); setStores(st); setReasons(rs); setCsas(cs); setEstimators(es); setPartsBuyers(pb); setProduction(pr)
      if (d) {
        const f: JSForm = {
          towingId: d.towingCompanyId != null ? String(d.towingCompanyId) : '',
          towingName: (d.towingCompanyName ?? '').trim(),
          storeId: d.storeId != null ? String(d.storeId) : '',
          storeName: (d.storeName ?? '').trim(),
          diagnosticReff: d.diagnosticReff,
          partsBuyerId: d.partsBuyerId ?? '',
          csaId: d.csaId ?? '',
          estimatorId: d.estimatorId ?? '',
          productiveStaffId: d.productiveStaffId ?? '',
          towReference: d.towReference,
          reasonId: d.notProceedingReasonId != null ? String(d.notProceedingReasonId) : '',
          upsellStatus: d.upsellStatus,
          upsellComment: d.upsellComment,
          upsellValue: d.upsellValue != null ? String(d.upsellValue) : '',
          upsellSuggested: d.upsellSuggested,
          hail: d.hailDamageVehicle,
          otherBranch: d.vehicleFromOtherBranch,
          nonComm: d.isNonCommissionableTow,
        }
        setForm(f)
        setInitialJSON(JSON.stringify(f))
        setMeta({ isComeback: d.isComeback, towDriveIn: d.towDriveIn })
      }
    }
    void run()
    return () => { on = false }
  }, [claim.claim_id, userId, branchId])

  const dirty = !!form && JSON.stringify(form) !== initialJSON
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  if (!form) return <div className="cd-tab-body"><Loader label="Loading job details…" /></div>
  const f = form

  const set = (k: keyof JSForm) => (v: string) => setForm((p) => (p ? { ...p, [k]: v } : p))
  const tog = (k: keyof JSForm) => () => setForm((p) => (p ? { ...p, [k]: !p[k] } : p))
  const onTowing = (name: string) => {
    const m = towing.find((t) => t.name === name)
    setForm((p) => (p ? { ...p, towingName: name, towingId: m ? String(m.id) : '' } : p))
  }
  const onStore = (name: string) => {
    const m = stores.find((s) => s.name === name)
    setForm((p) => (p ? { ...p, storeName: name, storeId: m ? String(m.id) : '' } : p))
  }

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      await updateClaimJobStaffDetails(claim.claim_id, userId, {
        towingCompanyId: f.towingId,
        storeId: f.storeId,
        diagnosticReff: f.diagnosticReff,
        partsBuyerId: f.partsBuyerId,
        csaId: f.csaId,
        estimatorId: f.estimatorId,
        productiveStaffId: f.productiveStaffId,
        towReference: f.towReference,
        notProceedingReasonId: f.reasonId,
        upsellStatus: f.upsellStatus,
        upsellComment: f.upsellComment,
        upsellValue: f.upsellValue.replace(/[^\d.]/g, ''),
        upsellSuggested: f.upsellSuggested,
        hailDamageVehicle: f.hail,
        vehicleFromOtherBranch: f.otherBranch,
        isNonCommissionableTow: f.nonComm,
      })
      toast('Job/staff details saved', 'success')
      onSaved()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Only current-branch staff are listed; an assigned person from another branch
  // is not shown (the field falls back to the placeholder).
  const memberOpts = (rows: RoleMember[]) => rows.map((r) => ({ value: r.id, label: r.name }))

  return (
    <div className="cv-form">
      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic blue"><IconBriefcase size={18} /></span>
            <div>
              <div className="cv-card-title">Job Routing</div>
              <div className="cv-card-sub">Intake type, towing and references</div>
            </div>
          </div>
          <div className="cv-save-area">
            {dirty && <span className="cv-flag ok">✓ Ready to save</span>}
            <button className="new-claim" onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
        <div className="form-grid">
          <SelectField label="New / Comeback" value={meta.isComeback ? 'Comeback' : 'New'} onChange={() => {}} options={[{ value: 'New', label: 'New' }, { value: 'Comeback', label: 'Comeback' }]} disabled />
          <SelectField label="TOW / Drive IN" value={meta.towDriveIn === 'T' ? 'TOW' : meta.towDriveIn === 'D' ? 'Drive IN' : ''} onChange={() => {}} options={[{ value: 'TOW', label: 'TOW' }, { value: 'Drive IN', label: 'Drive IN' }]} disabled placeholder="—" />
          <Combobox label="Towing Company" value={f.towingName} onChange={onTowing} options={towing.map((t) => t.name)} placeholder="Select towing company…" />
          <Combobox label="Parts Rack Reference" value={f.storeName} onChange={onStore} options={stores.map((s) => s.name)} placeholder="Select…" />
          <CField label="Diagnostic Reference" value={f.diagnosticReff} onChange={set('diagnosticReff')} />
          <CField label="Tow Reference" value={f.towReference} onChange={set('towReference')} />
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic green"><IconUser size={18} /></span>
            <div>
              <div className="cv-card-title">Assigned Team</div>
              <div className="cv-card-sub">Staff responsible for this job</div>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <SelectField label="Customer Service Agent" value={f.csaId} onChange={set('csaId')} options={memberOpts(csas)} placeholder="Select…" allowUnknown={false} />
          <SelectField label="Estimator" value={f.estimatorId} onChange={set('estimatorId')} options={memberOpts(estimators)} placeholder="Select…" allowUnknown={false} />
          <SelectField label="Parts Buyer" value={f.partsBuyerId} onChange={set('partsBuyerId')} options={memberOpts(partsBuyers)} placeholder="Select…" allowUnknown={false} />
          <SelectField label="Production Staff Member" value={f.productiveStaffId} onChange={set('productiveStaffId')} options={memberOpts(production)} placeholder="Select…" allowUnknown={false} />
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic violet"><IconMoney size={18} /></span>
            <div>
              <div className="cv-card-title">Upsell &amp; Conversion</div>
              <div className="cv-card-sub">Upsell tracking and not-proceeding reason</div>
            </div>
          </div>
        </div>
        <div className="form-grid">
          <SelectField label="Reason for not proceeding" value={f.reasonId} onChange={set('reasonId')} options={reasons.map((r) => ({ value: String(r.id), label: r.reason }))} placeholder="Select…" />
          <SelectField label="Upsell Status" value={f.upsellStatus} onChange={set('upsellStatus')} options={UPSELL_STATUS_OPTS.map((s) => ({ value: s, label: s }))} placeholder="Select…" />
          <CField label="Upsell Comment" value={f.upsellComment} onChange={set('upsellComment')} />
          <CField label="Upsell Value (R)" value={f.upsellValue} onChange={set('upsellValue')} placeholder="R 0,00" />
        </div>
        <div className="cv-switches" style={{ marginTop: 14 }}>
          <SwitchRow label="Upsell Suggested" on={f.upsellSuggested} onToggle={tog('upsellSuggested')} />
        </div>
      </section>

      <section className="cv-card">
        <div className="cv-card-head">
          <div className="cv-card-titlewrap">
            <span className="cv-card-ic amber"><IconBolt size={18} /></span>
            <div>
              <div className="cv-card-title">Flags</div>
              <div className="cv-card-sub">Additional job indicators</div>
            </div>
          </div>
        </div>
        <div className="cv-switches">
          <SwitchRow label="Hail Damage Vehicle" on={f.hail} onToggle={tog('hail')} />
          <SwitchRow label="Vehicle from Other Branch" on={f.otherBranch} onToggle={tog('otherBranch')} />
          <SwitchRow label="None Commissionable TOW" on={f.nonComm} onToggle={tog('nonComm')} />
        </div>
      </section>
    </div>
  )
}

type TransitionIssue = { title: string; detail: string }

function StatusControl({
  claimId, current, userId, userType, onChanged, disabled = false, disabledReason,
  validateTransition, hint,
}: {
  claimId: string
  current: string | null
  userId: string
  userType: string
  onChanged: () => void
  disabled?: boolean
  disabledReason?: string
  // Returns a list of blocking issues; empty array means the move is allowed.
  validateTransition?: (current: string | null, target: string) => Promise<TransitionIssue[]>
  // Optional informational hint shown at the top of the open dropdown.
  hint?: string
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [blockIssues, setBlockIssues] = useState<TransitionIssue[]>([])
  const [validating, setValidating] = useState<string | null>(null)

  const pickOption = async (s: string) => {
    setBlockIssues([])
    if (validateTransition) {
      setValidating(s)
      try {
        const issues = await validateTransition(current, s)
        if (issues.length > 0) { setBlockIssues(issues); return }
      } finally {
        setValidating(null)
      }
    }
    setPending(s)
  }

  const toggle = () => {
    if (disabled) return
    const next = !open
    setBlockIssues([])
    setOpen(next)
    // Always fetch fresh transitions each time the dropdown opens, so the
    // available options reflect the claim's current status.
    if (next) {
      setLoading(true)
      const run = async () => {
        try {
          const r = await getStatusTransitions(claimId, userId)
          setOptions(r.available)
        } catch {
          setOptions([])
        } finally {
          setLoading(false)
        }
      }
      void run()
    }
  }

  const confirm = async () => {
    if (!pending) return
    setSaving(true)
    try {
      await updateClaimStatus(claimId, pending, userId, userType)
      toast('Status updated', 'success')
      setPending(null)
      setOpen(false)
      onChanged()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to update status', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cd-status-wrap">
      {open && <div className="cd-status-backdrop" onClick={() => setOpen(false)} />}
      <button
        className={`cd-status${disabled ? ' is-disabled' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-disabled={disabled}
        title={disabled ? (disabledReason ?? 'Status changes are locked for this job') : undefined}
      >
        {current || '—'}
        {disabled ? <IconLock size={15} /> : <IconChevron size={16} />}
      </button>
      {disabled && disabledReason && <div className="cd-status-lockmsg">{disabledReason}</div>}
      {!disabled && open && (
        <div className="cd-status-menu">
          {hint && (
            <div className="cd-status-hint">
              <span className="cd-status-hint-ic"><IconShield size={14} /></span>
              <span>{hint}</span>
            </div>
          )}
          <div className="cd-status-menu-head">Change status to…</div>
          {loading ? (
            <div className="cd-status-msg">Loading…</div>
          ) : options.length === 0 ? (
            <div className="cd-status-msg">No transitions available</div>
          ) : (
            options.map((s) => (
              <button
                key={s}
                className="cd-status-opt"
                onClick={() => void pickOption(s)}
                disabled={validating !== null}
              >
                {s}
                {validating === s && <span className="cd-status-opt-spin">Checking…</span>}
              </button>
            ))
          )}
          {blockIssues.length > 0 && (
            <div className="cd-status-blocks" role="alert">
              <div className="cd-status-blocks-head">
                <IconAlert size={14} /> Can’t move to this status yet
              </div>
              {blockIssues.map((issue, i) => (
                <div className="cd-status-block" key={i}>
                  <span className="cd-status-block-ic"><IconAlert size={15} /></span>
                  <div className="cd-status-block-text">
                    <span className="cd-status-block-title">{issue.title}</span>
                    <span className="cd-status-block-msg">{issue.detail}</span>
                  </div>
                  <button
                    className="cd-status-block-x"
                    onClick={() => setBlockIssues((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Dismiss"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pending && (
        <div className="modal-overlay" onClick={() => !saving && setPending(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Change claim status?</div>
            <div className="modal-body">
              <p className="cd-status-confirm">
                <span className="cd-status-from">{current || '—'}</span>
                <span className="cd-status-arrow">→</span>
                <span className="cd-status-to">{pending}</span>
              </p>
              <p className="muted">This will update the claim status and log the change.</p>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-right">
                <button className="btn-ghost" onClick={() => setPending(null)} disabled={saving}>Cancel</button>
                <button className="new-claim" onClick={confirm} disabled={saving}>
                  {saving ? 'Updating…' : 'Confirm change'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface OverviewData {
  keyDates: ClaimKeyDates | null
  quote: ClaimQuoteSummary | null
  issues: ClaimIssue[]
  progress: ClaimProgress | null
  timeLeft: string
}

// Computed at fetch time (uses Date.now, so kept out of render).
function computeTimeLeft(kd: ClaimKeyDates | null): string {
  const k = kd?.keyDates ?? {}
  if (k.actual_completion?.date) return 'Delivered'
  const promised = k.promised_delivery?.date
  if (!promised) return 'SLA on track'
  const d = Math.ceil((new Date(promised).getTime() - Date.now()) / 86_400_000)
  return d >= 0 ? `${d}d left` : `${-d}d overdue`
}

function Overview({ claim, data }: { claim: Claim; data: OverviewData | null }) {
  const fin = claim.financial
  const tl = claim.timeline
  const kd = data?.keyDates ?? null
  const quote = data?.quote ?? null
  const issues = data?.issues ?? []
  const k = kd?.keyDates ?? {}

  // Job Timeline — prefer the dedicated key-dates/status-duration endpoint.
  const daysInStatus = kd?.daysInCurrentStatus ?? tl?.days_in_workshop ?? 0
  const totalDaysActive = kd?.totalDaysActive ?? tl?.days_in_workshop ?? 0
  const currentStatus = kd?.currentStatus ?? claim.status ?? 'N/A'

  // Time Left — computed at fetch time (see computeTimeLeft).
  const timeLeft = data?.timeLeft ?? 'SLA on track'

  // Financial — prefer the quotes endpoint, fall back to claim details.
  const original = quote?.original ?? fin?.estimated_amount ?? fin?.quote_value
  const approved = quote?.approved ?? fin?.approved_amount ?? fin?.approved_value
  const finalAmt = fin?.invoice_value ?? quote?.total

  // Repair progress — prefer the progress endpoint.
  const prog = data?.progress?.percentage ?? Math.max(0, Math.min(100, Number(claim.repair_progress?.overall_progress ?? 0)))
  const stage = data?.progress?.currentMilestone ?? claim.repair_progress?.current_stage

  return (
    <div className="cd-overview-grid">
      <div className="cd-main-col">
        <div className="cd-card">
          <div className="cd-card-title"><span className="cd-ic blue"><IconClock size={18} /></span> Job Timeline</div>
          <div className="cd-stat-row">
            <div className="cd-stat">
              <span className="cd-stat-ic"><IconClock size={16} /></span>
              <span className="cd-stat-val">{daysInStatus}</span>
              <span className="cd-stat-label">Days in Status</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-ic"><IconCalendar size={16} /></span>
              <span className="cd-stat-val">{totalDaysActive}</span>
              <span className="cd-stat-label">Total Days Active</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-ic"><IconShield size={16} /></span>
              <span className="cd-stat-val sm">{timeLeft}</span>
              <span className="cd-stat-label">Time Left</span>
            </div>
            <div className="cd-stat hl">
              <span className="cd-stat-ic"><IconBolt size={16} /></span>
              <span className="cd-stat-val sm">{currentStatus}</span>
              <span className="cd-stat-label">Status</span>
            </div>
          </div>
        </div>

        <div className="cd-card">
          <div className="cd-card-title"><span className="cd-ic green"><IconMoney size={18} /></span> Financial Snapshot</div>
          <div className="cd-fin-row">
            <div className="cd-fin blue"><span className="cd-fin-ic"><IconMoney size={16} /></span><span>Original Quote</span><strong>{m(original)}</strong></div>
            <div className="cd-fin green"><span className="cd-fin-ic"><IconShield size={16} /></span><span>Approved Quote</span><strong>{m(approved)}</strong></div>
            <div className="cd-fin pink"><span className="cd-fin-ic"><IconFilePdf size={16} /></span><span>Final Amount</span><strong>{m(finalAmt)}</strong></div>
          </div>
        </div>

        <div className="cd-card">
          <div className="cd-card-title"><span className="cd-ic amber"><IconAlert size={18} /></span> Top Key Issues</div>
          {issues.length === 0 ? (
            <div className="cd-allclear">
              <div className="cd-allclear-icon">✓</div>
              <div className="cd-allclear-title">All Clear!</div>
              <div className="cd-allclear-sub">No action items or blockers detected. Claim is progressing on schedule.</div>
            </div>
          ) : (
            <div className="cd-issues">
              {issues.map((i) => (
                <div key={i.id} className={`cd-issue sev-${(i.severity ?? 'low').toLowerCase()}${i.isResolved ? ' resolved' : ''}`}>
                  <span className="cd-issue-sev">{(i.severity ?? 'low').toUpperCase()}</span>
                  <div className="cd-issue-main">
                    <span className="cd-issue-title">{i.title || 'Issue'}</span>
                    {(i.subStatus || i.assignedToName) && (
                      <span className="cd-issue-meta">
                        {i.subStatus}{i.subStatus && i.assignedToName ? ' · ' : ''}{i.assignedToName ? `@ ${i.assignedToName}` : ''}
                      </span>
                    )}
                  </div>
                  {i.isResolved && <span className="cd-issue-done">Resolved</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="cd-side-col">
        <div className="cd-side-card">
          <div className="cd-side-title"><IconDocuments size={16} /> Disclaimer</div>
          <button className="cd-disclaimer-btn">
            <strong>Send Disclaimer</strong>
            <span>Generate Signing Link</span>
          </button>
        </div>

        <div className="cd-side-card">
          <div className="cd-side-title"><IconBolt size={16} /> Special Handling &amp; Priority</div>
          <div className="cd-toggle-row">
            <span className="cd-toggle-label"><span className="cd-toggle-ic blue"><IconGauge size={15} /></span> Speed Job</span>
            <Toggle on={claim.additional_info?.speed_shop === 'Yes'} />
          </div>
          <div className="cd-toggle-row">
            <span className="cd-toggle-label"><span className="cd-toggle-ic red"><IconFlag size={15} /></span> Targeted Priority</span>
            <Toggle on={!!claim.priority} />
          </div>
        </div>

        <div className="cd-side-card">
          <div className="cd-side-title"><IconCalendar size={16} /> Key Dates</div>
          <DateRow label="Intake Date" value={fmtDate(k.intake_date?.date ?? tl?.date_claim_received ?? tl?.claim_date)} />
          <DateRow label="Booking Date" value={fmtDate(k.booked_date?.date ?? tl?.date_booked)} />
          <DateRow label="Authorization Date" value={fmtDate(k.authorization_date?.date ?? tl?.authorization_date)} />
          <DateRow label="Conversion Date" value={fmtDate(k.conversion_date?.date ?? tl?.start_date)} />
          <DateRow label="Promised Delivery" value={fmtDate(k.promised_delivery?.date ?? tl?.target_date ?? tl?.expected_finish_date)} />
          <DateRow label="Expected Collection" value={fmtDate(k.expected_collection?.date ?? tl?.expected_collection_date)} />
          <DateRow label="Actual Completion" value={fmtDate(k.actual_completion?.date ?? tl?.completion_date)} />
        </div>

        <div className="cd-side-card">
          <div className="cd-side-title"><IconReports size={16} /> Repair Progress</div>
          <div className="cd-progress-head">
            <span>Overall Progress</span>
            <span>{prog}%</span>
          </div>
          <div className="cd-progress-bar"><span style={{ width: `${prog}%` }} /></div>
          {stage && <div className="cd-progress-stage">{stage}</div>}
        </div>
      </div>
    </div>
  )
}
