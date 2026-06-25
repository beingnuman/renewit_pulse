// Pixel-perfect SSRS Daily Movement Report export.
// Clones the exact 6-sheet SSRS workbook from template-spec.json (via renderEngine)
// and injects live Pulse data into the precise SSRS cell addresses, so downstream
// reports that read fixed cells keep working. The SSRS layout is irregular: day
// columns shift per sub-section and monthly totals can sit on a separate row above
// the weekly row — every row is mapped explicitly below.
import ExcelJS from 'exceljs'
import { spec, buildSheet, addLogo } from './renderEngine.mjs'

const SHEET = Object.fromEntries(spec.sheets.map((s) => [s.name, s]))

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z')
  if (isNaN(d.getTime())) return String(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}
function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const p = (n) => String(n).padStart(2, '0')
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${ap}`
}

// Make an override descriptor that keeps the captured cell's style but swaps the value.
function ov(map, sheetName, addr, value) {
  if (value === null || value === undefined || value === '') return
  const base = SHEET[sheetName]?.cells?.[addr] || {}
  map[addr] = { ...base, rich: undefined, value }
}

/* ── Sheet1: Targets / dashboard ── */
function sheet1Overrides(data) {
  const t = data.targets || {}
  const p = t.period || {}
  const sec = data.salesTeamPerformance || data.mainProduction || {}
  const m = {}
  ov(m, 'Sheet1', 'L13', t.monthlyTowQuote)
  ov(m, 'Sheet1', 'L18', t.monthlyDriveQuote)
  ov(m, 'Sheet1', 'L23', t.monthlyConversions)
  ov(m, 'Sheet1', 'L28', t.monthlyProductivity)
  ov(m, 'Sheet1', 'L33', t.monthlyInvoicing)
  ov(m, 'Sheet1', 'L37', t.tdRatio)
  ov(m, 'Sheet1', 'X14', data.reportDate ? new Date(data.reportDate).toLocaleDateString('en-ZA', { weekday: 'long' }) : null)
  ov(m, 'Sheet1', 'X25', p.totalWeeks)
  ov(m, 'Sheet1', 'X29', sec.productionDays ?? null)
  ov(m, 'Sheet1', 'X34', p.totalDays)
  ov(m, 'Sheet1', 'E17', fmtDate(p.dateStart))
  ov(m, 'Sheet1', 'E23', fmtDate(p.dateEnd))
  ov(m, 'Sheet1', 'H6', `Last Update : ${fmtDate(data.reportDate)}`)
  ov(m, 'Sheet1', 'H9', `BRANCH SELECTED:  ${(data.branch || '').toUpperCase()}`)
  return m
}

/* ── Performance sheets (2-5) ──
 * Each entry maps one of our section rows to its SSRS cells:
 *   sec   = our section title, row = our row label (or '__total' for the section total)
 *   tgt   = per-day target col (= monthlyTarget/totalDays), days = 5 day cols
 *   wkRow/moRow = row numbers (monthly totals sometimes sit on a row above)
 *   wkCols = [week, wkTgt, wkVar], moCols = [month, mtdTgt, target, var]
 */
const D = (s) => s.split('') // 'HJKMO' -> ['H','J','K','M','O']

const PERF_MAP = {
  // Sheet2 = Sales Team Performance
  salesTeamPerformance: { sheet: 'Sheet2', rows: [
    { sec: 'Tow Authorisations Received', row: 'Quoted', wkRow: 13, tgt: null, days: D('HJKMO'), wk: ['P'], mo: ['Z'] },
    { sec: 'Tow Authorisations Received', row: 'Pre Auth', wkRow: 14, tgt: null, days: D('HJKMO'), wk: ['P'], mo: ['Z'] },
    { sec: 'Tow Authorisations Received', row: '__total', wkRow: 16, tgt: 'F', days: D('HJKMO'), wk: ['P', 'S', 'U'], mo: ['Z', 'AB', 'AG', 'AL'] },
    { sec: 'Drive Authorisations Received', row: 'Quoted', wkRow: 18, tgt: null, days: D('HJKMO'), wk: ['P'], mo: ['Z'] },
    { sec: 'Drive Authorisations Received', row: 'Pre Auth', wkRow: 19, tgt: null, days: D('HJKMO'), wk: ['P'], mo: ['Z'] },
    { sec: 'Drive Authorisations Received', row: '__total', wkRow: 21, tgt: 'F', days: D('HJKMO'), wk: ['P', 'S', 'U'], mo: ['Z', 'AB', 'AG', 'AL'] },
    { sec: 'Booked', row: 'Booked', wkRow: 23, tgt: 'F', days: D('HJKMO'), wk: ['P', 'S', 'U'], mo: ['Z', 'AC', 'AH', 'AM'] },
    { sec: 'Preliminary Conversions', row: 'Preliminary Drive', wkRow: 25, tgt: 'G', days: D('IJLNO'), wk: ['P', 'T', 'V'], mo: ['Z', 'AD', 'AI', 'AN'] },
    { sec: 'Preliminary Conversions', row: 'Preliminary Tow', wkRow: 26, tgt: 'G', days: D('IJLNO'), wk: ['P', 'T', 'V'], mo: ['Z', 'AD', 'AI', 'AN'] },
    { sec: 'Preliminary Conversions', row: '__total', wkRow: 29, moRow: 28, tgt: 'G', days: D('IJLNO'), wk: ['P', 'T', 'V'], mo: ['Z', 'AD', 'AI', 'AN'] },
    { sec: 'Conversions', row: 'Drive Converted', wkRow: 32, tgt: 'F', days: D('HJKMO'), wk: ['P', 'S', 'U'], mo: ['Z', 'AC', 'AH', 'AM'] },
    { sec: 'Conversions', row: 'Tow Converted', wkRow: 33, tgt: 'F', days: D('HJKMO'), wk: ['P', 'S', 'U'], mo: ['Z', 'AC', 'AH', 'AM'] },
    { sec: 'Conversions', row: '__total', wkRow: 35, tgt: 'F', days: D('HJKMO'), wk: ['P', 'S', 'U'], mo: ['Z', 'AC', 'AH', 'AM'] },
  ] },
  // Sheet3 = Pre Production Team
  preProduction: { sheet: 'Sheet3', rows: [
    { sec: 'Ordered', row: 'Parts Ordered Main', wkRow: 14, moRow: 13, tgt: 'F', days: D('HJKMO'), wk: ['P', 'T', 'V'], mo: ['AA', 'AC', 'AM', 'AS'] },
    { sec: 'Ordered', row: '__total', wkRow: 18, moRow: 17, tgt: 'F', days: D('HJKMO'), wk: ['P', 'T', 'V'], mo: ['AA', 'AE', 'AL', 'AO'] },
    { sec: 'Received', row: 'Parts Received Main', wkRow: 29, moRow: 28, tgt: 'G', days: D('IJLNO'), wk: ['Q', 'U', 'W'], mo: ['AA', 'AE', 'AH', 'AT'] },
    { sec: 'Received', row: '__total', wkRow: 32, tgt: 'G', days: D('IJLNO'), wk: ['Q', 'U', 'W'], mo: ['AA', 'AF', 'AI', 'AR'] },
  ] },
  // Sheet4 = Main Production
  mainProduction: { sheet: 'Sheet4', rows: [
    { sec: 'Production - Main Shop', row: '03-Panelbeating', wkRow: 12, moRow: 11, tgt: 'F', days: D('ILNPS'), wk: ['T', 'W', 'AD'], mo: ['AI', 'AL', 'AT', 'AX'] },
    { sec: 'Production - Main Shop', row: '04-Paint Prep', wkRow: 14, moRow: 13, tgt: 'F', days: D('ILNPS'), wk: ['T', 'W', 'AD'], mo: ['AI', 'AL', 'AT', 'AX'] },
    { sec: 'Production - Main Shop', row: '04-Paintshop', wkRow: 16, moRow: 15, tgt: 'F', days: D('ILNPS'), wk: ['T', 'W', 'AD'], mo: ['AI', 'AL', 'AT', 'AX'] },
    { sec: 'Production - Main Shop', row: '05-Assembly', wkRow: 18, moRow: 17, tgt: 'F', days: D('ILNPS'), wk: ['T', 'W', 'AD'], mo: ['AI', 'AL', 'AT', 'AX'] },
    { sec: 'Production - Main Shop', row: '06-Polishing', wkRow: 20, moRow: 19, tgt: 'F', days: D('ILNPS'), wk: ['T', 'W', 'AD'], mo: ['AI', 'AL', 'AT', 'AX'] },
    { sec: 'Production - Main Shop', row: '06-QC', wkRow: 23, moRow: 21, tgt: 'F', days: D('ILNPS'), wk: ['T', 'W', 'AD'], mo: ['AI', 'AL', 'AT', 'AX'] },
    { sec: 'Production - Main Shop', row: '07-Finishing', wkRow: 25, moRow: 24, tgt: 'F', days: D('ILNPS'), wk: ['T', 'W', 'AD'], mo: ['AI', 'AL', 'AT', 'AX'] },
    { sec: 'Production - Main Shop', row: '08-Ready', wkRow: 30, tgt: 'F', days: D('IKMOR'), wk: ['T', 'V', 'AC'], mo: ['AH', 'AK', 'AU', 'AV'] },
  ] },
  // Sheet5 = Front Office & Finance
  frontOffice: { sheet: 'Sheet5', rows: [
    { sec: 'Delivered', row: 'Delivered - Main', wkRow: 13, moRow: 12, tgt: 'F', days: D('INQTW'), wk: ['Z', 'AF', 'AK'], mo: ['AS', 'AV', 'BC', 'BG'] },
    { sec: 'Delivered', row: '__total', wkRow: 17, moRow: 16, tgt: null, days: D('KORUX'), wk: ['AA', 'AH', 'AL'], mo: ['AU', 'AW', 'BD', 'BI'] },
    { sec: 'Invoiced', row: 'Invoiced', wkRow: 28, tgt: 'F', days: D('IMPSV'), wk: ['Y', 'AE', 'AI'], mo: ['AQ', 'AX', 'BE'] },
  ] },
}

function findRow(section, label) {
  for (const s of section.sections || []) {
    for (const r of s.rows || []) {
      if (label === '__total') { if (r.isTotal && s.title === section.__secTitle) return r }
    }
  }
  return null
}

// The SSRS Production sheets (3/4/5) show FROM-based figures (a car LEAVING a
// department). Read those FROM-based sections for the export while keeping the
// PERF_MAP cell maps unchanged. Sheet2 (Sales) stays TO-based.
const PERF_SOURCE = {
  salesTeamPerformance: 'salesTeamPerformance',
  preProduction: 'preProductionFrom',
  mainProduction: 'mainProductionFrom',
  frontOffice: 'frontOfficeFrom',
}

function perfOverrides(data, key) {
  const cfg = PERF_MAP[key]
  const section = data[PERF_SOURCE[key] || key]
  const m = {}
  if (!section || !cfg) return { sheet: cfg?.sheet, overrides: m }
  const totalDays = data.targets?.period?.totalDays || 20
  // index our rows by "secTitle|label" and "secTitle|__total"
  const byKey = {}
  for (const s of section.sections || []) {
    for (const r of s.rows || []) {
      byKey[`${s.title}|${r.label}`] = r
      if (r.isTotal) byKey[`${s.title}|__total`] = r
    }
  }
  for (const e of cfg.rows) {
    const r = byKey[`${e.sec}|${e.row}`]
    if (!r) continue
    const moRow = e.moRow || e.wkRow
    if (e.tgt && r.monthlyTarget != null) ov(m, cfg.sheet, `${e.tgt}${e.wkRow}`, Math.round(r.monthlyTarget / totalDays))
    e.days.forEach((col, i) => ov(m, cfg.sheet, `${col}${e.wkRow}`, r.perDay?.[i]))
    const wk = [r.week, r.weeklyTarget, r.weeklyVariance]
    e.wk.forEach((col, i) => ov(m, cfg.sheet, `${col}${e.wkRow}`, wk[i]))
    // SSRS shows monthly variance as (monthlyTargetToDate − month); our
    // monthlyVariance is (month − monthlyTargetToDate), so negate it here.
    const moVar = r.monthlyVariance == null ? null : -r.monthlyVariance
    const mo = [r.month, r.monthlyTargetToDate, r.monthlyTarget, moVar]
    e.mo.forEach((col, i) => ov(m, cfg.sheet, `${col}${moRow}`, mo[i]))
  }
  return { sheet: cfg.sheet, overrides: m }
}

/* ── Sheet6: Movements Today (regenerated, variable rows) ── */
const MV_HEADER_ROWS = 4 // rows 1-4 are title + column header
function sheet6Build(data) {
  const groups = data.movementReport?.groups || []
  const thin = { style: 'thin', color: { argb: 'FFD8DCE4' } }
  const cellStyle = (extra = {}) => ({ border: { top: thin, left: thin, bottom: thin, right: thin }, font: { size: 9, color: { argb: 'FF2C3340' } }, ...extra })
  const navySoft = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EDF4' } }
  const grey = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F5F7' } }
  const money = '#,##0'
  const extraCells = {}
  let R = MV_HEADER_ROWS + 1
  const put = (col, value, style) => { if (value !== undefined && value !== null && value !== '') extraCells[`${col}${R}`] = { ...style, value } }
  for (const g of groups) {
    g.rows.forEach((mv, i) => {
      if (i === 0) put('B', g.from, cellStyle({ fill: navySoft, font: { size: 9, bold: true, color: { argb: 'FF38507A' } } }))
      put('D', mv.date && fmtDateTime(mv.date), cellStyle())
      put('E', mv.user, cellStyle())
      put('F', mv.towDrive, cellStyle())
      put('G', mv.roNo, cellStyle())
      put('I', mv.vehicleReg, cellStyle())
      put('J', mv.invoiced, cellStyle({ numFmt: money }))
      put('L', mv.approved, cellStyle({ numFmt: money }))
      R++
    })
    put('D', 'Total', cellStyle({ fill: grey, font: { size: 9, bold: true, color: { argb: 'FF1E3456' } } }))
    put('J', g.totalInvoiced, cellStyle({ fill: grey, numFmt: money, font: { size: 9, bold: true, color: { argb: 'FF1E3456' } } }))
    put('L', g.totalApproved, cellStyle({ fill: grey, numFmt: money, font: { size: 9, bold: true, color: { argb: 'FF1E3456' } } }))
    R++
  }
  put('B', 'Total', cellStyle({ fill: grey, font: { size: 10, bold: true, color: { argb: 'FF1E3456' } } }))
  put('J', data.movementReport?.grandTotalInvoiced, cellStyle({ fill: grey, numFmt: money, font: { size: 10, bold: true, color: { argb: 'FF1E3456' } } }))
  put('L', data.movementReport?.grandTotalApproved, cellStyle({ fill: grey, numFmt: money, font: { size: 10, bold: true, color: { argb: 'FF1E3456' } } }))
  return extraCells
}

export async function buildMovementExcelSSRS(data) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'renewit-reporting (Pulse)'

  const s1 = sheet1Overrides(data)
  const perf = { Sheet2: perfOverrides(data, 'salesTeamPerformance'), Sheet3: perfOverrides(data, 'preProduction'), Sheet4: perfOverrides(data, 'mainProduction'), Sheet5: perfOverrides(data, 'frontOffice') }
  const s6cells = sheet6Build(data)

  for (const s of spec.sheets) {
    let opts = {}
    if (s.name === 'Sheet1') opts = { overrides: s1 }
    else if (perf[s.name]) opts = { overrides: perf[s.name].overrides }
    else if (s.name === 'Sheet6') opts = { skipRows: (r) => r > MV_HEADER_ROWS, extraCells: s6cells }
    const ws = buildSheet(wb, s, opts)
    if (s.images?.length) addLogo(wb, ws, s)
  }
  return wb
}
