import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import {
  loadDisclaimer, signDisclaimer,
  type DisclaimerLoad,
} from '../lib/api'
import {
  IconBox, IconWindscreen, IconBattery, IconNut, IconShield, IconCheck, IconLock,
} from '../components/icons'
import { Logo } from '../components/Logo'

// Public, no-auth page at /disclaimer/:token where a customer reviews each
// disclaimer section step-by-step and signs. The link is generated from the
// claim detail Overview tab. Persists via the `disclaimer` edge function.

const TOTAL_STEPS = 5

type SectionMeta = {
  icon: ComponentType<{ size?: number }>
  tint: string
  title: string
  subtitle: string
}

const META: (SectionMeta & { short: string })[] = [
  { icon: IconBox, tint: 'blue', title: 'Personal Items', subtitle: 'Personal belongings in the vehicle', short: 'Personal' },
  { icon: IconWindscreen, tint: 'amber', title: 'Windscreen', subtitle: 'Pre-existing windscreen defects disclaimer', short: 'Windscreen' },
  { icon: IconBattery, tint: 'red', title: 'Fuel & Battery', subtitle: 'Fuel content policy and battery failure disclaimer', short: 'Fuel' },
  { icon: IconNut, tint: 'teal', title: 'Lock Nut', subtitle: 'Lock nut key availability in vehicle', short: 'Lock Nut' },
  { icon: IconShield, tint: 'navy', title: 'Review & Sign', subtitle: 'Review your acknowledgments and sign below', short: 'Sign' },
]

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1f2733'
    }
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !last.current) return
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!hasInk) setHasInk(true)
  }
  const endDraw = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    const canvas = canvasRef.current
    if (canvas && hasInk) onChange(canvas.toDataURL('image/png'))
  }
  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="dsf-sig">
      <div className="dsf-sig-panel">
        {!hasInk && <span className="dsf-sig-watermark">Sign here</span>}
        <span className="dsf-sig-baseline" />
        <span className="dsf-sig-x">✕</span>
        <canvas
          ref={canvasRef}
          className="dsf-sig-canvas"
          onPointerDown={startDraw}
          onPointerMove={move}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
      </div>
      <div className="dsf-sig-foot">
        <span className="dsf-sig-hint">
          {hasInk ? <><IconCheck size={14} /> Signature captured — draw again to redo</> : 'Use your finger or mouse to sign'}
        </span>
        <button type="button" className="dsf-sig-clear" onClick={clear} disabled={!hasInk}>Clear</button>
      </div>
    </div>
  )
}

function DsfFrame({ children, branch }: { children: React.ReactNode; branch?: string | null }) {
  return (
    <div className="dsf-page">
      <div className="dsf-card">
        <div className="dsf-brand">
          <Logo branch={branch || 'Group'} height={40} />
        </div>
        {children}
      </div>
    </div>
  )
}

function SectionHeader({ step }: { step: number }) {
  const m = META[step]
  const Icon = m.icon
  return (
    <div className="dsf-section-card">
      <span className={`dsf-section-ic ${m.tint}`}><Icon size={20} /></span>
      <div>
        <div className="dsf-section-name">{m.title}</div>
        <div className="dsf-section-sub">{m.subtitle}</div>
      </div>
    </div>
  )
}

