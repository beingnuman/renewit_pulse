import { rpc } from './supabase'

// Conversions Per Insurer — Pulse-native re-write of the SSRS report
// "/REPORTS/01.Quoting and Conversions/Conversions Per Insurer" (the portal page
// reports-ConversionsPerInsurer.aspx).
//
// A "conversion" = a job reaching the 01-Converted state. In Pulse that's
// claims.conv_date (the synced text mirror of Online's [01-Converted]; the
// normalized claims.conversion_date column is not populated). Unlike the
// delivered/invoiced mirrors, conv_date carries full history (back to 2016).
//
// Output: one row per (month × insurer) with Units (count) and Approved
// (sum of approved_value), newest month first. Matches the cube to within the
// nightly-vs-live timing gap (validated against REN_01-SUPERCUBE WITH DATES 2015).
//
// Data path (main = Supabase only, no server reliance): the deployed RPC
// get_conversions_per_insurer.
function shape(rows) {
  const totalUnits = rows.reduce((s, r) => s + Number(r.units || 0), 0)
  const totalApproved = rows.reduce((s, r) => s + Number(r.approved || 0), 0)
  return { rows, totalUnits, totalApproved }
}

export async function getConversionsPerInsurer(branchId) {
  const rows = (await rpc('get_conversions_per_insurer', { p_branch_id: branchId })) || []
  return shape(rows)
}
