import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import {
  getReferralSources, getVehicleMakes, getVehicleModels, getEstimators, createNewEstimate, lookupVehicleForClaim,
  QUOTE_TYPES, type ReferralSource, type RoleMember, type NewEstimateResult, type VehicleLookup,
} from '../lib/api'
import { IconCar, IconUser, IconShield, IconAlert, IconReports, IconBriefcase, IconDocuments } from '../components/icons'
import { SearchSelect } from '../components/SearchSelect'

const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr']
const YEARS: string[] = (() => {
  const now = new Date().getFullYear() + 1
  const out: string[] = []
  for (let y = now; y >= 1980; y--) out.push(String(y))
  return out
})()
const todayISO = () => new Date().toISOString().slice(0, 10)

type YN = '' | 'yes' | 'no'

interface Form {
  jobType: 'drivable' | 'towed' | ''
  referredBy: string; title: string; firstName: string; surname: string
  cellPhone: string; email: string; alternativePhone: string; comments: string
  make: string; model: string; year: string; color: string; registration: string; warranty: YN
  accidentDate: string; damageDescription: string; additionalDamage: YN; otherRepairInformation: string
  rentalCar: YN; quoteType: string; sendAssessmentToBroker: YN
  estimatorId: string
  allowSms: boolean; allowEmail: boolean; allowPhone: boolean; allowWhatsapp: boolean; marketingConsent: YN
}

const EMPTY: Form = {
  jobType: '', referredBy: '', title: '', firstName: '', surname: '', cellPhone: '', email: '',
  alternativePhone: '', comments: '', make: '', model: '', year: '', color: '', registration: '',
  warranty: '', accidentDate: todayISO(), damageDescription: '', additionalDamage: '', otherRepairInformation: '',
  rentalCar: '', quoteType: '', sendAssessmentToBroker: '', estimatorId: '',
  allowSms: false, allowEmail: false, allowPhone: false, allowWhatsapp: false, marketingConsent: '',
}

const INITIAL_JSON = JSON.stringify(EMPTY)

const STEPS = [
  { id: 'job', label: 'Job Type', Icon: IconReports },
  { id: 'client', label: 'Client Details', Icon: IconUser },
  { id: 'vehicle', label: 'Vehicle Details', Icon: IconCar },
  { id: 'accident', label: 'Accident Details', Icon: IconAlert },
  { id: 'quote', label: 'Repair Quote', Icon: IconReports },
  { id: 'estimator', label: 'Estimator', Icon: IconBriefcase },
  { id: 'comms', label: 'Communication', Icon: IconDocuments },
] as const

