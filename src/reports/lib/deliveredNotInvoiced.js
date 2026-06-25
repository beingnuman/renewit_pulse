import { rpc } from './supabase'

// Delivered Not yet Invoiced — Aging (Pulse-native re-write of the SSRS report under
// 05.Invoicing, "Delivered Not yet Invoiced - Aging exceed 30 days").
//
// Jobs whose current Online status is delivered / final-costing
// (status ILIKE '%final%' OR '%deliver%') that were delivered more than `minAgeDays`
// ago and have not progressed to invoiced — i.e. money sitting in delivered-but-uninvoiced.
//
// Source of truth for the delivered date is claims.del_date (the synced mirror of the
// Online Claims.del_date; the normalized claims.delivery_date column is not populated).
//
// Data path (main = Supabase only, no server reliance): the deployed RPC
// get_delivered_not_invoiced. Default minAgeDays = 0 ("All" = delivered before
// today), matching the SSRS "all days" report (Date Delivered <= yesterday,
// BranchId only — no aging parameter).
export async function getDeliveredNotInvoiced(branchId, minAgeDays = 0) {
  const rows = (await rpc('get_delivered_not_invoiced', {
    p_branch_id: branchId,
    p_min_age_days: minAgeDays,
  })) || []
  const totalValue = rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
  return { rows, count: rows.length, totalValue, minAgeDays }
}
