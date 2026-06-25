import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  getAccessToken,
  refreshAccessToken,
  rpc,
} from './supabase'

// Daily Movement report — now served by the Supabase edge function
// `daily-movements` (was the local Node server /api/daily-movements).
// Same JSON shape: { branch, reportDate, targets, salesTeamPerformance,
// preProduction, mainProduction, frontOffice, movementReport }.
export async function getDailyMovements(branchId, date) {
  const url = `${SUPABASE_URL}/functions/v1/daily-movements`
  const body = JSON.stringify({ branchId, date: date || undefined })

  function buildHeaders() {
    const bearer = getAccessToken() || SUPABASE_ANON_KEY
    return {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${bearer}`,
    }
  }

  let res = await fetch(url, { method: 'POST', headers: buildHeaders(), body })
  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) res = await fetch(url, { method: 'POST', headers: buildHeaders(), body })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Movement report request failed (${res.status})`)
  }
  return res.json()
}

// Pre-invoicing exception list — now served by the Supabase RPC
// `get_pre_invoicing` (was /api/pre-invoicing). Period is applied inside the
// RPC from the branch config, so only the branchId is needed.
export async function getPreInvoicing(branchId) {
  const rows = (await rpc('get_pre_invoicing', { p_branch_id: branchId })) || []
  const totalValue = rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
  return { rows, count: rows.length, totalValue }
}
