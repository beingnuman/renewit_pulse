// SSRS-style Daily Movement Report export — Excel (.xlsx) and HTML (-> PDF).
// Fed by the live report object from fetchReportData(); styled to match the legacy
// SSRS layout, generated entirely from Pulse data (no SSRS link, no Excel runtime).
// Adapted from samples/generate.mjs.
import ExcelJS from 'exceljs'

const NAVY = 'FF1E3456'
const NAVY_SOFT = 'FFE9EDF4'
const GREY = 'FFF4F5F7'

const PERF_BLOCKS = [
  { key: 'salesTeamPerformance', title: 'Sales Team Performance', subtitle: 'Key Accounts Managers, Estimators, Claims Handling Specialist, Booking Clerk' },
  { key: 'preProduction', title: 'Pre Production Team', subtitle: 'Parts Manager, Stripping & Loading' },
  { key: 'mainProduction', title: 'Main Production', subtitle: 'Production Manager, Line Managers, Quality Control' },
  { key: 'frontOffice', title: 'Front Office & Finance', subtitle: 'Delivery & Invoicing' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayLabel(iso) {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  if (isNaN(d.getTime())) return String(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// Map the live report object to the generator's shape.
function mapReport(data) {
  const t = data.targets || {}
  const period = t.period || {}
  const anySection = data.salesTeamPerformance || data.mainProduction || {}
  const weekIso = anySection.weekDays || []
  const prodDays = anySection.productionDays ?? null

  const header = {
    title: 'Branch Productivity Performance',
    subtitle: 'Dashboard ( Latest Sale Values )',
    branch: data.branch || '',
    asAt: fmtDate(data.reportDate),
    weekday: data.reportDate ? new Date(data.reportDate).toLocaleDateString('en-ZA', { weekday: 'long' }) : '',
    productionDay: prodDays,
  }
  const targets = {
    monthlyTowQuote: t.monthlyTowQuote, monthlyDriveQuote: t.monthlyDriveQuote,
    monthlyConversions: t.monthlyConversions, monthlyProductivity: t.monthlyProductivity,
    monthlyInvoicing: t.monthlyInvoicing, tdRatio: t.tdRatio,
    dateStart: fmtDate(period.dateStart), dateEnd: fmtDate(period.dateEnd),
    totalDays: period.totalDays, totalWeeks: period.totalWeeks,
  }
  const weekDays = weekIso.map(dayLabel)

  const perf = PERF_BLOCKS.map(({ key, title, subtitle }) => {
    const section = data[key]
    if (!section) return null
    return {
      title, subtitle,
      sections: (section.sections || []).map((s) => ({
        title: s.title,
        rows: (s.rows || []).map((r) => ({
          label: r.label, perDay: r.perDay || [], isTotal: !!r.isTotal,
          week: r.week, wkTgt: r.weeklyTarget, wkVar: r.weeklyVariance,
          month: r.month, mtdTgt: r.monthlyTargetToDate, monTgt: r.monthlyTarget, monVar: r.monthlyVariance,
        })),
      })),
    }
  }).filter(Boolean)

  const mr = data.movementReport || { groups: [] }
  const movements = {
    groups: (mr.groups || []).map((g) => ({
      from: g.from,
      rows: (g.rows || []).map((r) => ({ ...r, date: fmtDateTime(r.date) })),
      totalInvoiced: g.totalInvoiced, totalApproved: g.totalApproved,
    })),
    count: mr.count ?? (mr.groups || []).reduce((s, g) => s + g.rows.length, 0),
    grandTotalInvoiced: mr.grandTotalInvoiced, grandTotalApproved: mr.grandTotalApproved,
  }
  return { header, targets, weekDays, perf, movements }
}

/* ───────────────────────── EXCEL ───────────────────────── */
export async function buildMovementExcel(data) {
  const { header, targets, weekDays, perf, movements } = mapReport(data)
  const PERF_COLS = ['', ...weekDays, 'Week', 'Wk Tgt', 'Wk Var', 'Month', 'MTD Tgt', 'Target', 'Var']
  const wb = new ExcelJS.Workbook()
  wb.creator = 'renewit-reporting'
  const ws = wb.addWorksheet('Daily Movement Report', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  })
  ws.columns = [
    { width: 30 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
    { width: 10 }, { width: 9 }, { width: 9 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 9 },
  ]
  let R = 1
  const merge = (r, c1, c2) => ws.mergeCells(r, c1, r, c2)
  const setRow = (vals, startCol = 1) => {
    const r = ws.getRow(R)
    vals.forEach((v, i) => { r.getCell(startCol + i).value = v })
    return r
  }
  const fill = (cell, argb) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }
  const money = '#,##0'
  const thin = { style: 'thin', color: { argb: 'FFD8DCE4' } }
  const border = (cell) => { cell.border = { top: thin, left: thin, bottom: thin, right: thin } }

  // Title band
  merge(R, 1, 13); let c = ws.getCell(R, 1); c.value = header.title
  c.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }; fill(c, NAVY)
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }; ws.getRow(R).height = 26; R++
  merge(R, 1, 9); c = ws.getCell(R, 1); c.value = header.subtitle
  c.font = { italic: true, size: 10, color: { argb: 'FFFFFFFF' } }; fill(c, NAVY); c.alignment = { horizontal: 'left', indent: 1 }
  merge(R, 10, 13); c = ws.getCell(R, 10); c.value = `Branch: ${header.branch}`
  c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }; fill(c, NAVY); c.alignment = { horizontal: 'right', indent: 1 }
  ws.getRow(R).height = 16; R++
  merge(R, 1, 13); c = ws.getCell(R, 1)
  c.value = `As at: ${header.asAt}   ·   Weekday: ${header.weekday}   ·   Production Day ${header.productionDay ?? '—'} of ${targets.totalDays ?? '—'}`
  c.font = { size: 9, color: { argb: 'FF5B6577' } }; c.alignment = { horizontal: 'left', indent: 1 }; R += 2

  // Targets
  merge(R, 1, 13); c = ws.getCell(R, 1); c.value = "MONTHLY TARGETS (R'000)"
  c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }; fill(c, NAVY); c.alignment = { indent: 1 }; ws.getRow(R).height = 20; R++
  const tg = [
    ['Tow Quote', targets.monthlyTowQuote], ['Drive Quote', targets.monthlyDriveQuote],
    ['Conversions', targets.monthlyConversions], ['Productivity', targets.monthlyProductivity],
    ['Invoicing', targets.monthlyInvoicing], ['T / D Ratio', targets.tdRatio],
  ]
  const labRow = ws.getRow(R), valRow = ws.getRow(R + 1)
  tg.forEach(([lab, val], i) => {
    const col1 = i * 2 + 1
    ws.mergeCells(R, col1, R, col1 + 1); ws.mergeCells(R + 1, col1, R + 1, col1 + 1)
    const lc = labRow.getCell(col1); lc.value = lab; lc.font = { size: 9, color: { argb: 'FF5B6577' } }; lc.alignment = { horizontal: 'center' }; fill(lc, NAVY_SOFT)
    const vc = valRow.getCell(col1); vc.value = val; vc.font = { bold: true, size: 12, color: { argb: NAVY } }; vc.alignment = { horizontal: 'center' }; fill(vc, NAVY_SOFT)
    if (typeof val === 'number') vc.numFmt = money
  })
  labRow.height = 15; valRow.height = 20; R += 2
  merge(R, 1, 13); c = ws.getCell(R, 1)
  c.value = `Period: ${targets.dateStart} – ${targets.dateEnd}   ·   Total Days ${targets.totalDays}   ·   Total Weeks ${targets.totalWeeks}`
  c.font = { size: 9, color: { argb: 'FF5B6577' } }; c.alignment = { indent: 1 }; R += 2

  // Performance sections
  for (const block of perf) {
    merge(R, 1, 13); c = ws.getCell(R, 1); c.value = block.title
    c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }; fill(c, NAVY); c.alignment = { indent: 1 }; ws.getRow(R).height = 20; R++
    merge(R, 1, 13); c = ws.getCell(R, 1); c.value = `${block.subtitle}  ·  R'000`
    c.font = { italic: true, size: 9, color: { argb: 'FF5B6577' } }; c.alignment = { indent: 1 }; R++
    const hr = setRow(PERF_COLS)
    hr.eachCell((cell, col) => {
      if (col > 13) return
      cell.font = { bold: true, size: 9, color: { argb: NAVY } }
      cell.alignment = { horizontal: col === 1 ? 'left' : 'right' }
      fill(cell, GREY); border(cell)
    })
    hr.height = 16; R++
    for (const sec of block.sections) {
      merge(R, 1, 13); c = ws.getCell(R, 1); c.value = sec.title
      c.font = { bold: true, size: 9, color: { argb: 'FF38507A' } }; fill(c, NAVY_SOFT); c.alignment = { indent: 1 }; R++
      for (const row of sec.rows) {
        const vals = [row.label, ...row.perDay, row.week, row.wkTgt, row.wkVar, row.month, row.mtdTgt, row.monTgt, row.monVar]
        const rr = setRow(vals)
        rr.eachCell((cell, col) => {
          if (col > 13) return
          border(cell)
          if (col === 1) { cell.font = { size: 9, bold: !!row.isTotal, color: { argb: NAVY } }; cell.alignment = { horizontal: 'left', indent: 1 } }
          else {
            cell.numFmt = money
            cell.alignment = { horizontal: 'right' }
            const isVar = col === 9 || col === 13
            const v = cell.value
            cell.font = { size: 9, bold: !!row.isTotal, color: { argb: isVar && typeof v === 'number' && v < 0 ? 'FFC0392B' : isVar && typeof v === 'number' && v > 0 ? 'FF1E7E45' : NAVY } }
            if (v === null || v === undefined) cell.value = ''
          }
          if (row.isTotal) fill(cell, GREY)
        })
        R++
      }
    }
    R++
  }

  // Movements Today
  merge(R, 1, 13); c = ws.getCell(R, 1); c.value = 'Movements Today'
  c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }; fill(c, NAVY); c.alignment = { indent: 1 }
  ws.getRow(R).height = 20; R++
  const mcols = ['Date', 'User', 'Tow/Drive', 'RO No', 'Shop', 'Vehicle Reg', 'Count', 'Invoiced', 'Approved']
  const mhr = ws.getRow(R)
  mcols.forEach((h, i) => {
    const cell = mhr.getCell(i + 1); cell.value = h
    cell.font = { bold: true, size: 9, color: { argb: NAVY } }
    cell.alignment = { horizontal: i >= 6 ? 'right' : 'left' }
    fill(cell, GREY); border(cell)
  })
  mhr.height = 16; R++
  for (const g of movements.groups) {
    merge(R, 1, 9); c = ws.getCell(R, 1); c.value = g.from
    c.font = { bold: true, size: 9, color: { argb: 'FF38507A' } }; fill(c, NAVY_SOFT); c.alignment = { indent: 1 }; R++
    for (const r of g.rows) {
      const rr = ws.getRow(R)
      const vals = [r.date, r.user, r.towDrive, r.roNo, r.shop, r.vehicleReg, '', r.invoiced, r.approved]
      vals.forEach((v, i) => {
        const cell = rr.getCell(i + 1); cell.value = v
        border(cell)
        if (i >= 7) { cell.numFmt = money; cell.alignment = { horizontal: 'right' } }
        else if (i === 6) cell.alignment = { horizontal: 'right' }
        else cell.alignment = { horizontal: 'left', indent: i === 0 ? 1 : 0 }
        cell.font = { size: 9, color: { argb: 'FF2C3340' } }
      })
      R++
    }
    const tr = ws.getRow(R)
    const tvals = ['Total', '', '', '', '', '', g.rows.length, g.totalInvoiced, g.totalApproved]
    tvals.forEach((v, i) => {
      const cell = tr.getCell(i + 1); cell.value = v; border(cell); fill(cell, GREY)
      cell.font = { size: 9, bold: true, color: { argb: NAVY } }
      cell.alignment = { horizontal: i >= 6 ? 'right' : 'left', indent: i === 0 ? 1 : 0 }
      if (i >= 7) cell.numFmt = money
    })
    R++
  }
  const gr = ws.getRow(R)
  const gvals = ['GRAND TOTAL', '', '', '', '', '', movements.count, movements.grandTotalInvoiced, movements.grandTotalApproved]
  gvals.forEach((v, i) => {
    const cell = gr.getCell(i + 1); cell.value = v
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }; fill(cell, NAVY)
    cell.alignment = { horizontal: i >= 6 ? 'right' : 'left', indent: i === 0 ? 1 : 0 }
    if (i >= 7) cell.numFmt = money
  })
  gr.height = 18
  return wb
}

