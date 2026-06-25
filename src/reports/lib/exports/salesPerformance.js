// Sales Team Performance aggregation.
// Categorises status movements (by TO status + tow/drive) into the report's
// sales lines and rolls them up per weekday, weekly, and month-to-date,
// comparing against the (currently static) branch targets.

function lineKey(newStatus, td) {
  const s = newStatus || ''
  if (/^70-Tow-Authorization Received/i.test(s)) return /pre auth/i.test(s) ? 'towAuthPre' : 'towAuthQuoted'
  if (/^71-Tow-Authorization Received/i.test(s)) return 'towAuthPre'
  if (/^71-Drive-Authorization Received/i.test(s)) return /pre auth/i.test(s) ? 'driveAuthPre' : 'driveAuthQuoted'
  if (/^100-Booked/i.test(s)) return 'booked'
  if (/^01-Preliminary Conversion/i.test(s)) return td === 'T' ? 'prelimTow' : 'prelimDrive'
  if (/^01-Converted/i.test(s)) return td === 'T' ? 'towConverted' : 'driveConverted'
  return null
}

function isoDay(d) {
  return new Date(d).toISOString().slice(0, 10)
}

// Monday..Friday dates for the week containing `dateStr`
export function weekDays(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // 0 = Monday
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - dow)
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(monday)
    x.setUTCDate(monday.getUTCDate() + i)
    return isoDay(x)
  })
}

// Weekend roll: Saturday and Sunday movements are attributed to the
// preceding Friday (matches the RDL's DateUse field).
export function dateUse(dateStr) {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z')
  const dow = d.getUTCDay() // 0 = Sunday, 6 = Saturday
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1)
  else if (dow === 0) d.setUTCDate(d.getUTCDate() - 2)
  return d.toISOString().slice(0, 10)
}

export function workingDays(startStr, endStr) {
  let count = 0
  const cur = new Date(startStr + 'T00:00:00Z')
  const end = new Date(endStr + 'T00:00:00Z')
  while (cur <= end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

function parseRatio(tdRatio) {
  const m = String(tdRatio || '').match(/(\d+)\D+(\d+)/)
  if (!m) return [0.2, 0.8]
  return [Number(m[1]) / 100, Number(m[2]) / 100]
}

// rows: { d (date), new_status, tow_drive_in, invoiced }
export function buildSalesPerformance(rows, targets, reportDate) {
  const days = weekDays(reportDate)
  const dayIndex = new Map(days.map((d, i) => [d, i]))

  const acc = {}
  const ensure = (k) => (acc[k] ||= { perDay: [0, 0, 0, 0, 0], week: 0, month: 0 })

  for (const r of rows) {
    const td = String(r.tow_drive_in || '').toUpperCase().startsWith('T') ? 'T' : 'D'
    const key = lineKey(r.new_status, td)
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

  const conv = Number(targets?.monthlyConversions) || 0
  const [tP, dP] = parseRatio(targets?.tdRatio)
  const totalWeeks = targets?.period?.totalWeeks || 4
  const totalDays = targets?.period?.totalDays || 20
  const prodDays = targets?.period?.dateStart
    ? workingDays(targets.period.dateStart, reportDate)
    : Math.round(totalDays / 2)

  const weeklyTarget = (m) => m / totalWeeks
  const mtdTarget = (m) => (m / totalDays) * prodDays

  const line = (label, key, monthlyTarget) => {
    const a = acc[key] || { perDay: [0, 0, 0, 0, 0], week: 0, month: 0 }
    const wt = monthlyTarget != null ? weeklyTarget(monthlyTarget) : null
    const mt = monthlyTarget != null ? mtdTarget(monthlyTarget) : null
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
    }
  }

  const total = (label, keys, monthlyTarget) => {
    const merged = { perDay: [0, 0, 0, 0, 0], week: 0, month: 0 }
    for (const key of keys) {
      const a = acc[key]
      if (!a) continue
      a.perDay.forEach((v, i) => (merged.perDay[i] += v))
      merged.week += a.week
      merged.month += a.month
    }
    acc.__tmp = merged
    const out = line(label, '__tmp', monthlyTarget)
    out.isTotal = true
    delete acc.__tmp
    return out
  }

  const sections = [
    {
      title: 'Tow Authorisations Received',
      rows: [
        line('Quoted', 'towAuthQuoted'),
        line('Pre Auth', 'towAuthPre'),
        total('Total', ['towAuthQuoted', 'towAuthPre'], conv * tP),
      ],
    },
    {
      title: 'Drive Authorisations Received',
      rows: [
        line('Quoted', 'driveAuthQuoted'),
        line('Pre Auth', 'driveAuthPre'),
        total('Total', ['driveAuthQuoted', 'driveAuthPre'], conv * dP),
      ],
    },
    {
      title: 'Booked',
      rows: [line('Booked', 'booked', conv * 0.5)],
    },
    {
      title: 'Conversions',
      rows: [
        line('Drive Converted', 'driveConverted', conv * dP),
        line('Tow Converted', 'towConverted', conv * tP),
        total('Total', ['driveConverted', 'towConverted'], conv),
      ],
    },
    {
      title: 'Preliminary Conversions',
      rows: [
        line('Preliminary Drive', 'prelimDrive', conv * dP),
        line('Preliminary Tow', 'prelimTow', conv * tP),
        total('Total', ['prelimDrive', 'prelimTow'], conv),
      ],
    },
  ]

  return { weekDays: days, productionDays: prodDays, totalDays, totalWeeks, sections }
}
