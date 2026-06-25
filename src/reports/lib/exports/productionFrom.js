// FROM-based production aggregators for the SSRS export ONLY.
//
// The SSRS Production sheets (Sheet3 Pre Production, Sheet4 Main Production,
// Sheet5 Front Office) show work COMPLETED = a car LEAVING a department = the
// claim's FROM status. The on-screen app keeps using the TO-based sections
// (mainProduction/preProduction/frontOffice); these mirror those exactly in
// shape but bucket every row by r.from_status instead of r.new_status.
//
// Derived FROM-status mappings (verified against the real SSRS export
// 15-19 Jun 2026 snapshot):
//   Pre Production Ordered   = FROM 01-Converted
//   Pre Production Received  = FROM 02-Awaiting Parts (both spelling variants)
//   Front Office Delivered   = FROM 08-Ready - Docs Recvd CSI
//   Front Office Invoiced    = FROM 09-Preliminary Invoicing
//   Main Production rows     = FROM the same status name (1:1)

import { weekDays, workingDays, dateUse } from './salesPerformance.js'

function isoDay(d) {
  return new Date(d).toISOString().slice(0, 10)
}

// Generic per-FROM-status bucketer producing the exact same row shape as the
// TO-based aggregators (perDay/week/month/targets/variances).
function aggregate(rows, reportDate, keyOf) {
  const days = weekDays(reportDate)
  const dayIndex = new Map(days.map((d, i) => [d, i]))
  const acc = {}
  const ensure = (k) => (acc[k] ||= { perDay: [0, 0, 0, 0, 0], week: 0, month: 0 })
  for (const r of rows) {
    const key = keyOf(r.from_status)
    if (!key) continue
    const k = (Number(r.invoiced) || 0) / 1000
    const a = ensure(key)
    a.month += k
    const di = dayIndex.get(dateUse(isoDay(r.d)))
    if (di != null) {
      a.perDay[di] += k
      a.week += k
    }
  }
  return { days, acc }
}

function periodInfo(targets, reportDate) {
  const totalWeeks = targets?.period?.totalWeeks || 4
  const totalDays = targets?.period?.totalDays || 20
  const prodDays = targets?.period?.dateStart
    ? workingDays(targets.period.dateStart, reportDate)
    : Math.round(totalDays / 2)
  return { totalWeeks, totalDays, prodDays }
}

function makeLine(acc, totalWeeks, totalDays, prodDays, isTotal) {
  return (label, key, monthlyTarget) => {
    const a = acc[key] || { perDay: [0, 0, 0, 0, 0], week: 0, month: 0 }
    const wt = monthlyTarget != null ? monthlyTarget / totalWeeks : null
    const mt = monthlyTarget != null ? (monthlyTarget / totalDays) * prodDays : null
    return {
      label,
      perDay: a.perDay.map((v) => Math.round(v)),
      week: Math.round(a.week),
      weeklyTarget: wt == null ? null : Math.round(wt),
      weeklyVariance: wt == null ? null : Math.round(a.week - wt),
      month: Math.round(a.month),
      monthlyTargetToDate: mt == null ? null : Math.round(mt),
      monthlyTarget: monthlyTarget == null ? null : Math.round(monthlyTarget),
      monthlyVariance: mt == null ? null : Math.round(a.month - mt),
      isTotal: !!isTotal,
    }
  }
}

/* ── Sheet4: Main Production ── (1:1, FROM the same status name) */
const DEPTS = [
  ['03-Panelbeating', '03-Panelbeating'],
  ['04-Paint Prep', '04-Paint Prep'],
  ['04-Paintshop', '04-Paintshop'],
  ['05-Assembly', '05-Assembly'],
  ['06-Polishing', '06-Polishing'],
  ['06-QC', '06-QC'],
  ['07-Finishing', '07-Finishing'],
  ['08-Ready', '08-Ready'],
]

function mainDeptKey(fromStatus) {
  const s = String(fromStatus || '').trim().toLowerCase()
  for (const [label, prefix] of DEPTS) {
    if (s.startsWith(prefix.toLowerCase())) return label
  }
  return null
}

export function buildMainProductionFrom(rows, targets, reportDate) {
  const { days, acc } = aggregate(rows, reportDate, mainDeptKey)
  const { totalWeeks, totalDays, prodDays } = periodInfo(targets, reportDate)
  const prod = Number(targets?.monthlyProductivity) || 0
  const line = makeLine(acc, totalWeeks, totalDays, prodDays, false)
  const sections = [
    {
      title: 'Production - Main Shop',
      rows: DEPTS.map(([label]) => line(label, label, prod)),
    },
  ]
  return { weekDays: days, productionDays: prodDays, totalDays, totalWeeks, sections }
}

/* ── Sheet3: Pre Production ── (Ordered = FROM 01-Converted, Received = FROM 02-Awaiting Parts) */
function preFromKey(fromStatus) {
  const s = fromStatus || ''
  if (/^01-Converted/i.test(s)) return 'ordered'
  if (/^02-Awaiting Parts/i.test(s)) return 'received'
  return null
}

export function buildPreProductionFrom(rows, targets, reportDate) {
  const { days, acc } = aggregate(rows, reportDate, preFromKey)
  const { totalWeeks, totalDays, prodDays } = periodInfo(targets, reportDate)
  const prod = Number(targets?.monthlyProductivity) || 0
  const line = makeLine(acc, totalWeeks, totalDays, prodDays, true)
  const sections = [
    { title: 'Ordered', rows: [line('Parts Ordered Main', 'ordered', prod)] },
    { title: 'Received', rows: [line('Parts Received Main', 'received', prod)] },
  ]
  return { weekDays: days, productionDays: prodDays, totalDays, totalWeeks, sections }
}

/* ── Sheet5: Front Office ── (Delivered = FROM 08-Ready - Docs Recvd CSI, Invoiced = FROM 09-Preliminary Invoicing) */
function foFromKey(fromStatus) {
  const s = fromStatus || ''
  if (/^08-Ready/i.test(s)) return 'delivered'
  if (/^09-Preliminary Invoicing/i.test(s)) return 'invoiced'
  return null
}

export function buildFrontOfficeFrom(rows, targets, reportDate) {
  const { days, acc } = aggregate(rows, reportDate, foFromKey)
  const { totalWeeks, totalDays, prodDays } = periodInfo(targets, reportDate)
  const prod = Number(targets?.monthlyProductivity) || 0
  const inv = Number(targets?.monthlyInvoicing) || 0
  const line = makeLine(acc, totalWeeks, totalDays, prodDays, true)
  const sections = [
    { title: 'Delivered', rows: [line('Delivered - Main', 'delivered', prod)] },
    { title: 'Invoiced', rows: [line('Invoiced', 'invoiced', inv)] },
  ]
  return { weekDays: days, productionDays: prodDays, totalDays, totalWeeks, sections }
}
