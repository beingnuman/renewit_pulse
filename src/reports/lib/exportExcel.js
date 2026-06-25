/**
 * Export utility — Excel and PDF via server-side edge functions.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken, refreshAccessToken } from './supabase'

const EXCEL_FN_URL = `${SUPABASE_URL}/functions/v1/generate-reports`
const PDF_FN_URL = `${SUPABASE_URL}/functions/v1/generate-reports-pdf`

function buildHeaders() {
  const bearer = getAccessToken() || SUPABASE_ANON_KEY
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${bearer}`,
  }
}

async function callEdgeFunction(url, reportType, branchId) {
  let res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ reportType, branchId }),
  })

  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ reportType, branchId }),
      })
    }
  }

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || `Export failed (${res.status})`)
  }

  return res.json()
}

function downloadFromUrl(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename || ''
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Export WIP Report to Excel
 */
export async function exportWipReport(branchId) {
  const result = await callEdgeFunction(EXCEL_FN_URL, 'wip', branchId)
  if (!result.success) throw new Error(result.error || 'Export failed')
  const wipReport = result.reports?.find(r => r.report === 'WIP Report')
  if (wipReport?.url) downloadFromUrl(wipReport.url, 'WIP_Report.xlsx')
  else throw new Error('No WIP Report URL returned')
  return result
}

/**
 * Export WIP Costing to Excel
 */
export async function exportWipCosting(branchId) {
  const result = await callEdgeFunction(EXCEL_FN_URL, 'costing', branchId)
  if (!result.success) throw new Error(result.error || 'Export failed')
  const costingReport = result.reports?.find(r => r.report === 'WIP Costing Report')
  if (costingReport?.url) downloadFromUrl(costingReport.url, 'WIP_Costing_Report.xlsx')
  else throw new Error('No WIP Costing Report URL returned')
  return result
}

/**
 * Export WIP Report to PDF
 */
export async function exportWipReportPdf(branchId) {
  const result = await callEdgeFunction(PDF_FN_URL, 'wip', branchId)
  if (!result.success) throw new Error(result.error || 'Export failed')
  const wipReport = result.reports?.find(r => r.report === 'WIP Report')
  if (wipReport?.url) downloadFromUrl(wipReport.url, 'WIP_Report.pdf')
  else throw new Error('No WIP Report PDF URL returned')
  return result
}

/**
 * Export WIP Costing to PDF
 */
export async function exportWipCostingPdf(branchId) {
  const result = await callEdgeFunction(PDF_FN_URL, 'costing', branchId)
  if (!result.success) throw new Error(result.error || 'Export failed')
  const costingReport = result.reports?.find(r => r.report === 'WIP Costing Report')
  if (costingReport?.url) downloadFromUrl(costingReport.url, 'WIP_Costing_Report.pdf')
  else throw new Error('No WIP Costing Report PDF URL returned')
  return result
}

function findMovementReport(result) {
  return result.reports?.find(r => /movement/i.test(r.report)) || result.reports?.[0]
}

/**
 * Export Daily Movement Report to Excel
 */
export async function exportMovementReport(branchId) {
  const result = await callEdgeFunction(EXCEL_FN_URL, 'movement', branchId)
  if (!result.success) throw new Error(result.error || 'Export failed')
  const report = findMovementReport(result)
  if (report?.url) downloadFromUrl(report.url, 'Daily_Movement_Report.xlsx')
  else throw new Error('No Movement Report URL returned')
  return result
}

/**
 * Export Daily Movement Report to PDF
 */
export async function exportMovementReportPdf(branchId) {
  const result = await callEdgeFunction(PDF_FN_URL, 'movement', branchId)
  if (!result.success) throw new Error(result.error || 'Export failed')
  const report = findMovementReport(result)
  if (report?.url) downloadFromUrl(report.url, 'Daily_Movement_Report.pdf')
  else throw new Error('No Movement Report PDF URL returned')
  return result
}
