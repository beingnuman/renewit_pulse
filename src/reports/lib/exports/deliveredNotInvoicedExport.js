// Delivered Not yet Invoiced — Excel (.xlsx) and HTML (-> PDF) export.
// Mirrors the legacy SSRS "Delivered Not yet Invoiced all days" report layout:
// a header band (title + timestamp + Renew-it logo), a Summary block
// (Branch Name | Units | Value) and a Details grid (RO No · Dr No · Status ·
// Approved · Aging · Invoiced TMS Date · Insurer · Vehicle Reg · Last Comment).
// Generated entirely from the Pulse report object — no SSRS link, no Excel runtime.
import ExcelJS from 'exceljs'

const HEADER_BLUE = 'FF2F5C8A' // SSRS table-header blue (white bold text)
const TOTAL_GREY = 'FFEDEFF3'
const BORDER = 'FFB8C0CC'

// The 10 detail columns, in SSRS order.
const DETAIL_COLS = [
  { key: 'branch', label: 'Branch Name', width: 16, align: 'left' },
  { key: 'ro_number', label: 'RO No', width: 9, align: 'left' },
  { key: 'dr_number', label: 'Dr No', width: 9, align: 'left' },
  { key: 'status', label: 'Status', width: 20, align: 'left' },
  { key: 'value', label: 'Approved', width: 13, align: 'right', num: '#,##0.00' },
  { key: 'aging_days', label: 'Aging', width: 7, align: 'center' },
  { key: 'tms_inv_date', label: 'Invoiced TMS Date', width: 15, align: 'center' },
  { key: 'insurer', label: 'insurer', width: 18, align: 'left' },
  { key: 'registration', label: 'Vehicle Reg', width: 13, align: 'left' },
  { key: 'last_comment', label: 'Last Comment', width: 52, align: 'left', wrap: true },
]

function reportTitle(minAge) {
  return minAge > 0
    ? `Delivered not yet invoiced - aging exceed ${minAge} days`
    : 'Delivered not yet invoiced all days'
}