/* ───────────────────────── HTML (-> PDF) ───────────────────────── */
const fmt = (n) => {
  if (n == null || n === '') return ''
  const num = Number(n)
  return Number.isNaN(num) ? String(n) : num.toLocaleString('en-ZA', { maximumFractionDigits: 0 })
}
const varCls = (v) => (v == null ? '' : v < 0 ? 'neg' : v > 0 ? 'pos' : '')
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function buildMovementHtml(data) {
  const { header, targets, weekDays, perf, movements } = mapReport(data)

  const perfTable = (block) => {
    const head = `<tr><th class="lbl"></th>${weekDays.map((d) => `<th>${esc(d)}</th>`).join('')}<th>Week</th><th>Wk Tgt</th><th>Wk Var</th><th class="sep">Month</th><th>MTD Tgt</th><th>Target</th><th>Var</th></tr>`
    const body = block.sections.map((sec) => {
      const secRow = `<tr class="sec"><td colspan="13">${esc(sec.title)}</td></tr>`
      const rows = sec.rows.map((r) => `<tr class="${r.isTotal ? 'tot' : ''}">
        <td class="lbl">${esc(r.label)}</td>
        ${r.perDay.map((v) => `<td>${v ? fmt(v) : ''}</td>`).join('')}
        <td class="wk">${fmt(r.week)}</td><td>${fmt(r.wkTgt)}</td><td class="${varCls(r.wkVar)}">${fmt(r.wkVar)}</td>
        <td class="sep wk">${fmt(r.month)}</td><td>${fmt(r.mtdTgt)}</td><td>${fmt(r.monTgt)}</td><td class="${varCls(r.monVar)}">${fmt(r.monVar)}</td>
      </tr>`).join('')
      return secRow + rows
    }).join('')
    return `<section class="card"><div class="card-h">${esc(block.title)}<span>${esc(block.subtitle)} · R'000</span></div>
      <table class="perf"><thead>${head}</thead><tbody>${body}</tbody></table></section>`
  }

  const movementsTable = () => {
    const rows = movements.groups.map((g) => {
      const body = g.rows.map((r) => `<tr>
        <td class="l">${esc(r.date)}</td><td class="l">${esc(r.user || '')}</td>
        <td class="c"><span class="badge ${String(r.towDrive).toLowerCase() === 't' ? 'tow' : 'drive'}">${esc(r.towDrive || '')}</span></td>
        <td class="l">${esc(r.roNo ?? '')}</td><td class="l">${esc(r.shop ?? '')}</td><td class="l">${esc(r.vehicleReg || '')}</td>
        <td></td><td class="r">${fmt(r.invoiced)}</td><td class="r">${fmt(r.approved)}</td></tr>`).join('')
      return `<tr class="grp"><td colspan="9">${esc(g.from)}</td></tr>${body}
        <tr class="sub"><td colspan="6">Total</td><td class="r">${g.rows.length}</td><td class="r">${fmt(g.totalInvoiced)}</td><td class="r">${fmt(g.totalApproved)}</td></tr>`
    }).join('')
    return `<section class="card"><div class="card-h">Movements Today<span>${esc(header.branch)} · ${movements.count} movements</span></div>
      <table class="mv">
      <thead><tr><th class="l">Date</th><th class="l">User</th><th class="c">Tow/Drive</th><th class="l">RO No</th><th class="l">Shop</th><th class="l">Vehicle Reg</th><th class="r">Count</th><th class="r">Invoiced</th><th class="r">Approved</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="grand"><td colspan="6">Grand Total</td><td class="r">${movements.count}</td><td class="r">${fmt(movements.grandTotalInvoiced)}</td><td class="r">${fmt(movements.grandTotalApproved)}</td></tr></tfoot>
      </table></section>`
  }

  const tg = [
    ['Tow Quote', targets.monthlyTowQuote], ['Drive Quote', targets.monthlyDriveQuote],
    ['Conversions', targets.monthlyConversions], ['Productivity', targets.monthlyProductivity],
    ['Invoicing', targets.monthlyInvoicing], ['T / D Ratio', targets.tdRatio],
  ]
  const summary = `<section class="card summary">
    <div class="sum-h"><div><h1>${esc(header.title)}</h1><div class="sub">${esc(header.subtitle)}</div></div>
      <div class="branch"><span class="bl">Branch</span><span class="bn">${esc(header.branch)}</span><span class="bd">As at ${esc(header.asAt)}</span></div></div>
    <div class="tg-h">Monthly Targets (R'000)</div>
    <div class="tg-grid">${tg.map(([l, v]) => `<div class="tg"><span class="tl">${esc(l)}</span><span class="tv">${esc(fmt(v))}</span></div>`).join('')}</div>
    <div class="period"><span><b>Period</b> ${esc(targets.dateStart)} – ${esc(targets.dateEnd)}</span><span><b>Total Days</b> ${esc(targets.totalDays)}</span><span><b>Total Weeks</b> ${esc(targets.totalWeeks)}</span><span><b>Production Day</b> ${esc(header.productionDay)} of ${esc(targets.totalDays)}</span></div>
  </section>`

  return `<!doctype html><html><head><meta charset="utf-8"><title>Daily Movement Report</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e3456; margin: 0; font-size: 11px; background: #fff; }
  .card { border: 1px solid #e2e6ee; border-radius: 8px; margin: 0 0 14px; overflow: hidden; page-break-inside: avoid; }
  .card-h { background: #1e3456; color: #fff; font-weight: 700; font-size: 13px; padding: 9px 14px; }
  .card-h span { font-weight: 400; font-style: italic; opacity: .8; font-size: 10px; margin-left: 10px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 4px 7px; font-size: 10px; white-space: nowrap; }
  thead th { background: #f4f5f7; color: #1e3456; font-weight: 700; text-align: right; border-bottom: 1px solid #d8dce4; }
  .perf th.lbl, .perf td.lbl { text-align: left; }
  .perf td { text-align: right; border-bottom: 1px solid #eef0f4; }
  .perf tr.sec td { background: #e9edf4; color: #38507a; font-weight: 700; text-align: left; }
  .perf tr.tot td { font-weight: 700; background: #f7f8fa; }
  .perf .wk { font-weight: 600; } .perf .sep { border-left: 2px solid #d8dce4; }
  .pos { color: #1e7e45; } .neg { color: #c0392b; }
  .mv td, .mv th { border-bottom: 1px solid #eef0f4; }
  .mv .l { text-align: left; } .mv .r { text-align: right; } .mv .c { text-align: center; }
  .mv tr.grp td { background: #e9edf4; color: #38507a; font-weight: 700; text-align: left; }
  .mv tr.sub td { font-weight: 700; background: #f7f8fa; }
  .mv tfoot .grand td { background: #1e3456; color: #fff; font-weight: 700; }
  .badge { display: inline-block; min-width: 16px; padding: 1px 5px; border-radius: 4px; font-weight: 700; font-size: 9px; color: #fff; }
  .badge.tow { background: #c0392b; } .badge.drive { background: #2e6da4; }
  .summary { padding: 0; }
  .sum-h { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px; background: #1e3456; color: #fff; }
  .sum-h h1 { font-size: 17px; margin: 0; } .sum-h .sub { font-size: 11px; opacity: .8; }
  .branch { text-align: right; } .branch .bl { display: block; font-size: 9px; opacity: .7; text-transform: uppercase; }
  .branch .bn { font-size: 15px; font-weight: 700; } .branch .bd { display: block; font-size: 10px; opacity: .8; }
  .tg-h { padding: 8px 14px 0; font-weight: 700; font-size: 11px; }
  .tg-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; padding: 8px 14px; }
  .tg { background: #f4f5f7; border-radius: 6px; padding: 8px; text-align: center; }
  .tg .tl { display: block; font-size: 9px; color: #5b6577; } .tg .tv { font-size: 15px; font-weight: 700; }
  .period { display: flex; gap: 22px; padding: 4px 14px 14px; font-size: 10px; color: #5b6577; }
</style></head><body>
  ${summary}
  ${perf.map(perfTable).join('')}
  ${movementsTable()}
</body></html>`
}
