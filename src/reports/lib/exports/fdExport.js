// FD daily-sheet builder (browser). Mirrors server/fdSheet.js + the /api/fd-sheet
// route: computes the ten department figures (R'000) per weekday from the movement
// rows, and fills the TARGET sheet of the RIVONIA template with formulas intact.
import ExcelJS from 'exceljs'
import { weekDays } from './salesPerformance.js'
import fdTemplateUrl from './fd-template.xlsx?url'

// Department -> { dir: 'from'|'to', match: regex on the status }. Order = TARGET rows 11..20.
const DEPARTMENTS = [
  { label: 'Prelim Conversions', dir: 'to',   match: /^01-Preliminary Conversion/i },
  { label: 'Converted',          dir: 'to',   match: /^01-Converted/i },
  { label: 'Received Parts',     dir: 'from', match: /^02-Awaiting Parts/i },
  { label: 'Panel',              dir: 'from', match: /^03-Panelbeating/i },
  { label: 'Paint',              dir: 'from', match: /^04-Paintshop/i },
  { label: 'Polish',             dir: 'from', match: /^06-Polishing/i },
  { label: 'Assembly',           dir: 'from', match: /^05-Assembly/i },
  { label: 'QC',                 dir: 'from', match: /^06-QC/i },
  { label: 'Delivered',          dir: 'to',   match: /^08-Delivered/i,  uncertain: true },
  { label: 'Invoiced',           dir: 'to',   match: /^09-(Invoiced|Preliminary Invoicing)/i, uncertain: true },
]

export const FD_ROW_BY_LABEL = {
  'Prelim Conversions': 11, 'Converted': 12, 'Received Parts': 13, 'Panel': 14,
  'Paint': 15, 'Polish': 16, 'Assembly': 17, 'QC': 18, 'Delivered': 19, 'Invoiced': 20,
}

// rows: [{ from_status, to_status, invoiced }] for ONE day (from get_movement_rows)
function computeFdFigures(rows) {
  const sums = DEPARTMENTS.map(() => 0)
  for (const r of rows) {
    for (let i = 0; i < DEPARTMENTS.length; i++) {
      const d = DEPARTMENTS[i]
      const status = d.dir === 'from' ? r.from_status : r.to_status
      if (status && d.match.test(status)) sums[i] += (Number(r.invoiced) || 0) / 1000
    }
  }
  return DEPARTMENTS.map((d, i) => ({ label: d.label, value: Math.round(sums[i]), uncertain: !!d.uncertain }))
}

// Fetch the Mon..Fri figures for the week containing `date` (days after `date` left null).
async function computeFdWeek(rpc, branchId, date) {
  const weekDates = weekDays(date)
  const perDay = []
  for (const d of weekDates) {
    if (d > date) { perDay.push(null); continue }
    const rows = (await rpc('get_movement_rows', { p_branch_id: branchId, p_date: d })) || []
    perDay.push(computeFdFigures(rows))
  }
  return { weekDates, perDay }
}

const NOTE = 'Movement-based estimate — verify against the invoicing report before sending.'

// Returns an ExcelJS workbook (FD template filled for the week) ready to download.
export async function buildFdWorkbook(rpc, branchId, date) {
  const week = await computeFdWeek(rpc, branchId, date)

  const buf = await (await fetch(fdTemplateUrl)).arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.getWorksheet('TARGET')

  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  for (let i = 0; i < 5; i++) {
    const col = 3 + i // C=3 .. G=7
    const dayIso = week.weekDates[i]
    ws.getCell(8, col).value = WD[i]
    ws.getCell(9, col).value = `${dayIso}T00:00:00.000Z`
    const figs = week.perDay[i]
    for (const [label, row] of Object.entries(FD_ROW_BY_LABEL)) {
      const cell = ws.getCell(row, col)
      const f = figs && figs.find((x) => x.label === label)
      cell.value = figs ? (f ? f.value : 0) : null
      cell.note = f && f.uncertain ? NOTE : undefined
    }
  }
  wb.calcProperties = { ...(wb.calcProperties || {}), fullCalcOnLoad: true }
  return { wb, weekStart: week.weekDates[0] }
}
