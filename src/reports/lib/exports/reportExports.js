// Client-side report exports. Data comes from the Supabase API (the daily-movements
// edge function + RPCs); the files are rendered in the browser with the exact same
// builders + templates the server used, so the output is identical.
import { getDailyMovements } from '../movements'
import { rpc } from '../supabase'
import { buildMovementExcelSSRS } from './movementExportSSRS.js'
import { buildMovementHtml } from './movementExport.js'
import { buildPreProductionFrom, buildMainProductionFrom, buildFrontOfficeFrom } from './productionFrom.js'
import { buildFdWorkbook } from './fdExport.js'
import { buildDniExcel, buildDniHtml, loadLogoDataUrl } from './deliveredNotInvoicedExport.js'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function safeName(s) {
  return String(s || 'report').replace(/[^a-z0-9]+/gi, '_')
}

// Full report object incl. the FROM-based sections the SSRS Excel needs.
async function getMovementData(branchId, date) {
  const data = await getDailyMovements(branchId, date)
  const t = data.targets
  if (t?.period?.dateStart) {
    const periodRows =
      (await rpc('get_movement_period_rows', {
        p_branch_id: branchId,
        p_start: t.period.dateStart,
        p_end: data.reportDate,
      })) || []
    data.preProductionFrom = buildPreProductionFrom(periodRows, t, data.reportDate)
    data.mainProductionFrom = buildMainProductionFrom(periodRows, t, data.reportDate)
    data.frontOfficeFrom = buildFrontOfficeFrom(periodRows, t, data.reportDate)
  }
  return data
}

// SSRS-layout movement report → .xlsx download (identical to the server export).
export async function exportMovementExcel(branchId, date) {
  const data = await getMovementData(branchId, date)
  const wb = await buildMovementExcelSSRS(data)
  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(new Blob([buf], { type: XLSX_MIME }), `Daily_Movement_${safeName(data.branch)}_${data.reportDate}.xlsx`)
}

// Same HTML the SSRS PDF was rendered from → open and let the browser Print → Save as PDF.
export async function exportMovementPdf(branchId, date) {
  const data = await getMovementData(branchId, date)
  const html = buildMovementHtml(data)
  const w = window.open('', '_blank')
  if (!w) throw new Error('Pop-up blocked — allow pop-ups to export the PDF.')
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Give the new document a tick to lay out before invoking print.
  setTimeout(() => { try { w.focus(); w.print() } catch { /* user can print manually */ } }, 400)
}

// Delivered Not yet Invoiced → .xlsx download (SSRS "all days" layout).
// `report` is the already-loaded report object: { rows, count, totalValue,
// branchName, minAgeDays } — no re-fetch needed (the table already has it).
export async function exportDeliveredNotInvoicedExcel(report) {
  const logoDataUrl = await loadLogoDataUrl()
  const wb = await buildDniExcel(report, { logoDataUrl })
  const buf = await wb.xlsx.writeBuffer()
  const date = new Date().toISOString().slice(0, 10)
  downloadBlob(new Blob([buf], { type: XLSX_MIME }), `Delivered_Not_Invoiced_${safeName(report.branchName)}_${date}.xlsx`)
}

// Delivered Not yet Invoiced → HTML opened for browser Print → Save as PDF.
export async function exportDeliveredNotInvoicedPdf(report) {
  const logoDataUrl = await loadLogoDataUrl()
  const html = buildDniHtml(report, { logoDataUrl })
  const w = window.open('', '_blank')
  if (!w) throw new Error('Pop-up blocked — allow pop-ups to export the PDF.')
  w.document.open()
  w.document.write(html)
  w.document.close()
  setTimeout(() => { try { w.focus(); w.print() } catch { /* user can print manually */ } }, 400)
}

// FD daily sheet (template filled, formulas intact) → .xlsx download.
export async function exportFdSheet(branchId, date) {
  const { wb, weekStart } = await buildFdWorkbook(rpc, branchId, date)
  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(new Blob([buf], { type: XLSX_MIME }), `RIVONIA FD week of ${weekStart}.xlsx`)
}
