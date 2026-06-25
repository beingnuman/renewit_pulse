import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChDashboard, KpiNode, KpiLeg } from '../lib/api'
import { num } from '../lib/format'

// Ordered card keys per section, matching the Bubble dashboard layout.
const SECTIONS: { key: keyof ChDashboard; label: string; cards: string[] }[] = [
  {
    key: 'sales',
    label: 'Sales',
    cards: ['quotes_not_sent', 'quotes_sent', 'authorised', 'appointments'],
  },
  {
    key: 'moderation',
    label: 'Moderation',
    cards: [
      'estimator_in_premlim',
      'moderation_with_moderation',
      'estimator_converted',
      'estimator_converted_tow',
      'estimator_converted_drive',
    ],
  },
  {
    key: 'speedbump',
    label: 'Speedbump',
    cards: ['speedbump_repairer_await_auth', 'speedbump_insurer_query', 'speedbump_repairer_query'],
  },
  {
    key: 'production',
    label: 'Production',
    cards: ['no_photos', 'updates_due', 'open_tickets', 'warranty'],
  },
]

// Maps a card key (+ which leg) to the get_ch_dashboard_claims p_filter_type.
const FILTER_MAP: Record<string, { tow?: string; drive?: string; single?: string }> = {
  quotes_not_sent: { tow: 'quotes_not_sent_tow', drive: 'quotes_not_sent_drive' },
  quotes_sent: { tow: 'quotes_sent_tow', drive: 'quotes_sent_drive' },
  authorised: { single: 'authorised_not_booked' },
  appointments: { single: 'appointments_missed' },
  estimator_in_premlim: { single: 'estimator_in_prelim' },
  moderation_with_moderation: { single: 'moderation_with_moderation' },
  estimator_converted: { single: 'estimator_converted' },
  estimator_converted_tow: { single: 'estimator_converted_tow_48h' },
  estimator_converted_drive: { single: 'estimator_converted_drive_24h' },
  speedbump_repairer_await_auth: { single: 'speedbump_await_auth' },
  speedbump_insurer_query: { single: 'speedbump_insurer_query' },
  speedbump_repairer_query: { single: 'speedbump_repairer_query' },
  no_photos: { single: 'no_photos' },
  updates_due: { single: 'updates_due' },
  open_tickets: { single: 'open_tickets' },
  warranty: { single: 'warranty' },
}

function filterFor(cardKey: string, legLabel: string): string | null {
  const m = FILTER_MAP[cardKey]
  if (!m) return null
  if (legLabel === 'TOW') return m.tow ?? m.single ?? null
  if (legLabel === 'DRIVE') return m.drive ?? m.single ?? null
  return m.single ?? null
}

interface Leg extends KpiLeg {
  label: string
}

function legsOf(node: KpiNode): Leg[] {
  const legs: Leg[] = []
  if (node.tow) legs.push({ label: 'TOW', ...node.tow })
  if (node.drive) legs.push({ label: 'DRIVE', ...node.drive })
  if (node.tow_drive) legs.push({ label: 'TOW/DRIVE', ...node.tow_drive })
  return legs
}

function Tick({ tick }: { tick?: 'red' | 'green' }) {
  const ok = tick !== 'red'
  return (
    <span className={`tick ${ok ? 'green' : 'red'}`} aria-hidden>
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        {ok ? <path d="M5 13l4 4L19 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
      </svg>
    </span>
  )
}

function rkLabel(rk?: number): string | null {
  if (rk == null) return null
  if (rk === 0) return 'R0'
  return `R${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(rk)}K`
}

function Leg({ leg, split, onOpen }: { leg: Leg; split: boolean; onOpen?: () => void }) {
  const secondary =
    leg.breached !== undefined ? leg.breached : leg.over_10_days !== undefined ? leg.over_10_days : undefined
  const rk = rkLabel(leg.rk)
  const clickable = !!onOpen
  return (
    <div
      className={`leg${split ? ' split' : ''}${clickable ? ' clickable' : ''}`}
      onClick={onOpen}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onOpen?.() : undefined}
    >
      <div className="leg-top">
        <span className="leg-label">{leg.label}</span>
        <Tick tick={leg.tick} />
      </div>
      <div className="leg-bottom">
        <span className={`leg-count ${leg.tick === 'red' ? 'red' : 'green'}`}>{num(leg.count ?? 0)}</span>
        {(leg.threshold || secondary !== undefined || rk) && (
          <span className="leg-meta">
            {rk && <span className="leg-rk">{rk}</span>}
            {leg.threshold && <span className="leg-thresh">{leg.threshold}</span>}
            {secondary !== undefined && <span className="leg-secondary">{num(secondary)} over</span>}
          </span>
        )}
      </div>
    </div>
  )
}

// Thresholds shown on cards where the backend doesn't supply one (matches breach rules).
const UI_THRESHOLD: Record<string, string> = {
  estimator_converted_tow: '48 Hours',
  estimator_converted_drive: '24 Hours',
}

function KpiCard({ cardKey, node, delay }: { cardKey: string; node: KpiNode; delay: number }) {
  const navigate = useNavigate()
  const legs = legsOf(node).map((l) => ({ ...l, threshold: l.threshold ?? UI_THRESHOLD[cardKey] }))
  const split = legs.length > 1
  const hasRed = legs.some((l) => l.tick === 'red')

  const open = (legLabel: string) => {
    const ft = filterFor(cardKey, legLabel)
    if (!ft) return
    const legPart = legLabel === 'TOW/DRIVE' ? '' : ` (${legLabel})`
    const label = `${node.title ?? ''} · ${node.subtitle ?? ''}${legPart}`.trim()
    navigate(`/kpi/${ft}?label=${encodeURIComponent(label)}`)
  }

  return (
    <div
      className={`kpi-card${split ? ' wide' : ''} ${hasRed ? 'is-red' : 'is-green'}`}
      style={{ ['--d']: `${delay * 0.06}s` } as CSSProperties}
    >
      <div className="kpi-card-head">
        <div className="kpi-card-title">{node.title}</div>
        <div className="kpi-card-sub">{node.subtitle}</div>
      </div>
      <div className={`legs${split ? ' two' : ''}`}>
        {legs.map((l, i) => (
          <Leg key={i} leg={l} split={split} onOpen={filterFor(cardKey, l.label) ? () => open(l.label) : undefined} />
        ))}
      </div>
    </div>
  )
}

export function KpiPanel({ data }: { data: ChDashboard }) {
  return (
    <div className="kpi-sections">
      {SECTIONS.map((sec) => {
        const group = (data[sec.key] as Record<string, KpiNode> | undefined) ?? {}
        const cards = sec.cards
          .map((k) => ({ k, node: group[k] }))
          .filter((c) => c.node) as { k: string; node: KpiNode }[]
        if (cards.length === 0) return null
        return (
          <div key={sec.key} className="kpi-section">
            <div className="kpi-section-label">{sec.label}</div>
            <div className="kpi-grid">
              {cards.map((c, i) => (
                <KpiCard key={c.k} cardKey={c.k} node={c.node} delay={i} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