function Check({
  checked, onChange, children,
}: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={`dsf-check${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="dsf-check-box" />
      <span className="dsf-check-label">{children}</span>
    </label>
  )
}

const FUEL_LEVELS = ['Empty', '¼ tank', '½ tank', '¾ tank', 'Full']
const FUEL_SHORT = ['E', '¼', '½', '¾', 'F']

// Sample an arc (upper semicircle) from angle a0 to a1 as an SVG path so we avoid
// arc-flag ambiguity. Angles in radians; screen y is flipped (cy - r·sin).
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number, steps = 48): string {
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps)
    const x = cx + r * Math.cos(a)
    const y = cy - r * Math.sin(a)
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1)
  }
  return d
}

function FuelGauge({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const cx = 140, cy = 130, r = 98
  const angleFor = (v: number) => Math.PI * (1 - v / 4) // 0→π (left/E), 4→0 (right/F)
  const na = angleFor(value ?? 0)
  const nx = cx + (r - 24) * Math.cos(na)
  const ny = cy - (r - 24) * Math.sin(na)
  return (
    <div className="dsf-gauge">
      <svg viewBox="0 0 280 168" className="dsf-gauge-svg" role="img" aria-label={`Fuel level: ${value != null ? FUEL_LEVELS[value] : 'not set'}`}>
        <defs>
          <linearGradient id="dsf-fuelgrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e24b4a" />
            <stop offset="0.5" stopColor="#efb53b" />
            <stop offset="1" stopColor="#1aa179" />
          </linearGradient>
        </defs>
        <path d={arcPath(cx, cy, r, Math.PI, 0)} fill="none" stroke="#e7ebf2" strokeWidth="16" strokeLinecap="round" />
        {value != null && (
          <path d={arcPath(cx, cy, r, Math.PI, angleFor(value))} fill="none" stroke="url(#dsf-fuelgrad)" strokeWidth="16" strokeLinecap="round" />
        )}
        {[0, 1, 2, 3, 4].map((v) => {
          const a = angleFor(v)
          return (
            <line
              key={v}
              x1={cx + (r - 11) * Math.cos(a)} y1={cy - (r - 11) * Math.sin(a)}
              x2={cx + (r + 11) * Math.cos(a)} y2={cy - (r + 11) * Math.sin(a)}
              stroke="#aeb8c7" strokeWidth="2"
            />
          )
        })}
        {value != null && (
          <>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1b3a6b" strokeWidth="4" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="9" fill="#1b3a6b" />
            <circle cx={cx} cy={cy} r="3.5" fill="#fff" />
          </>
        )}
        <text x={cx - r} y={cy + 22} fill="#d0342c" fontSize="15" fontWeight="800" textAnchor="middle">E</text>
        <text x={cx + r} y={cy + 22} fill="#15803d" fontSize="15" fontWeight="800" textAnchor="middle">F</text>
      </svg>
      <div className={`dsf-gauge-readout${value != null ? ' set' : ''}`}>
        {value != null ? FUEL_LEVELS[value] : 'Tap a level below'}
      </div>
      <div className="dsf-gauge-btns">
        {FUEL_SHORT.map((s, i) => (
          <button key={s} type="button" className={`dsf-gauge-btn${value === i ? ' on' : ''}`} onClick={() => onChange(i)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DisclaimerForm() {
  const { token } = useParams()
  const [data, setData] = useState<DisclaimerLoad | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [step, setStep] = useState(0)
  // Section state
  const [personal, setPersonal] = useState(false)
  const [windA, setWindA] = useState(false)
  const [windB, setWindB] = useState(false)
  const [fuelAck, setFuelAck] = useState(false)
  const [batteryAck, setBatteryAck] = useState(false)
  const [fuelLevel, setFuelLevel] = useState<number | null>(null)
  const [lockNut, setLockNut] = useState<'yes' | 'no' | ''>('')
  const [lockNotes, setLockNotes] = useState('')
  const [finalConfirm, setFinalConfirm] = useState(false)
  const [legalName, setLegalName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    let on = true
    if (!token) { setError('Missing signing token.'); setLoading(false); return }
    loadDisclaimer(token)
      .then((d) => {
        if (!on) return
        setData(d)
        if (d.customerName) setLegalName(d.customerName)
      })
      .catch((e: unknown) => { if (on) setError(e instanceof Error ? e.message : 'Could not load this disclaimer.') })
      .finally(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [token])

  const canAdvance =
    step === 0 ? personal
      : step === 1 ? windA && windB
        : step === 2 ? fuelAck && batteryAck && fuelLevel != null
          : step === 3 ? lockNut !== ''
            : finalConfirm && legalName.trim().length > 0 && !!signature

  const submit = async () => {
    if (!token || !canAdvance) return
    setSubmitting(true)
    try {
      const lockProvided = lockNut === 'yes'
      const acknowledgements = [
        { section_key: 'personal_items', acknowledged: personal },
        { section_key: 'windscreen', acknowledged: windA && windB },
        {
          section_key: 'fuel_battery',
          acknowledged: fuelAck && batteryAck,
          notes: fuelLevel != null ? `Fuel on book-in: ${FUEL_LEVELS[fuelLevel]}` : undefined,
        },
        {
          section_key: 'lock_nut',
          acknowledged: lockProvided,
          notes: `${lockProvided ? 'Lock nut key provided' : 'Lock nut key NOT provided'}${lockNotes.trim() ? ` — ${lockNotes.trim()}` : ''}`,
        },
      ]
      const { signedAt } = await signDisclaimer(token, acknowledgements, signature!, legalName.trim())
      setDone(signedAt)
    } catch (e: unknown) {
      const err = e as Error & { alreadySigned?: boolean }
      if (err.alreadySigned) {
        setData((d) => (d ? { ...d, isSigned: true } : d))
      } else {
        setError(err.message || 'Could not submit. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <DsfFrame><div className="dsf-state">Loading your disclaimer…</div></DsfFrame>
  }

  if (error && !data) {
    return (
      <DsfFrame>
        <div className="dsf-state">
          <div className="dsf-state-icon err">!</div>
          <h2>Link unavailable</h2>
          <p>{error}</p>
        </div>
      </DsfFrame>
    )
  }

  if (done || data?.isSigned) {
    const when = done || data?.signedAt
    return (
      <DsfFrame branch={data?.branchName}>
        <div className="dsf-state">
          <div className="dsf-state-icon ok">✓</div>
          <h2>{done ? 'Thank you!' : 'Already signed'}</h2>
          <p>
            {done
              ? 'Your disclaimer has been submitted successfully. A signed copy has been saved to your job file.'
              : 'This disclaimer has already been signed.'}
          </p>
          {when && <div className="dsf-signed-at">Signed on {new Date(when).toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' })}</div>}
        </div>
      </DsfFrame>
    )
  }

  const next = () => { setError(null); setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)) }
  const back = () => {
    setError(null)
    // The signature pad remounts per step; drop any captured signature when
    // leaving the sign step so a blank pad can't submit a stale signature.
    if (step === TOTAL_STEPS - 1) setSignature(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <DsfFrame branch={data?.branchName}>
      <div className="dsf-titleblock">
        <h1 className="dsf-title">BOOKING DISCLAIMER</h1>
        <p className="dsf-title-sub">Please review and acknowledge each section</p>
      </div>

      <div className="dsf-stepper">
        <span className="dsf-stepper-fill" style={{ width: `calc(${(step / (TOTAL_STEPS - 1)) * 100}% - ${(step / (TOTAL_STEPS - 1)) * 34}px)` }} />
        {META.map((m, i) => (
          <div key={m.short} className={`dsf-node${i === step ? ' current' : i < step ? ' done' : ''}`}>
            <span className="dsf-node-dot">{i < step ? <IconCheck size={15} /> : i + 1}</span>
            <span className="dsf-node-label">{m.short}</span>
          </div>
        ))}
      </div>

      {error && <div className="dsf-inline-err">{error}</div>}

      <div className="dsf-step-wrap" key={step}>
      <SectionHeader step={step} />

      {step === 0 && (
        <div className="dsf-body">
          <div className="dsf-info">
            Please ensure you have removed all personal belongings from the vehicle before handing it over.
            Renew-It Group will not be held responsible for any personal items left in the vehicle during the repair process.
          </div>
          <Check checked={personal} onChange={setPersonal}>
            I acknowledge that I have removed all personal belongings from the vehicle.
          </Check>
        </div>
      )}

      {step === 1 && (
        <div className="dsf-body">
          <div className="dsf-info">
            The branch cannot be held responsible for any damage to the windscreen during the repair process, as any
            pre-existing windscreen defects may be affected during the repair process. Should you have further questions
            please feel free to ask one of our staff members to explain.
          </div>
          <Check checked={windA} onChange={setWindA}>
            I acknowledge that Renew-It is not responsible for windscreen damage during repairs.
          </Check>
          <Check checked={windB} onChange={setWindB}>
            I acknowledge it was explained that Renew-It cannot be held responsible for any cracks or damage to the windscreen.
          </Check>
        </div>
      )}

      {step === 2 && (
        <div className="dsf-body">
          <div className="dsf-info">
            <strong>Fuel Content.</strong>
            <p>
              Please note that if your vehicle is delivered to us for repair work with little or no fuel in the tank, we
              will require a minimum of 10 litres to be added. If this is not convenient for you, Renew-It will add 10
              litres of fuel on your behalf. The cost will be added to your account and will need to be settled upon
              collection of the vehicle.
            </p>
          </div>
          <Check checked={fuelAck} onChange={setFuelAck}>
            I understand that a minimum of 10 litres of fuel is required and costs may be added if necessary.
          </Check>
          <div className="dsf-input-wrap">
            <span className="dsf-input-label">Fuel level on book-in</span>
            <FuelGauge value={fuelLevel} onChange={setFuelLevel} />
          </div>
          <div className="dsf-info">
            <strong>Battery Failures.</strong>
            <p>
              Please note that Renew-It will not be liable for the failure of a vehicle's battery whilst undergoing
              repairs. In the event of the battery failing, it will be for the owner's account. It is the owner's
              responsibility to supply Renew-It with a replacement battery.
            </p>
          </div>
          <Check checked={batteryAck} onChange={setBatteryAck}>
            I acknowledge that battery failures during repair are not Renew-It's responsibility.
          </Check>
        </div>
      )}

      {step === 3 && (
        <div className="dsf-body">
          <div className="dsf-info">
            Please ensure the locknut keys are provided if rim repairs are required. Failure to provide the keys may
            result in delays or an inability to complete the necessary repairs.
          </div>
          <button type="button" className={`dsf-radio${lockNut === 'yes' ? ' on' : ''}`} onClick={() => setLockNut('yes')}>
            <span className="dsf-radio-dot" />
            Yes — Lock nut key is in the vehicle
          </button>
          <button type="button" className={`dsf-radio${lockNut === 'no' ? ' on' : ''}`} onClick={() => setLockNut('no')}>
            <span className="dsf-radio-dot" />
            No — Lock nut key is not provided
          </button>
          <label className="dsf-input-wrap">
            <span className="dsf-input-label">Lock nut key notes</span>
            <input
              className="dsf-input"
              value={lockNotes}
              onChange={(e) => setLockNotes(e.target.value)}
              placeholder="e.g. Key provided to reception"
            />
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="dsf-body">
          <div className="dsf-summary">
            <div className="dsf-summary-title">Your acknowledgments</div>
            {[
              'Personal items removed',
              'Windscreen disclaimer accepted',
              'Fuel policy acknowledged',
              'Battery disclaimer accepted',
              lockNut === 'yes' ? 'Lock nut: Provided' : 'Lock nut: Not provided',
            ].map((label) => (
              <div key={label} className="dsf-summary-row">
                <span className="dsf-summary-tick"><IconCheck size={13} /></span>
                {label}
              </div>
            ))}
          </div>

          <Check checked={finalConfirm} onChange={setFinalConfirm}>
            I have read all sections above and acknowledge that I understand the contents.
          </Check>

          <label className="dsf-input-wrap">
            <span className="dsf-input-label">Full legal name</span>
            <input
              className="dsf-input"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Your full name"
            />
          </label>

          <div className="dsf-input-label" style={{ marginBottom: 8 }}>Draw your signature below</div>
          <SignaturePad onChange={setSignature} />
        </div>
      )}
      </div>

      <div className="dsf-nav">
        {step > 0 && (
          <button className="dsf-btn ghost" onClick={back} disabled={submitting}>Back</button>
        )}
        <div className="dsf-nav-spacer" />
        {step < TOTAL_STEPS - 1 ? (
          <button className="dsf-btn primary" onClick={next} disabled={!canAdvance}>
            Continue <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>→</span>
          </button>
        ) : (
          <button className="dsf-btn primary" onClick={submit} disabled={!canAdvance || submitting}>
            {submitting ? 'Submitting…' : 'Submit & Sign'}
          </button>
        )}
      </div>

      <div className="dsf-trust">
        <IconLock size={13} /> Secure signing · Your details are encrypted · Renew-It Group
      </div>
    </DsfFrame>
  )
}
