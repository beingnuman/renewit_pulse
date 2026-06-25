import DeliveredNotInvoicedTable from '../components/DeliveredNotInvoicedTable'
import { getDeliveredNotInvoiced } from '../lib/deliveredNotInvoiced'
import ConversionsPerInsurerTable from '../components/ConversionsPerInsurerTable'
import { getConversionsPerInsurer } from '../lib/conversionsPerInsurer'

// ── Report registry ─────────────────────────────────────────────────────────
// A report from the SSRS catalog (src/reports/catalog.js) becomes "live" the
// moment its id appears here. Everything else renders as a "coming soon" tile.
//
// To add a new Pulse-native report:
//   1. Implement a fetcher (src/lib/<name>.js) and a table/view component.
//   2. Add an entry below keyed by the report id from catalog.js, providing:
//        fetch(branch)        -> Promise<data>   (branch = { id, name, code })
//        Component            -> React component
//        propsFrom(data, br)  -> props for Component
//   3. Done — the menu, loading, empty and error states are handled by Reports.jsx.
//
// The five original reports (movement, pre-invoicing, wip, wip-costing,
// commitments) predate this registry and keep their bespoke fetch/render logic
// inside Reports.jsx; they are listed in LEGACY_REPORTS so the menu marks them live.
export const REPORT_IMPLS = {
  'delivered-not-invoiced': {
    fetch: (branch) => getDeliveredNotInvoiced(branch.id),
    Component: DeliveredNotInvoicedTable,
    propsFrom: (data, branch) => ({ data, branchId: branch.id, branchName: branch.name }),
  },
  'conversions-per-insurer': {
    fetch: (branch) => getConversionsPerInsurer(branch.id),
    Component: ConversionsPerInsurerTable,
    propsFrom: (data, branch) => ({ data, branchId: branch.id, branchName: branch.name }),
  },
}

// Reports rendered by Reports.jsx's own (pre-registry) logic.
export const LEGACY_REPORTS = new Set([
  'movement',
  'pre-invoicing',
  'wip',
  'wip-costing',
  'commitments',
])

export function getImpl(id) {
  return REPORT_IMPLS[id] || null
}

export function isLive(id) {
  return id in REPORT_IMPLS || LEGACY_REPORTS.has(id)
}