export function NewClaim() {
  const { branchId, profile, branches } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [result, setResult] = useState<NewEstimateResult | null>(null)
  const [active, setActive] = useState<string>('job')
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [initialBranch] = useState(branchId)
  const [showImport, setShowImport] = useState(false)
  const [imported, setImported] = useState<string | null>(null)
  const location = useLocation()

  const [referrals, setReferrals] = useState<ReferralSource[]>([])
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [estimators, setEstimators] = useState<RoleMember[]>([])

  const branchName = branches.find((b) => b.id === branchId)?.branch_name ?? profile?.branch

  useEffect(() => {
    let on = true
    void (async () => {
      const [refs, mk, est] = await Promise.all([
        getReferralSources().catch(() => []),
        getVehicleMakes().catch(() => []),
        getEstimators({ branchId, active: true }).catch(() => []),
      ])
      if (!on) return
      setReferrals(refs); setMakes(mk); setEstimators(est)
    })()
    return () => { on = false }
  }, [branchId])

  useEffect(() => {
    let on = true
    void (async () => {
      if (!f.make) { if (on) setModels([]); return }
      const m = await getVehicleModels(f.make).catch(() => [])
      if (on) setModels(m)
    })()
    return () => { on = false }
  }, [f.make])

  // scroll-spy for the side rail
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    )
    STEPS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [result])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((e) => (e[k] ? { ...e, [k]: false } : e))
  }

  const applyLookup = (res: VehicleLookup) => {
    if (!res.found || !res.vehicle) return
    const v = res.vehicle
    const c = res.customer
    setF((p) => ({
      ...p,
      registration: v.registration || p.registration,
      make: v.make || p.make,
      model: v.model || p.model,
      year: v.year || p.year,
      color: v.color || p.color,
      ...(c ? {
        title: c.title || p.title,
        firstName: c.firstName || p.firstName,
        surname: c.surname || p.surname,
        email: c.email || p.email,
        cellPhone: c.cellPhone || p.cellPhone,
        alternativePhone: c.alternativePhone || p.alternativePhone,
        allowSms: c.allowSms, allowEmail: c.allowEmail, allowPhone: c.allowPhone, allowWhatsapp: c.allowWhatsapp,
      } : {}),
    }))
    setErrors({})
    const name = c?.firstName || c?.surname ? `${c?.firstName ?? ''} ${c?.surname ?? ''}`.trim() : null
    setImported(name ?? (v.registration || 'previous record'))
    setShowImport(false)
  }

  const commChosen = f.allowSms || f.allowEmail || f.allowPhone || f.allowWhatsapp
  const done: Record<string, boolean> = {
    job: !!f.jobType,
    client: !!(f.referredBy && f.title && f.firstName && f.surname && f.cellPhone && f.email),
    vehicle: !!(f.make && f.model && f.year && f.color && f.registration && f.warranty),
    accident: !!(f.accidentDate && f.damageDescription && (f.additionalDamage !== 'yes' || f.otherRepairInformation.trim())),
    quote: !!(f.rentalCar && f.quoteType),
    estimator: !!f.estimatorId,
    comms: commChosen,
  }
  const doneCount = Object.values(done).filter(Boolean).length

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)
  const checks: { ok: boolean; label: string; section: string }[] = [
    { ok: !!f.jobType, label: 'Job Type', section: 'job' },
    { ok: !!f.referredBy, label: 'Referred By', section: 'client' },
    { ok: !!f.title, label: 'Title', section: 'client' },
    { ok: !!f.firstName, label: 'First Name', section: 'client' },
    { ok: !!f.surname, label: 'Surname', section: 'client' },
    { ok: !!f.cellPhone, label: 'Cell Phone Number', section: 'client' },
    { ok: !!f.email && validEmail, label: f.email && !validEmail ? 'Email Address (invalid)' : 'Email Address', section: 'client' },
    { ok: !!f.make, label: 'Make', section: 'vehicle' },
    { ok: !!f.model, label: 'Model', section: 'vehicle' },
    { ok: !!f.year, label: 'Year', section: 'vehicle' },
    { ok: !!f.color, label: 'Colour', section: 'vehicle' },
    { ok: !!f.registration, label: 'Registration No.', section: 'vehicle' },
    { ok: !!f.warranty, label: 'Warranty (Yes/No)', section: 'vehicle' },
    { ok: !!f.accidentDate, label: 'Accident Date', section: 'accident' },
    { ok: !!f.damageDescription, label: 'Damage Description', section: 'accident' },
    { ok: f.additionalDamage !== 'yes' || !!f.otherRepairInformation.trim(), label: 'Additional Damage Description', section: 'accident' },
    { ok: !!f.rentalCar, label: 'Client Rental Car', section: 'quote' },
    { ok: !!f.quoteType, label: 'Type of Quote', section: 'quote' },
    { ok: !!f.estimatorId, label: 'Estimator', section: 'estimator' },
    { ok: commChosen, label: 'Contact Method', section: 'comms' },
  ]
  const missing = checks.filter((c) => !c.ok)

  // If the active branch changes (branch switcher), the form context is no longer
  // valid — stop guarding so the switcher's redirect to the dashboard goes through.
  const branchSwitching = initialBranch != null && branchId !== initialBranch

  const dirty = !result && !branchSwitching && JSON.stringify(f) !== INITIAL_JSON

  // Warn on hard navigation (refresh / close / external link)
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // Intercept in-app link clicks (top nav, logo, etc.) while there are unsaved changes
  useEffect(() => {
    if (!dirty) return
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest('a')
      const href = a?.getAttribute('href')
      if (!href || !href.startsWith('/') || href === location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      setPendingNav(href)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [dirty, location.pathname])

  const requestCancel = () => {
    if (dirty) setPendingNav('__back__')
    else navigate(-1)
  }
  const confirmLeave = () => {
    const target = pendingNav
    setPendingNav(null)
    // allow the next navigation through (dirty stays true but listeners are torn down on unmount)
    if (target === '__back__') navigate(-1)
    else if (target) navigate(target)
  }

  const validate = (): boolean => {
    const e: Record<string, boolean> = {}
    const req: (keyof Form)[] = [
      'jobType', 'referredBy', 'title', 'firstName', 'surname', 'cellPhone', 'email',
      'make', 'model', 'year', 'color', 'registration', 'warranty', 'accidentDate',
      'damageDescription', 'rentalCar', 'quoteType', 'estimatorId',
    ]
    for (const k of req) if (!String(f[k]).trim()) e[k] = true
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = true
    if (f.additionalDamage === 'yes' && !f.otherRepairInformation.trim()) e.otherRepairInformation = true
    if (!commChosen) e.comm = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    setServerError(null)
    setAttempted(true)
    if (!validate()) {
      setServerError('Please complete all required fields highlighted below.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!branchId || !profile) return
    setSubmitting(true)
    try {
      const res = await createNewEstimate(branchId, profile.id, {
        jobType: f.jobType as 'drivable' | 'towed',
        referredBy: f.referredBy, title: f.title, firstName: f.firstName, surname: f.surname,
        cellPhone: f.cellPhone, email: f.email, alternativePhone: f.alternativePhone, comments: f.comments,
        make: f.make, model: f.model, year: f.year, color: f.color, registration: f.registration,
        warranty: f.warranty === 'yes',
        accidentDate: f.accidentDate, damageDescription: f.damageDescription,
        additionalDamage: f.additionalDamage === 'yes', otherRepairInformation: f.otherRepairInformation,
        rentalCar: f.rentalCar === 'yes', quoteType: f.quoteType,
        sendAssessmentToBroker: f.sendAssessmentToBroker === 'yes', estimatorId: f.estimatorId,
        allowSms: f.allowSms, allowEmail: f.allowEmail, allowPhone: f.allowPhone, allowWhatsapp: f.allowWhatsapp,
        marketingConsent: f.marketingConsent === 'yes',
      })
      setResult(res)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to create claim')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  const cls = (k: string) => (errors[k] ? ' nc-err' : '')
  const goto = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (result) {
    const drKnown = !!result.drNumber && result.drNumber !== 'N/A'
    return (
      <div className="nc2-success-wrap">
        <div className="nc2-success">
          <div className="nc2-check-wrap">
            <span className="nc2-check-ring" />
            <span className="nc2-check-ring nc2-check-ring2" />
            <svg className="nc2-check" viewBox="0 0 80 80" aria-hidden>
              <circle className="nc2-check-circle" cx="40" cy="40" r="36" />
              <path className="nc2-check-mark" d="M25 41 l10 10 l20 -22" />
            </svg>
          </div>
          <div className="nc2-success-title">Claim created successfully</div>
          <div className="nc2-success-msg">Your new estimate is ready{result.tmsIntegrated ? ' and has been synced to TMS' : ''}.</div>

          <div className="nc2-dr-hero">
            <span className="nc2-dr-label">DR Number</span>
            <span className="nc2-dr-value">{drKnown ? result.drNumber : 'Pending'}</span>
          </div>

          <div className="nc2-success-tags">
            <span className="nc2-stag"><span className="nc2-stag-k">Status</span><span className="nc2-stag-v">{result.status || '—'}</span></span>
            <span className={`nc2-stag ${result.tmsIntegrated ? 'ok' : 'warn'}`}>
              <span className="nc2-stag-dot" />
              <span className="nc2-stag-v">{result.tmsIntegrated ? 'TMS Integrated' : 'TMS Pending'}</span>
            </span>
          </div>

          <div className="nc2-success-actions">
            <button className="btn-ghost" onClick={() => { setResult(null); setF({ ...EMPTY, accidentDate: todayISO() }); setAttempted(false); window.scrollTo({ top: 0 }) }}>Create another</button>
            <button className="new-claim" onClick={() => result.claimId ? navigate(`/claim/${result.claimId}`) : navigate('/claims')}>View claim</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="nc2">
      <aside className="nc2-rail">
        <div className="nc2-rail-head">
          <div className="nc2-rail-title">New Claim</div>
          <div className="nc2-rail-branch">{branchName}</div>
        </div>
        <div className="nc2-progress">
          <div className="nc2-progress-bar"><div className="nc2-progress-fill" style={{ width: `${Math.round((doneCount / STEPS.length) * 100)}%` }} /></div>
          <span>{doneCount}/{STEPS.length} sections</span>
        </div>
        <nav className="nc2-steps">
          {STEPS.map((s, i) => (
            <button key={s.id} className={`nc2-step${active === s.id ? ' active' : ''}${done[s.id] ? ' done' : ''}`} onClick={() => goto(s.id)}>
              <span className="nc2-step-mark">{done[s.id] ? '✓' : i + 1}</span>
              <span className="nc2-step-label">{s.label}</span>
            </button>
          ))}
        </nav>
        {attempted && missing.length > 0 && (
          <div className="nc2-attention">
            <div className="nc2-attention-head"><IconAlert size={14} /> {missing.length} field{missing.length === 1 ? '' : 's'} need attention</div>
            <div className="nc2-attention-list">
              {missing.map((m) => (
                <button key={m.label} className="nc2-attention-item" onClick={() => goto(m.section)}>{m.label}</button>
              ))}
            </div>
          </div>
        )}
        {attempted && missing.length === 0 && (
          <div className="nc2-ready"><span className="nc2-ready-ic">✓</span> All required fields complete</div>
        )}
        <div className="nc2-rail-foot">
          <button className="new-claim" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Claim'}</button>
          <button className="btn-ghost" onClick={requestCancel} disabled={submitting}>Cancel</button>
        </div>
      </aside>

      <div className="nc2-main">
        <div className="nc2-main-head">
          <div>
            <h1>Create a New Claim</h1>
            <p>Capture the client, vehicle and accident details to open a new estimate.</p>
          </div>
          <button type="button" className="nc2-import-btn" onClick={() => setShowImport(true)}>
            <IconUser size={15} /> Import previous client
          </button>
        </div>

        {imported && (
          <div className="nc2-imported">
            <span>✓ Imported details from <b>{imported}</b>. Review and complete the remaining fields.</span>
            <button type="button" onClick={() => setImported(null)} aria-label="Dismiss">✕</button>
          </div>
        )}

        {serverError && <div className="nc-error"><IconShield size={15} /> {serverError}</div>}

        <Card id="job" icon={<IconReports size={16} />} title="Job Type" sub="How is the vehicle arriving?" done={done.job}>
          <div className="nc2-jobtype">
            <button type="button" className={`nc2-job${f.jobType === 'drivable' ? ' on' : ''}${cls('jobType')}`} onClick={() => set('jobType', 'drivable')}>
              <span className="nc2-job-ic"><IconCar size={20} /></span>
              <div><div className="nc2-job-name">Drive-In</div><div className="nc2-job-desc">Client drives vehicle to branch</div></div>
            </button>
            <button type="button" className={`nc2-job${f.jobType === 'towed' ? ' on' : ''}${cls('jobType')}`} onClick={() => set('jobType', 'towed')}>
              <span className="nc2-job-ic"><IconBriefcase size={20} /></span>
              <div><div className="nc2-job-name">Towed</div><div className="nc2-job-desc">Vehicle towed to branch</div></div>
            </button>
          </div>
        </Card>

        <Card id="client" icon={<IconUser size={16} />} title="Client Details" done={done.client}>
          <div className="nc2-grid">
            <Field label="Referred By" required error={errors.referredBy}>
              <select className={`nc-input${cls('referredBy')}`} value={f.referredBy} onChange={(e) => set('referredBy', e.target.value)}>
                <option value="">Please select</option>
                {referrals.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Title" required error={errors.title}>
              <select className={`nc-input${cls('title')}`} value={f.title} onChange={(e) => set('title', e.target.value)}>
                <option value="">Please select</option>
                {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="First Name" required error={errors.firstName}>
              <input className={`nc-input${cls('firstName')}`} value={f.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </Field>
            <Field label="Surname" required error={errors.surname}>
              <input className={`nc-input${cls('surname')}`} value={f.surname} onChange={(e) => set('surname', e.target.value)} />
            </Field>
            <Field label="Cell Phone Number" required error={errors.cellPhone}>
              <input className={`nc-input${cls('cellPhone')}`} value={f.cellPhone} onChange={(e) => set('cellPhone', e.target.value.replace(/[^\d]/g, '').slice(0, 10))} inputMode="numeric" />
            </Field>
            <Field label="Email Address" required error={errors.email}>
              <input className={`nc-input${cls('email')}`} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Alternative Number">
              <input className="nc-input" value={f.alternativePhone} onChange={(e) => set('alternativePhone', e.target.value.replace(/[^\d]/g, '').slice(0, 10))} inputMode="numeric" />
            </Field>
            <Field label="Comments">
              <input className="nc-input" value={f.comments} onChange={(e) => set('comments', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card id="vehicle" icon={<IconCar size={16} />} title="Client Vehicle Details" done={done.vehicle}>
          <div className="nc2-grid nc2-grid-3">
            <Field label="Make" required error={errors.make} asDiv>
              <SearchSelect
                value={f.make}
                onChange={(v) => { set('make', v); set('model', '') }}
                options={makes}
                placeholder="Select Make"
                error={errors.make}
              />
            </Field>
            <Field label="Model" required error={errors.model} asDiv>
              <SearchSelect
                value={f.model}
                onChange={(v) => set('model', v)}
                options={models}
                placeholder={f.make ? 'Select Model' : 'Select make first'}
                disabled={!f.make}
                error={errors.model}
                emptyText={f.make ? 'No models found' : 'Select a make first'}
              />
            </Field>
            <Field label="Year" required error={errors.year}>
              <select className={`nc-input${cls('year')}`} value={f.year} onChange={(e) => set('year', e.target.value)}>
                <option value="">Select Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
          </div>
          <div className="nc2-grid">
            <Field label="Colour" required error={errors.color}>
              <input className={`nc-input${cls('color')}`} value={f.color} onChange={(e) => set('color', e.target.value)} />
            </Field>
            <Field label="Registration No." required error={errors.registration}>
              <input className={`nc-input${cls('registration')}`} value={f.registration} placeholder="e.g. ABC123GP" onChange={(e) => set('registration', e.target.value.toUpperCase())} />
            </Field>
          </div>
          <YesNo label="Is your vehicle still under warranty?" required value={f.warranty} onChange={(v) => set('warranty', v)} error={errors.warranty} />
        </Card>

        <Card id="accident" icon={<IconAlert size={16} />} title="Client Accident Details" done={done.accident}>
          <div className="nc2-grid">
            <Field label="Accident Date" required error={errors.accidentDate}>
              <input className={`nc-input${cls('accidentDate')}`} type="date" max={todayISO()} value={f.accidentDate} onChange={(e) => set('accidentDate', e.target.value)} />
            </Field>
          </div>
          <Field label="Describe briefly how the vehicle was damaged" required error={errors.damageDescription}>
            <textarea className={`nc-input nc-textarea${cls('damageDescription')}`} rows={3} value={f.damageDescription} onChange={(e) => set('damageDescription', e.target.value)} />
          </Field>
          <YesNo label="Whilst your vehicle is with us, is there other damage (unrelated to this claim) you would like us to repair?" value={f.additionalDamage} onChange={(v) => set('additionalDamage', v)} />
          {f.additionalDamage === 'yes' && (
            <Field label="Describe the additional damage" required error={errors.otherRepairInformation}>
              <textarea className={`nc-input nc-textarea${cls('otherRepairInformation')}`} rows={2} value={f.otherRepairInformation} onChange={(e) => set('otherRepairInformation', e.target.value)} />
            </Field>
          )}
        </Card>

        <Card id="quote" icon={<IconReports size={16} />} title="Client Repair Quote Details" done={done.quote}>
          <div className="nc2-grid">
            <Field label="Client Rental Car" required error={errors.rentalCar}>
              <select className={`nc-input${cls('rentalCar')}`} value={f.rentalCar} onChange={(e) => set('rentalCar', e.target.value as YN)}>
                <option value="">Please select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Type of Quote" required error={errors.quoteType}>
              <select className={`nc-input${cls('quoteType')}`} value={f.quoteType} onChange={(e) => set('quoteType', e.target.value)}>
                <option value="">Type of quote</option>
                {QUOTE_TYPES.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
          </div>
          <YesNo label="May we send a copy of the Assessment to your Broker/Insurer?" value={f.sendAssessmentToBroker} onChange={(v) => set('sendAssessmentToBroker', v)} />
        </Card>

        <Card id="estimator" icon={<IconBriefcase size={16} />} title="Estimator" done={done.estimator}>
          <div className="nc2-grid">
            <Field label="Estimator" required error={errors.estimatorId}>
              <select className={`nc-input${cls('estimatorId')}`} value={f.estimatorId} onChange={(e) => set('estimatorId', e.target.value)}>
                <option value="">Please Select</option>
                {estimators.map((es) => <option key={es.id} value={es.id}>{es.name}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        <Card id="comms" icon={<IconDocuments size={16} />} title="Client Communication Details" done={done.comms}>
          <div className={`nc-comm-label${errors.comm ? ' nc-err-text' : ''}`}>How may we contact you? <span className="nc-req">*</span></div>
          <div className="nc-comm-help">Select all methods you are comfortable with. Our CSA will use these channels to keep you updated.</div>
          <div className="nc2-comm">
            <CommCheck label="SMS" desc="Status updates via SMS" checked={f.allowSms} onChange={(v) => set('allowSms', v)} />
            <CommCheck label="Email" desc="Detailed updates & documents" checked={f.allowEmail} onChange={(v) => set('allowEmail', v)} />
            <CommCheck label="Phone Calls" desc="Calls for important updates" checked={f.allowPhone} onChange={(v) => set('allowPhone', v)} />
            <CommCheck label="WhatsApp" desc="Updates & photos via WhatsApp" checked={f.allowWhatsapp} onChange={(v) => set('allowWhatsapp', v)} />
          </div>
          <YesNo label="Once your repair is completed, do you give us permission to send you electronic communication on additional services we offer?" value={f.marketingConsent} onChange={(v) => set('marketingConsent', v)} />
        </Card>

        <div className="nc2-foot">
          <button className="btn-ghost" onClick={requestCancel} disabled={submitting}>Cancel</button>
          <button className="new-claim" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Claim'}</button>
        </div>
      </div>

      {showImport && <ImportClientModal onClose={() => setShowImport(false)} onApply={applyLookup} />}

      {pendingNav && (
        <div className="modal-overlay" onClick={() => setPendingNav(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Leave without saving?</div>
            <div className="modal-body">
              <p>You have unsaved changes on this new claim. If you leave now, the details you’ve entered will be lost.</p>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-right">
                <button className="btn-ghost" onClick={() => setPendingNav(null)}>Stay on page</button>
                <button className="btn-danger" onClick={confirmLeave}>Leave without saving</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ImportClientModal({ onClose, onApply }: { onClose: () => void; onApply: (res: VehicleLookup) => void }) {
  const [reg, setReg] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<VehicleLookup | null>(null)

  const search = async () => {
    const r = reg.trim()
    if (r.length < 2) return
    setSearching(true)
    setResult(null)
    try {
      const res = await lookupVehicleForClaim(r)
      setResult(res)
    } catch {
      setResult({ found: false, message: 'Lookup failed' })
    } finally {
      setSearching(false)
    }
  }

  const v = result?.vehicle
  const c = result?.customer

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal nci-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nci-head">
          <div>
            <div className="nci-title">Import previous client</div>
            <div className="nci-sub">Enter a vehicle registration to pull an existing customer’s details.</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="nci-body">
          <div className="nci-search">
            <input
              autoFocus
              className="nc-input"
              placeholder="Vehicle registration, e.g. ABC123GP"
              value={reg}
              onChange={(e) => { setReg(e.target.value.toUpperCase()); setResult(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }}
            />
            <button type="button" className="new-claim" onClick={() => void search()} disabled={searching || reg.trim().length < 2}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {result && !result.found && (
            <div className="nci-none">No vehicle found for “{reg.trim()}”. You can close this and enter details manually.</div>
          )}

          {result?.found && v && (
            <div className="nci-result">
              <div className="nci-result-row">
                <span className="nci-result-k">Vehicle</span>
                <span className="nci-result-v">{[v.make, v.model].filter(Boolean).join(' ') || '—'}{v.year ? ` · ${v.year}` : ''}{v.color ? ` · ${v.color}` : ''}</span>
              </div>
              <div className="nci-result-row">
                <span className="nci-result-k">Registration</span>
                <span className="nci-result-v">{v.registration || '—'}</span>
              </div>
              <div className="nci-result-row">
                <span className="nci-result-k">Customer</span>
                <span className="nci-result-v">
                  {c ? `${c.title ? c.title + ' ' : ''}${c.firstName} ${c.surname}`.trim() : 'No linked customer'}
                  {c?.cellPhone ? ` · ${c.cellPhone}` : ''}
                </span>
              </div>
              {!c && <div className="nci-note">This vehicle has no linked customer — only vehicle details will be imported.</div>}
            </div>
          )}
        </div>

        <div className="nci-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="new-claim" onClick={() => result && onApply(result)} disabled={!result?.found}>Import details</button>
        </div>
      </div>
    </div>
  )
}

function Card({ id, icon, title, sub, done, children }: { id: string; icon: React.ReactNode; title: string; sub?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className="nc2-card">
      <div className="nc2-card-head">
        <span className="nc2-card-ic">{icon}</span>
        <div className="nc2-card-titles">
          <div className="nc2-card-title">{title}</div>
          {sub && <div className="nc2-card-sub">{sub}</div>}
        </div>
        {done && <span className="nc2-card-check">✓</span>}
      </div>
      <div className="nc2-card-body">{children}</div>
    </section>
  )
}

function Field({ label, required, error, asDiv, children }: { label: string; required?: boolean; error?: boolean; asDiv?: boolean; children: React.ReactNode }) {
  const inner = (
    <>
      <span className="nc-label">{label}{required && <span className="nc-req"> *</span>}</span>
      {children}
      {error && <span className="nc-field-err">Required</span>}
    </>
  )
  // SearchSelect renders an interactive popover; wrapping it in a <label> makes
  // backdrop clicks get forwarded to the trigger, so those fields use a <div>.
  return asDiv
    ? <div className="nc2-field">{inner}</div>
    : <label className="nc2-field">{inner}</label>
}

function YesNo({ label, value, onChange, required, error }: { label: string; value: YN; onChange: (v: YN) => void; required?: boolean; error?: boolean }) {
  return (
    <div className={`nc-yesno${error ? ' nc-err-text' : ''}`}>
      <span className="nc-yesno-label">{label}{required && <span className="nc-req"> *</span>}</span>
      <div className="nc-yesno-opts">
        <label className={`nc-radio${value === 'yes' ? ' on' : ''}`}><input type="radio" checked={value === 'yes'} onChange={() => onChange('yes')} />Yes</label>
        <label className={`nc-radio${value === 'no' ? ' on' : ''}`}><input type="radio" checked={value === 'no'} onChange={() => onChange('no')} />No</label>
      </div>
    </div>
  )
}

function CommCheck({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`nc2-comm-card${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div><div className="nc-comm-name">{label}</div><div className="nc-comm-desc">{desc}</div></div>
    </label>
  )
}