function fmtStamp(d) {
  const p = (n) => String(n).padStart(2, '0')
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`
}

function fmtDateCell(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Load the Renew-it logo once as a data URL (works in browser; cached).
let _logoCache
export async function loadLogoDataUrl() {
  if (_logoCache !== undefined) return _logoCache
  try {
    const { default: logoUrl } = await import('../../assets/Group.png')
    const res = await fetch(logoUrl)
    const blob = await res.blob()
    _logoCache = await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    _logoCache = null
  }
  return _logoCache
}

/* ───────────────────────── EXCEL ───────────────────────── */
export async function buildDniExcel(report, { logoDataUrl } = {}) {
  const { rows = [], count = 0, totalValue = 0, branchName = '', minAgeDays = 0 } = report
  const stamp = report.generatedAt ? new Date(report.generatedAt) : new Date()

  const wb = new ExcelJS.Workbook()
  wb.creator = 'renewit-reporting (Pulse)'
  const ws = wb.addWorksheet('Delivered Not Invoiced', {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  })
  ws.columns = DETAIL_COLS.map((c) => ({ width: c.width }))
  const NC = DETAIL_COLS.length

  const thin = { style: 'thin', color: { argb: BORDER } }
  const allBorders = { top: thin, left: thin, bottom: thin, right: thin }
  const fillSolid = (cell, argb) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }

  let R = 1
  // Header band: title + timestamp (logo floats over the top-right).
  ws.mergeCells(R, 1, R, NC)
  let c = ws.getCell(R, 1)
  c.value = reportTitle(minAgeDays)
  c.font = { bold: true, size: 15, color: { argb: 'FF2C3340' } }
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(R).height = 28
  R++
  ws.mergeCells(R, 1, R, NC)
  c = ws.getCell(R, 1)
  c.value = fmtStamp(stamp)
  c.font = { size: 9, color: { argb: 'FF5B6577' } }
  c.alignment = { horizontal: 'left', indent: 1 }
  R += 2

  // Logo top-right (anchored over the header rows), aspect ~4.82:1.
  if (logoDataUrl) {
    const imgId = wb.addImage({ base64: logoDataUrl.replace(/^data:[^;]+;base64,/, ''), extension: 'png' })
    ws.addImage(imgId, { tl: { col: NC - 2.05, row: 0.15 }, ext: { width: 196, height: 41 } })
  }

  // ── Summary ──
  ws.mergeCells(R, 1, R, NC); c = ws.getCell(R, 1); c.value = 'Summary'
  c.font = { bold: true, size: 12, color: { argb: 'FF2C3340' } }; c.alignment = { indent: 1 }
  ws.getRow(R).height = 18; R++

  const sumHead = ['Branch Name', 'Units', 'Value']
  const sumHr = ws.getRow(R)
  sumHead.forEach((h, i) => {
    const cell = sumHr.getCell(i + 1); cell.value = h
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 }
    fillSolid(cell, HEADER_BLUE); cell.border = allBorders
  })
  sumHr.height = 16; R++

  const valRounded = Math.round(Number(totalValue) || 0)
  const sumRows = [
    { label: branchName || '—', bold: false },
    { label: 'Total', bold: true },
  ]
  sumRows.forEach((sr) => {
    const rr = ws.getRow(R)
    const vals = [sr.label, count, valRounded]
    vals.forEach((v, i) => {
      const cell = rr.getCell(i + 1); cell.value = v
      cell.border = allBorders
      cell.font = { size: 10, bold: sr.bold, color: { argb: 'FF2C3340' } }
      cell.alignment = { horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 }
      if (i === 2) cell.numFmt = '#,##0'
      if (sr.bold) fillSolid(cell, TOTAL_GREY)
    })
    rr.height = 15; R++
  })
  R += 1

  // ── Details ──
  ws.mergeCells(R, 1, R, NC); c = ws.getCell(R, 1); c.value = 'Details'
  c.font = { bold: true, size: 12, color: { argb: 'FF2C3340' } }; c.alignment = { indent: 1 }
  ws.getRow(R).height = 18; R++

  const hr = ws.getRow(R)
  DETAIL_COLS.forEach((col, i) => {
    const cell = hr.getCell(i + 1); cell.value = col.label
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left', indent: col.align === 'left' ? 1 : 0, wrapText: true, vertical: 'middle' }
    fillSolid(cell, HEADER_BLUE); cell.border = allBorders
  })
  hr.height = 16; R++

  for (const row of rows) {
    const rr = ws.getRow(R)
    DETAIL_COLS.forEach((col, i) => {
      const cell = rr.getCell(i + 1)
      let v
      if (col.key === 'branch') v = branchName || ''
      else if (col.key === 'tms_inv_date') v = fmtDateCell(row.tms_inv_date)
      else if (col.key === 'value') v = row.value == null ? '' : Number(row.value)
      else if (col.key === 'aging_days') v = row.aging_days == null ? '' : Number(row.aging_days)
      else v = row[col.key] ?? ''
      cell.value = v
      cell.border = allBorders
      cell.font = { size: 9, color: { argb: 'FF2C3340' } }
      cell.alignment = {
        horizontal: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
        indent: col.align === 'left' ? 1 : 0,
        wrapText: !!col.wrap || col.key === 'insurer',
        vertical: 'top',
      }
      if (col.num && typeof v === 'number') cell.numFmt = col.num
    })
    R++
  }

  ws.autoFilter = { from: { row: hr.number, column: 1 }, to: { row: hr.number, column: NC } }
  return wb
}

/* ───────────────────────── HTML (-> PDF) ───────────────────────── */
export function buildDniHtml(report, { logoDataUrl } = {}) {
  const { rows = [], count = 0, totalValue = 0, branchName = '', minAgeDays = 0 } = report
  const stamp = report.generatedAt ? new Date(report.generatedAt) : new Date()
  const title = reportTitle(minAgeDays)
  const valRounded = Math.round(Number(totalValue) || 0)
  // SSRS rendered with US grouping (comma thousands, period decimal); mirror it.
  const money2 = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  const money0 = (n) => (n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }))

  const detailRows = rows.map((r) => `<tr>
      <td class="l">${esc(branchName)}</td>
      <td class="l">${esc(r.ro_number ?? '')}</td>
      <td class="l">${esc(r.dr_number ?? '')}</td>
      <td class="l">${esc(r.status ?? '')}</td>
      <td class="r">${esc(money2(r.value))}</td>
      <td class="c">${r.aging_days ?? ''}</td>
      <td class="c">${esc(fmtDateCell(r.tms_inv_date))}</td>
      <td class="l wrap">${esc(r.insurer ?? '')}</td>
      <td class="l">${esc(r.registration ?? '')}</td>
      <td class="l wrap">${esc(r.last_comment ?? '')}</td>
    </tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #2c3340; margin: 0; font-size: 11px; background: #fff; }
  .top { display: flex; justify-content: space-between; align-items: center; margin: 0 0 14px; }
  .top h1 { font-size: 18px; font-weight: 600; margin: 0; color: #2c3340; }
  .top .stamp { font-size: 11px; color: #5b6577; }
  .top img { height: 38px; }
  h2.sec { font-size: 13px; font-weight: 700; margin: 14px 0 6px; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #b8c0cc; padding: 3px 6px; font-size: 10px; vertical-align: top; }
  thead th { background: #2f5c8a; color: #fff; font-weight: 700; text-align: center; white-space: nowrap; }
  .summary { width: auto; min-width: 320px; }
  .summary td.l, .summary th.l { text-align: left; }
  .summary td.c { text-align: center; }
  .summary tr.total td { font-weight: 700; background: #edeff3; }
  .details { width: 100%; table-layout: fixed; }
  .details td.l { text-align: left; }
  .details td.r { text-align: right; }
  .details td.c { text-align: center; }
  .details td.wrap { white-space: normal; word-break: break-word; }
  .details td { white-space: nowrap; overflow: hidden; }
  tbody tr:nth-child(even) td { background: #f7f9fb; }
  .empty { color: #5b6577; font-style: italic; padding: 8px 0; }
</style></head><body>
  <div class="top">
    <h1>${esc(title)}</h1>
    <div class="stamp">${esc(fmtStamp(stamp))}</div>
    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Renew-it Group">` : ''}
  </div>

  <h2 class="sec">Summary</h2>
  <table class="summary">
    <thead><tr><th class="l">Branch Name</th><th>Units</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td class="l">${esc(branchName)}</td><td class="c">${count}</td><td class="c">${esc(money0(valRounded))}</td></tr>
      <tr class="total"><td class="l">Total</td><td class="c">${count}</td><td class="c">${esc(money0(valRounded))}</td></tr>
    </tbody>
  </table>

  <h2 class="sec">Details</h2>
  ${rows.length === 0
    ? `<div class="empty">No delivered, not-yet-invoiced jobs for ${esc(branchName || 'this branch')}.</div>`
    : `<table class="details">
    <colgroup>
      <col style="width:9%"><col style="width:6%"><col style="width:6%"><col style="width:13%">
      <col style="width:9%"><col style="width:5%"><col style="width:9%"><col style="width:12%">
      <col style="width:9%"><col style="width:22%">
    </colgroup>
    <thead><tr>
      <th>Branch Name</th><th>RO No</th><th>Dr No</th><th>Status</th><th>Approved</th>
      <th>Aging</th><th>Invoiced TMS Date</th><th>insurer</th><th>Vehicle Reg</th><th>Last Comment</th>
    </tr></thead>
    <tbody>${detailRows}</tbody>
  </table>`}
</body></html>`
}
