import JSZip from 'jszip'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'
import { uploadToBlob } from './blob'

// ---------- Operational KPI (Control Hub) dashboard ----------

export interface KpiLeg {
  tick?: 'red' | 'green'
  count?: number
  threshold?: string
  breached?: number
  over_10_days?: number
  tow_count?: number
  drive_count?: number
  value?: number
  rk?: number
}

export interface KpiNode {
  title?: string
  subtitle?: string
  tow?: KpiLeg
  drive?: KpiLeg
  tow_drive?: KpiLeg
}

export interface ChDashboard {
  success?: boolean
  total_jobs?: number
  branch_filter?: string
  generated_at?: string
  data_refreshed_at?: string
  sales?: Record<string, KpiNode>
  moderation?: Record<string, KpiNode>
  speedbump?: Record<string, KpiNode>
  production?: Record<string, KpiNode>
}

export async function getChDashboard(branchId?: string | null): Promise<ChDashboard> {
  const { data, error } = await supabase.rpc('get_ch_dashboard_data', {
    p_branch_id: branchId ?? null,
  })
  if (error) throw new Error(error.message)
  return (data ?? {}) as ChDashboard
}

// ---------- Summary tables (Sales / Production / Invoicing) ----------

export interface SummaryRow {
  department: string
  units: number
  latest_sales_value: number | string | null
  parts_maximum: number | string | null
  cos_percentage: number | string | null
}

interface SummaryArgs {
  branchId?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  statuses?: string[] | null
}

async function callSummary(fn: string, a: SummaryArgs, withStatuses: boolean): Promise<SummaryRow[]> {
  const args: Record<string, unknown> = {
    p_branch_id: a.branchId ?? null,
    p_date_from: a.dateFrom ?? null,
    p_date_to: a.dateTo ?? null,
  }
  if (withStatuses) args.p_statuses = a.statuses ?? null
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return (data ?? []) as SummaryRow[]
}

export const getSalesSummary = (a: SummaryArgs = {}) => callSummary('get_sales_summary', a, true)
export const getProductionSummary = (a: SummaryArgs = {}) => callSummary('get_production_summary', a, false)
export const getInvoicingSummary = (a: SummaryArgs = {}) => callSummary('get_invoicing_summary', a, true)

// ---------- Branches & permissions ----------

export interface Branch {
  id: string
  branch_name: string
  branch_code: string
  is_active?: boolean
  // Extended fields returned by branches_list (used by Branch Controls).
  address?: string | null
  phone?: string | null
  email?: string | null
  geo_lat?: number | null
  geo_lng?: number | null
  bulk_move?: boolean
  drive_show_status?: boolean
  tow_show_status?: boolean
  t_special?: string | null
  d_special?: string | null
  authenticate_pro_staff?: boolean
  authenticate_diag_reff?: boolean
  fuel_stations_count?: number
}

interface BranchesListResult {
  success?: boolean
  branches?: Branch[]
  total_count?: number
}

export async function listBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.rpc('branches_list', {
    p_search: null,
    p_is_active: true,
    p_limit: 200,
    p_offset: 0,
  })
  if (error) throw new Error(error.message)
  return ((data as BranchesListResult)?.branches ?? []) as Branch[]
}

export interface BranchUpdate {
  address?: string | null
  phone?: string | null
  email?: string | null
  geo_lat?: number | null
  geo_lng?: number | null
  bulk_move?: boolean
  drive_show_status?: boolean
  tow_show_status?: boolean
  t_special?: string | null
  d_special?: string | null
  authenticate_pro_staff?: boolean
  authenticate_diag_reff?: boolean
  is_active?: boolean
}

// Partial update — only the keys present in `patch` are sent to the RPC.
export async function updateBranch(id: string, patch: BranchUpdate): Promise<Branch> {
  const args: Record<string, unknown> = { p_id: id }
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) args[`p_${k}`] = v
  }
  const { data, error } = await supabase.rpc('branches_update', args)
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string; branch?: Branch } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Update failed')
  return res.branch as Branch
}

// ---------- Branch fuel stations ----------

export interface FuelStation {
  id: string
  branch_id: string
  branch_name?: string | null
  branch_code?: string | null
  name: string
  account_no: string | null
  address: string | null
  is_active: boolean
}

interface FuelListResult {
  success?: boolean
  fuel_stations?: FuelStation[]
  total_count?: number
}

export async function listFuelStations(branchId?: string | null): Promise<FuelStation[]> {
  const { data, error } = await supabase.rpc('branch_fuel_stations_list', {
    p_branch_id: branchId ?? null,
    p_search: null,
    p_is_active: null,
    p_limit: 500,
    p_offset: 0,
  })
  if (error) throw new Error(error.message)
  return ((data as FuelListResult)?.fuel_stations ?? []) as FuelStation[]
}

export interface FuelStationInput {
  branchId: string
  name: string
  accountNo?: string | null
  address?: string | null
  isActive?: boolean
}

function checkFuelRes(data: unknown): void {
  const res = data as { success?: boolean; error?: string } | null
  if (res && res.success === false) throw new Error(res.error || 'Operation failed')
}

export async function createFuelStation(input: FuelStationInput): Promise<void> {
  const { data, error } = await supabase.rpc('branch_fuel_stations_create', {
    p_branch_id: input.branchId,
    p_name: input.name.trim(),
    p_account_no: input.accountNo?.trim() || null,
    p_address: input.address?.trim() || null,
    p_is_active: input.isActive ?? true,
  })
  if (error) throw new Error(error.message)
  checkFuelRes(data)
}

export async function updateFuelStation(id: string, input: FuelStationInput): Promise<void> {
  const { data, error } = await supabase.rpc('branch_fuel_stations_update', {
    p_id: id,
    p_branch_id: input.branchId,
    p_name: input.name.trim(),
    p_account_no: input.accountNo?.trim() || null,
    p_address: input.address?.trim() || null,
    p_is_active: input.isActive ?? true,
  })
  if (error) throw new Error(error.message)
  checkFuelRes(data)
}

export async function deleteFuelStation(id: string, hard = false): Promise<void> {
  const { data, error } = await supabase.rpc('branch_fuel_stations_delete', {
    p_id: id,
    p_hard: hard,
  })
  if (error) throw new Error(error.message)
  checkFuelRes(data)
}

export interface UserPermissions {
  role?: string
  user_id?: string
  is_admin?: boolean
  branch_id?: string | null
  job_title?: string | null
  agent_type?: string | null
  branch_ids?: string[] | null
  agent_types?: string[] | null
  default_branch_id?: string | null
  additional_branches?: string[] | null
  can_access_all_branches?: boolean
}

// Set the user's active branch on the backend (so claim access scopes to it).
export async function updateUserBranch(userId: string, branchId: string): Promise<void> {
  const { data, error } = await supabase.rpc('update_user_branch', {
    p_user_id: userId,
    p_branch_id: branchId,
    p_set_as_default: false,
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; message?: string } | null
  if (res && res.success === false) throw new Error(res.message || 'Failed to switch branch')
}

export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const { data, error } = await supabase.rpc('get_user_permissions', { p_user_id: userId })
  if (error) throw new Error(error.message)
  return (data ?? {}) as UserPermissions
}

// ---------- Drill-down claim lists ----------

// Unified row used by the claims drill-down view.
export interface ClaimRow {
  id: string
  dr: string
  ro: string
  td: string
  customer: string
  contact: string
  registration: string
  status: string
  manufacturer: string
  insurer: string
  approvedValue: number
  csa: string
  speedShop: string
  warranty: boolean
  upsell: boolean
  aging: number | null
  dip: number | null
}

function toNum(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && isFinite(n) ? n : 0
}

interface ChClaimRaw {
  claim_id: string
  dr_number: string | null
  ro_number: string | null
  tow_drive: string | null
  customer_name: string | null
  mobile: string | null
  registration: string | null
  status: string | null
  make: string | null
  insurer: string | null
  speed_indicator: string | null
  days_open: number | null
  approved_amount: number | string | null
  csa_name: string | null
  is_warranty: boolean | null
  is_upsell: boolean | null
}

interface StatusClaimRaw {
  id: string
  claim_id?: string
  dr: string | null
  ro: string | null
  csa: string | null
  dip: number | null
  aging: number | null
  insurer: string | null
  customer: string | null
  tow_drive: string | null
  vehicle_reg: string | null
  manufacture: string | null
  claim_status: string | null
  approved_value: number | string | null
  customer_contact: string | null
  speed_shop: string | null
  is_warranty: boolean | null
  is_upsell: boolean | null
}

// Drill-down for an Operational KPI metric (e.g. quotes_not_sent_drive).
export async function getChDashboardClaims(
  filterType: string,
  branchId?: string | null,
): Promise<ClaimRow[]> {
  const { data, error } = await supabase.rpc('get_ch_dashboard_claims', {
    p_filter_type: filterType,
    p_branch_id: branchId ?? null,
    p_limit: 9999,
    p_offset: 0,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ChClaimRaw[]).map((r) => ({
    id: r.claim_id,
    dr: r.dr_number ?? '',
    ro: r.ro_number ?? '',
    td: r.tow_drive ?? '',
    customer: r.customer_name ?? '',
    contact: r.mobile ?? '',
    registration: r.registration ?? '',
    status: r.status ?? '',
    manufacturer: r.make ?? '',
    insurer: r.insurer ?? '',
    approvedValue: toNum(r.approved_amount),
    csa: r.csa_name ?? '',
    speedShop: r.speed_indicator ?? '',
    warranty: !!r.is_warranty,
    upsell: !!r.is_upsell,
    aging: r.days_open ?? null,
    dip: null,
  }))
}

interface StatusClaimsResult {
  claims?: StatusClaimRaw[]
  total_count?: number
}

// Drill-down for a summary status row (e.g. 08-DELIVERED).
export async function getClaimsByStatus(
  statusName: string,
  branchId?: string | null,
): Promise<ClaimRow[]> {
  const { data, error } = await supabase.rpc('get_claims_by_status', {
    p_status_name: statusName,
    p_branch_id: branchId ?? null,
    p_limit: 9999,
    p_offset: 0,
    p_sort_column: 'created_at',
    p_sort_direction: 'DESC',
  })
  if (error) throw new Error(error.message)
  const claims = (data as StatusClaimsResult)?.claims ?? []
  return claims.map((r) => ({
    id: r.id || r.claim_id || r.dr || '',
    dr: r.dr ?? '',
    ro: r.ro ?? '',
    td: r.tow_drive ?? '',
    customer: r.customer ?? '',
    contact: r.customer_contact ?? '',
    registration: r.vehicle_reg ?? '',
    status: r.claim_status ?? '',
    manufacturer: r.manufacture ?? '',
    insurer: r.insurer ?? '',
    approvedValue: toNum(r.approved_value),
    csa: r.csa ?? '',
    speedShop: r.speed_shop ?? '',
    warranty: !!r.is_warranty,
    upsell: !!r.is_upsell,
    aging: r.aging ?? null,
    dip: r.dip ?? null,
  }))
}

// ---------- All Claims (filter_claims_enhanced) ----------

export interface ClaimListRow {
  id: string
  dr: string
  ro: string
  aging: number | null
  dip: number | null
  registration: string
  status: string
  category: string
  manufacturer: string
  csa: string
  insurer: string
  approvedValue: number
  customer: string
  contact: string
  speedShop: string
  td: string
  warranty: boolean
  upsell: boolean
}

interface FcRaw {
  claim_id: string
  dr_number: string | null
  ro_number: string | null
  aging: number | null
  dip: number | null
  vehicle_registration: string | null
  status_name: string | null
  category: string | null
  vehicle_make: string | null
  vehicle_info: string | null
  csa_name: string | null
  insurance_company: string | null
  approved_amount: number | string | null
  quote_value: number | string | null
  customer_name: string | null
  customer_phone: string | null
  speed_shop: string | null
  tow_drive: string | null
  job_type: string | null
}

function mapClaim(r: FcRaw): ClaimListRow {
  const status = r.status_name ?? ''
  const lc = status.toLowerCase()
  const jt = (r.job_type ?? '').trim().toLowerCase()
  return {
    id: r.claim_id,
    dr: r.dr_number ?? '',
    ro: r.ro_number ?? '',
    aging: r.aging ?? null,
    dip: r.dip ?? null,
    registration: r.vehicle_registration ?? '',
    status,
    category: r.category ?? '',
    manufacturer: r.vehicle_make || r.vehicle_info || '',
    csa: r.csa_name ?? '',
    insurer: r.insurance_company ?? '',
    approvedValue: toNum(r.approved_amount) || toNum(r.quote_value),
    customer: r.customer_name ?? '',
    contact: r.customer_phone ?? '',
    speedShop: r.speed_shop ?? '',
    td: r.tow_drive ?? '',
    warranty: jt === 'warranty' || lc.includes('warranty'),
    upsell: jt === 'upsell' || lc.includes('upsell'),
  }
}

export interface FilterClaimsArgs {
  branchId?: string | null
  status?: string | null
  category?: string | null
  search?: string | null
  overdue?: boolean | null
  dateFrom?: string | null
  dateTo?: string | null
  limit: number
  offset: number
  sortColumn?: string
  sortDirection?: 'ASC' | 'DESC'
}

export async function filterClaims(a: FilterClaimsArgs): Promise<ClaimListRow[]> {
  const { data, error } = await supabase.rpc('filter_claims_enhanced', {
    p_status: a.status ?? null,
    p_category: a.category ?? null,
    p_branch_id: a.branchId ?? null,
    p_search_term: a.search ?? null,
    p_is_overdue: a.overdue ?? null,
    p_date_from: a.dateFrom ?? null,
    p_date_to: a.dateTo ?? null,
    p_limit: a.limit,
    p_offset: a.offset,
    p_sort_column: a.sortColumn ?? 'created_at',
    p_sort_direction: a.sortDirection ?? 'DESC',
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as FcRaw[]).map(mapClaim)
}

export async function countClaims(a: {
  branchId?: string | null
  status?: string | null
  category?: string | null
  search?: string | null
  overdue?: boolean | null
  dateFrom?: string | null
  dateTo?: string | null
}): Promise<number> {
  const { data, error } = await supabase.rpc('get_filtered_claims_count', {
    p_status: a.status ?? null,
    p_category: a.category ?? null,
    p_branch_id: a.branchId ?? null,
    p_search_term: a.search ?? null,
    p_is_overdue: a.overdue ?? null,
    p_date_from: a.dateFrom ?? null,
    p_date_to: a.dateTo ?? null,
  })
  if (error) throw new Error(error.message)
  return Number((data as { total_count?: number })?.total_count ?? 0)
}

async function rawCategoryCount(branchId: string | null | undefined, category: string): Promise<number> {
  const { data, error } = await supabase.rpc('filter_claims_enhanced', {
    p_category: category,
    p_branch_id: branchId ?? null,
    p_limit: 100000,
    p_offset: 0,
  })
  if (error) throw new Error(error.message)
  return (data as unknown[] | null)?.length ?? 0
}

export interface CategoryCounts {
  QUOTE: number
  AUTHORISED: number
  WIP: number
  FINALISED: number
  total: number
}

// QUOTE/AUTHORISED/WIP/OLD are small → fetch directly; FINALISED = remainder.
export async function getCategoryCounts(branchId?: string | null): Promise<CategoryCounts> {
  const [total, quote, authorised, wip, old] = await Promise.all([
    countClaims({ branchId }),
    rawCategoryCount(branchId, 'QUOTE'),
    rawCategoryCount(branchId, 'AUTHORISED'),
    rawCategoryCount(branchId, 'WIP'),
    rawCategoryCount(branchId, 'OLD'),
  ])
  return {
    QUOTE: quote,
    AUTHORISED: authorised,
    WIP: wip,
    FINALISED: Math.max(0, total - quote - authorised - wip - old),
    total,
  }
}

export interface StatusOption {
  code: string
  label: string
  group: string
}

interface StatusRaw {
  status_code: string
  display_name: string
}

export async function listStatusOptions(): Promise<StatusOption[]> {
  const { data, error } = await supabase.rpc('get_statuses_by_category')
  if (error) throw new Error(error.message)
  const map = (data ?? {}) as Record<string, StatusRaw[] | null>
  const out: StatusOption[] = []
  for (const group in map) {
    for (const s of map[group] ?? []) {
      out.push({ code: s.status_code, label: s.display_name, group })
    }
  }
  return out
}

// ---------- Admin: users & role lists ----------

export interface AdminUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  status: string | null
  isAdmin: boolean
  branchId: string | null
  canAccessAllBranches: boolean
  agentType: string | null
  agentTypes: string[]
  additionalBranchIds: string[]
}

interface AdminUserRaw {
  id: string
  name: string | null
  known_as: string | null
  email: string | null
  phone: string | null
  role: string | null
  status: string | null
  is_admin: boolean | null
  branch_id: string | null
  can_access_all_branches: boolean | null
  agent_type: string | null
  agent_types: string[] | null
  additional_branches: string[] | null
}

// Prettify a normalized agent_type like "conversions_clerk" -> "Conversions Clerk".
export function prettyRole(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const ROLE_PALETTE: { bg: string; fg: string }[] = [
  { bg: '#e8f1fc', fg: '#1b3a6b' }, // blue
  { bg: '#e1f5ee', fg: '#0f6e56' }, // teal
  { bg: '#f3eefe', fg: '#534ab7' }, // purple
  { bg: '#fbeaf0', fg: '#993556' }, // pink
  { bg: '#fbf0db', fg: '#854f0b' }, // amber
  { bg: '#eaf3de', fg: '#3b6d11' }, // green
  { bg: '#faece7', fg: '#993c1d' }, // coral
  { bg: '#fdecec', fg: '#a32d2d' }, // red
  { bg: '#eef0fb', fg: '#3c3489' }, // indigo
  { bg: '#eef2f7', fg: '#475569' }, // slate
]

// Fixed, dedicated colors per role. Admin is highlighted (filled brand red).
const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  admin: { bg: '#b00830', fg: '#ffffff' },
  csa: { bg: '#e1f5ee', fg: '#0f6e56' },
  estimator: { bg: '#e8f1fc', fg: '#1b3a6b' },
  parts_buyer: { bg: '#faece7', fg: '#993c1d' },
  moderation: { bg: '#f3eefe', fg: '#534ab7' },
  claims_handler: { bg: '#fbf0db', fg: '#854f0b' },
  conversions_clerk: { bg: '#fbeaf0', fg: '#993556' },
  costing_clerk: { bg: '#eef0fb', fg: '#3c3489' },
  financial_manager: { bg: '#eaf3de', fg: '#3b6d11' },
  floor_manager: { bg: '#eef2f7', fg: '#475569' },
  operations_director: { bg: '#e0f2fb', fg: '#0e6e8c' },
  auditor: { bg: '#e7f0ee', fg: '#0f766e' },
  manager: { bg: '#efeafe', fg: '#6b46c1' },
  senior: { bg: '#f5ece2', fg: '#7a4f1d' },
}

// One stable color per role / agent_type. Admin is highlighted.
export function roleColor(value: string | null | undefined): { bg: string; fg: string } {
  if (!value) return ROLE_PALETTE[ROLE_PALETTE.length - 1]
  const lc = value.toLowerCase()
  if (lc.includes('admin') || lc === 'system') return ROLE_COLORS.admin
  const key = lc.replace(/[\s\-()]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  if (ROLE_COLORS[key]) return ROLE_COLORS[key]
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return ROLE_PALETTE[h % ROLE_PALETTE.length]
}

// "Former staff" tombstones created by hard-delete should never show in the UI.
function isTombstone(u: { email?: string | null; name?: string | null }): boolean {
  const email = (u.email ?? '').toLowerCase()
  const name = (u.name ?? '').toLowerCase()
  return email.startsWith('former+') || email.endsWith('@system.local') || name.includes('(former staff)')
}

export async function getAllUsers(
  a: { active?: boolean | null; role?: string | null; branchId?: string | null; search?: string | null } = {},
): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('get_all_users', {
    p_filter_active: a.active ?? null,
    p_filter_role: a.role ?? null,
    p_filter_branch_id: a.branchId ?? null,
    p_search: a.search ?? null,
  })
  if (error) throw new Error(error.message)
  const users = (data as { users?: AdminUserRaw[] })?.users ?? []
  return users
    .filter((u) => !isTombstone(u))
    .map((u) => ({
    id: u.id,
    name: u.name || u.known_as || u.email || 'User',
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    isAdmin: !!u.is_admin,
    branchId: u.branch_id,
    canAccessAllBranches: !!u.can_access_all_branches,
    agentType: u.agent_type ?? null,
    agentTypes: u.agent_types ?? [],
    additionalBranchIds: u.additional_branches ?? [],
  }))
}

// Soft delete = deactivate (reversible). Hard delete = permanently remove;
// the user's claim/audit history is reassigned to a "former staff" tombstone.
export async function deleteUser(userId: string, hardDelete: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('delete_user', {
    p_user_id: userId,
    p_hard_delete: hardDelete,
  })
  if (error) {
    if (/timeout|57014|too long/i.test(error.message)) {
      throw new Error(
        'This user has too much history to delete instantly. Use “Deactivate” instead — it blocks access and keeps the records.',
      )
    }
    throw new Error(error.message)
  }
  const res = data as { success?: boolean; message?: string; error?: string } | null
  if (res && res.success === false) throw new Error(res.error || 'Delete failed')
  return res?.message || 'Done'
}

export interface RoleMember {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string | null
  isActive: boolean
  department: string | null
  branchId: string | null
}

interface RoleRaw {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  is_active: boolean | null
  department?: string | null
  branch_uid?: string | null
}

type RoleListArgs = { search?: string | null; active?: boolean | null; branchId?: string | null }

async function roleList(
  fn: string,
  key: string,
  a: RoleListArgs = {},
): Promise<RoleMember[]> {
  const { data, error } = await supabase.rpc(fn, {
    p_search: a.search ?? null,
    p_is_active: a.active ?? null,
    p_limit: 1000,
    p_offset: 0,
    p_branch_id: a.branchId ?? null,
  })
  if (error) throw new Error(error.message)
  const arr = ((data as Record<string, RoleRaw[]>)?.[key] ?? []) as RoleRaw[]
  return arr
    .filter((r) => !(r.email ?? '').toLowerCase().endsWith('@legacy.local'))
    .map((r) => ({
    id: r.id,
    name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || '—',
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    email: r.email,
    isActive: r.is_active !== false,
    department: r.department ?? null,
    branchId: r.branch_uid ?? null,
  }))
}

export const getCsas = (a?: RoleListArgs) =>
  roleList('csas_list', 'csas', a)
export const getEstimators = (a?: RoleListArgs) =>
  roleList('estimators_list', 'estimators', a)
export const getPartsBuyers = (a?: RoleListArgs) =>
  roleList('parts_buyers_list', 'parts_buyers', a)
export const getProductionStaff = (a?: RoleListArgs) =>
  roleList('production_staff_list', 'staff', a)

// ---------- Role member CRUD (CSA / Estimator / Parts Buyer / Production Staff) ----------

export type RoleEntity = 'csa' | 'estimator' | 'parts' | 'production'

const ROLE_FNS: Record<RoleEntity, { create: string; update: string; delete: string }> = {
  csa: { create: 'csas_create', update: 'csas_update', delete: 'csas_delete' },
  estimator: { create: 'estimators_create', update: 'estimators_update', delete: 'estimators_delete' },
  parts: { create: 'parts_buyers_create', update: 'parts_buyers_update', delete: 'parts_buyers_delete' },
  production: {
    create: 'production_staff_create',
    update: 'production_staff_update',
    delete: 'production_staff_delete',
  },
}

export interface RoleMemberInput {
  firstName: string
  lastName: string
  email: string
  isActive: boolean
  department?: string | null
  branchId?: string | null
}

// Extract the new record's id from a *_create RPC payload (key varies by entity).
function newRoleId(data: unknown): string | undefined {
  const obj = data as Record<string, unknown> | null
  if (!obj) return undefined
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && 'id' in (v as Record<string, unknown>)) {
      const id = (v as { id?: unknown }).id
      if (typeof id === 'string') return id
    }
  }
  return undefined
}

async function setRoleMemberBranch(
  entity: RoleEntity,
  id: string,
  branchId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('role_set_branch', {
    p_entity: entity,
    p_id: id,
    p_branch_id: branchId,
  })
  if (error) throw new Error(error.message)
}

// Turn the RPC's coded errors into friendly messages.
function roleError(data: unknown): void {
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success !== false) return
  const code = res.error || 'Operation failed'
  const map: Record<string, string> = {
    email_already_exists: 'That email is already in use.',
    invalid_department: 'That department is not allowed.',
    not_found: 'Record not found.',
    invalid_status: 'Invalid status.',
  }
  throw new Error(map[code] ?? code)
}

export async function createRoleMember(entity: RoleEntity, input: RoleMemberInput): Promise<void> {
  const args: Record<string, unknown> = {
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_email: input.email.trim(),
    p_is_active: input.isActive,
  }
  // Always pass p_department for production to disambiguate the overloaded RPC.
  if (entity === 'production') args.p_department = input.department?.trim() || null
  const { data, error } = await supabase.rpc(ROLE_FNS[entity].create, args)
  if (error) throw new Error(error.message)
  roleError(data)
  if (input.branchId !== undefined) {
    const id = newRoleId(data)
    if (id) await setRoleMemberBranch(entity, id, input.branchId ?? null)
  }
}

export async function updateRoleMember(
  entity: RoleEntity,
  id: string,
  input: RoleMemberInput,
): Promise<void> {
  const args: Record<string, unknown> = {
    p_id: id,
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_email: input.email.trim(),
    p_status: input.isActive ? 'active' : 'inactive',
  }
  if (entity === 'production') args.p_department = input.department?.trim() || null
  const { data, error } = await supabase.rpc(ROLE_FNS[entity].update, args)
  if (error) throw new Error(error.message)
  roleError(data)
  if (input.branchId !== undefined) {
    await setRoleMemberBranch(entity, id, input.branchId ?? null)
  }
}

export async function deleteRoleMember(entity: RoleEntity, id: string): Promise<void> {
  const { data, error } = await supabase.rpc(ROLE_FNS[entity].delete, { p_id: id })
  if (error) throw new Error(error.message)
  roleError(data)
}

// Curated system-role (job title) options for the create-user form.
export const SYSTEM_ROLES: string[] = [
  'Admin (Full Access)',
  'Operations Director',
  'Floor Manager',
  'Financial Manager',
  'Claims Handler',
  'Conversions Clerk',
  'Costing Clerk',
  'CSA',
  'Estimator',
  'Parts Buyer',
  'Moderation',
  'Auditor',
]

export interface AgentType {
  id: string
  name: string
  description: string | null
}
export interface AgentTypeGroup {
  category: string
  agentTypes: AgentType[]
}

interface AgentTypeRaw {
  category: string
  agent_types: { id: string; name: string; description: string | null }[]
}

interface RoleAgentRaw {
  id: string
  agent_type_name: string
  default_roles: string[] | null
}

export interface RoleAgentType {
  id: string
  name: string
  defaultRoles: string[]
}

// Returns the full agent-type list with each type's default_roles tag, so the
// caller can auto-select the ones that belong to the chosen role.
export async function getAgentTypesForRole(roleKey: string): Promise<RoleAgentType[]> {
  const { data, error } = await supabase.rpc('get_agent_types_for_role', { p_role: roleKey })
  if (error) throw new Error(error.message)
  return ((data ?? []) as RoleAgentRaw[]).map((r) => ({
    id: r.id,
    name: r.agent_type_name,
    defaultRoles: r.default_roles ?? [],
  }))
}

export async function getAgentTypesByCategory(): Promise<AgentTypeGroup[]> {
  const { data, error } = await supabase.rpc('get_agent_types_by_category')
  if (error) throw new Error(error.message)
  const groups = (data ?? []) as AgentTypeRaw[]
  return groups.map((g) => ({
    category: g.category,
    agentTypes: (g.agent_types ?? []).map((a) => ({ id: a.id, name: a.name, description: a.description })),
  }))
}

export interface CreateUserInput {
  email: string
  fullName: string
  systemRole: string
  phone: string
  primaryBranchId: string
  additionalBranchIds: string[]
  isActive: boolean
  agentTypeNames: string[]
}

function checkRes(data: unknown) {
  const res = data as { success?: boolean; message?: string; error?: string } | null
  if (res && res.success === false) throw new Error(res.message || res.error || 'Operation failed')
}

// Normalize a display role ("Admin (Full Access)") to the agent_type key ("admin").
function roleToAgentType(systemRole: string): string {
  const lc = systemRole.toLowerCase()
  if (lc.includes('admin')) return 'admin'
  return lc.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export async function createUser(input: CreateUserInput): Promise<void> {
  const isAdmin = /admin/i.test(input.systemRole)
  const branchIds = [input.primaryBranchId, ...input.additionalBranchIds.filter((b) => b !== input.primaryBranchId)]
  const { data, error } = await supabase.rpc('create_user_with_role', {
    p_email: input.email,
    p_full_name: input.fullName,
    p_username: input.email,
    p_system_role: input.systemRole,
    p_phone: input.phone,
    p_branch_ids: branchIds,
    p_default_branch_id: input.primaryBranchId,
    p_is_active: input.isActive,
    p_agent_types: input.agentTypeNames.length ? input.agentTypeNames : null,
    p_agent_type_single: roleToAgentType(input.systemRole),
    p_has_admin_role: isAdmin,
    p_send_email: true,
  })
  if (error) throw new Error(error.message)
  checkRes(data)
}

export interface UpdateUserInput {
  email: string
  fullName: string
  systemRole: string
  phone: string
  primaryBranchId: string
  additionalBranchIds: string[]
  originalAdditionalBranchIds: string[]
  isActive: boolean
  agentTypeNames: string[]
}

// update_user_permissions never touches additional_branches, so we sync those
// separately via add_/remove_user_branch_access.
export async function updateUser(userId: string, input: UpdateUserInput): Promise<void> {
  const isAdmin = /admin/i.test(input.systemRole)
  const branchIds = [input.primaryBranchId, ...input.additionalBranchIds.filter((b) => b !== input.primaryBranchId)]
  const { data, error } = await supabase.rpc('update_user_permissions', {
    p_user_id: userId,
    p_email: input.email,
    p_full_name: input.fullName,
    p_username: input.email,
    p_system_role: input.systemRole,
    p_phone: input.phone,
    p_branch_ids: branchIds,
    p_default_branch_id: input.primaryBranchId,
    p_is_active: input.isActive,
    // Always send the full selection (even an empty array) so clearing agent
    // types actually persists. The RPC COALESCEs a NULL back to the old value,
    // which previously made "unassign all" silently keep the old types.
    p_agent_types: input.agentTypeNames,
    p_agent_type_single: roleToAgentType(input.systemRole),
    p_has_admin_role: isAdmin,
    p_job_title: input.systemRole,
  })
  if (error) throw new Error(error.message)
  checkRes(data)

  // sync additional branches (exclude the primary)
  const desired = new Set(input.additionalBranchIds.filter((b) => b !== input.primaryBranchId))
  const original = new Set(input.originalAdditionalBranchIds.filter((b) => b !== input.primaryBranchId))
  const toAdd = [...desired].filter((b) => !original.has(b))
  const toRemove = [...original].filter((b) => !desired.has(b))
  await Promise.all([
    ...toAdd.map((b) => supabase.rpc('add_user_branch_access', { p_user_id: userId, p_branch_id: b })),
    ...toRemove.map((b) => supabase.rpc('remove_user_branch_access', { p_user_id: userId, p_branch_id: b })),
  ]).then((results) => {
    const failed = results.find((r) => r.error)
    if (failed?.error) throw new Error(failed.error.message)
  })
}

// ---------- Claim details ----------

export interface ClaimDetail {
  claim_id: string
  claim_no: string | null
  dr_number: string | null
  ro_number: string | null
  status: string | null
  category: string | null
  relationship: string | null
  job_type: string | null
  vehicle_information: {
    vin: string | null
    make: string | null
    model: string | null
    year: string | number | null
    license_plate: string | null
    color: string | null
    mileage: string | null
    mm_code: string | null
    warranty: boolean | string | null
  } | null
  customer_information: {
    name: string | null
    first_name: string | null
    last_name: string | null
    salutation: string | null
    email: string | null
    phone: string | null
    mobile: string | null
    address: string | null
    id_number: string | null
    preferred_contact: string | null
  } | null
  insurance_details: {
    company_name: string | null
    policy_no: string | null
    insurer_claim_no: string | null
    broker_name: string | null
    claim_date: string | null
    incident_date: string | null
    incident_description: string | null
    excess_amount: number | null
  } | null
  job_information: {
    damage_description: string | null
    severity_level: string | null
    repair_type: string | null
    towing_company_name: string | null
    estimated_labour_hours: string | number | null
  } | null
  job_details: { branch: string | null; branch_location: string | null; current_department: string | null } | null
  assigned_staff: {
    estimator: { name: string | null } | null
    csa: { name: string | null } | null
    parts_buyer: { name: string | null } | null
  } | null
  summary: { created_value: string | null; estimated_cost_value: number | null } | null
  priority?: boolean | null
  financial?: {
    estimated_amount: number | null
    approved_amount: number | null
    quote_value: number | null
    approved_value: number | null
    invoice_value: number | null
    excess_amount: number | null
  } | null
  timeline?: {
    claim_date: string | null
    incident_date: string | null
    date_claim_received: string | null
    date_booked: string | null
    authorization_date: string | null
    start_date: string | null
    target_date: string | null
    expected_finish_date: string | null
    expected_collection_date: string | null
    completion_date: string | null
    delivery_date: string | null
    days_in_workshop: number | null
  } | null
  repair_progress?: { overall_progress: number | null; current_stage: string | null } | null
  additional_info?: { speed_shop: string | null; vip_client: boolean | null; relationship: string | null } | null
}

// Records that a user opened a claim (audit trail). The RPC self-throttles to one
// log per user/claim every 5 minutes, so it's safe to call on every open.
export async function logUserAccess(claimId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('log_user_access', { p_claim_id: claimId, p_user_id: userId })
  if (error) throw new Error(error.message)
}

export async function getClaimDetails(claimId: string, userId: string): Promise<ClaimDetail> {
  const { data, error } = await supabase.rpc('get_claim_details', {
    p_claim_id: claimId,
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
  const res = data as (ClaimDetail & { error?: string; message?: string }) | null
  if (!res || res.error) throw new Error(res?.message || res?.error || 'Failed to load claim')
  return res
}

// Toggle the Speed Job (speed_indicator) flag on a claim.
export async function updateSpeedJob(claimId: string, on: boolean): Promise<void> {
  const { data, error } = await supabase.rpc('update_speedjob', { p_claim_id: claimId, p_speed_indicator: on })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to update Speed Job')
}

export interface SpeedJobSla { enabled: boolean; startedAt: string | null }
// Reads the Speed Job flag + the timestamp it was switched on (drives the 5-day SLA).
export async function getSpeedJobSla(claimId: string): Promise<SpeedJobSla> {
  const { data, error } = await supabase.rpc('get_speed_job_sla', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as { speed_indicator?: boolean; started_at?: string | null }
  return { enabled: !!r.speed_indicator, startedAt: r.started_at ?? null }
}

// Toggle the Targeted Priority (priority) flag on a claim.
export async function updatePriority(claimId: string, on: boolean): Promise<void> {
  const { data, error } = await supabase.rpc('update_priority', { p_claim_id: claimId, p_priority: on })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to update Priority')
}

// ---------- Claim Overview: dedicated per-claim endpoints ----------

type KeyDateEntry = { date: string | null; label: string; status: string }

export interface ClaimKeyDates {
  currentStatus: string | null
  daysInCurrentStatus: number | null
  totalDaysActive: number | null
  keyDates: {
    booked_date?: KeyDateEntry
    intake_date?: KeyDateEntry
    conversion_date?: KeyDateEntry
    actual_completion?: KeyDateEntry
    promised_delivery?: KeyDateEntry
    authorization_date?: KeyDateEntry
    expected_collection?: KeyDateEntry
  }
}

export async function getClaimKeyDates(claimId: string): Promise<ClaimKeyDates | null> {
  const { data, error } = await supabase.rpc('get_claim_key_dates_and_status_duration', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const res = data as {
    success?: boolean
    current_status?: string | null
    key_dates?: ClaimKeyDates['keyDates']
    duration_metrics?: { total_days_active?: number | null; days_in_current_status?: number | null }
  } | null
  if (!res || res.success === false) return null
  return {
    currentStatus: res.current_status ?? null,
    daysInCurrentStatus: res.duration_metrics?.days_in_current_status ?? null,
    totalDaysActive: res.duration_metrics?.total_days_active ?? null,
    keyDates: res.key_dates ?? {},
  }
}

export interface ClaimQuoteSummary {
  original: number | null
  approved: number | null
  total: number | null
  status: string | null
}

export async function getClaimQuoteSummary(claimId: string, userId: string): Promise<ClaimQuoteSummary | null> {
  const { data, error } = await supabase.rpc('get_quotes_by_claim', { p_claim_id: claimId, p_user_id: userId })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; quotes?: Array<Record<string, number | string | null>> } | null
  if (!res || res.success === false || !res.quotes || res.quotes.length === 0) return null
  const q = res.quotes[0] // most recent (ordered by created_at DESC)
  return {
    original: (q.original_quote as number) ?? null,
    approved: (q.approved_quote as number) ?? null,
    total: (q.total_cost as number) ?? null,
    status: (q.quote_status as string) ?? null,
  }
}

export interface ClaimIssue {
  id: string
  issueType: string | null
  severity: string | null
  title: string | null
  status: string | null
  subStatus: string | null
  isResolved: boolean
  reportedByName: string | null
  assignedToName: string | null
  resolvedByName: string | null
  resolutionNotes: string | null
  resolvedAt: string | null
  createdAt: string | null
}

export const ISSUE_SEVERITIES = ['Critical', 'High', 'Medium', 'Low']
export const ISSUE_TYPES = ['Production', 'Sales', 'Quality', 'Parts', 'Finance', 'Other']

export async function getClaimIssues(claimId: string): Promise<ClaimIssue[]> {
  const { data, error } = await supabase.rpc('manage_claim_issues', { p_action: 'list', p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; issues?: Array<Record<string, unknown>> } | null
  if (!res || res.success === false || !res.issues) return []
  return res.issues.map((i) => ({
    id: String(i.id),
    issueType: (i.issue_type as string) ?? null,
    severity: (i.severity as string) ?? null,
    title: (i.title as string) ?? null,
    status: (i.status as string) ?? null,
    subStatus: (i.sub_status as string) ?? null,
    isResolved: i.is_resolved === true,
    reportedByName: (i.reported_by_name as string) ?? null,
    assignedToName: (i.assigned_to_name as string) ?? null,
    resolvedByName: (i.resolved_by_name as string) ?? null,
    resolutionNotes: (i.resolution_notes as string) ?? null,
    resolvedAt: (i.resolved_at as string) ?? null,
    createdAt: (i.created_at as string) ?? null,
  }))
}

export interface ClaimIssueInput {
  title: string
  severity: string
  issueType: string
  description?: string | null
}

export async function createClaimIssue(claimId: string, input: ClaimIssueInput): Promise<void> {
  const { data, error } = await supabase.rpc('manage_claim_issues', {
    p_action: 'add',
    p_claim_id: claimId,
    p_issue_data: {
      title: input.title,
      severity: input.severity.toLowerCase(),
      issue_type: input.issueType,
      description: input.description?.trim() || null,
    },
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to log issue')
}

export async function resolveClaimIssue(claimId: string, issueId: string, notes: string): Promise<void> {
  const { data, error } = await supabase.rpc('manage_claim_issues', {
    p_action: 'resolve',
    p_claim_id: claimId,
    p_issue_id: issueId,
    p_issue_data: { resolution_notes: notes || null },
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to resolve issue')
}

export async function deleteClaimIssue(claimId: string, issueId: string): Promise<void> {
  const { data, error } = await supabase.rpc('manage_claim_issues', { p_action: 'delete', p_claim_id: claimId, p_issue_id: issueId })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to delete issue')
}

export interface ClaimProgress {
  percentage: number
  currentMilestone: string | null
  isCompleted: boolean
}

export async function getClaimProgress(claimId: string): Promise<ClaimProgress | null> {
  const { data, error } = await supabase.rpc('get_claim_progress', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const res = data as {
    success?: boolean
    progress_percentage?: number | null
    current_milestone_name?: string | null
    is_completed?: boolean
  } | null
  if (!res || res.success === false) return null
  return {
    percentage: Math.max(0, Math.min(100, Number(res.progress_percentage ?? 0))),
    currentMilestone: res.current_milestone_name ?? null,
    isCompleted: res.is_completed === true,
  }
}

// ---------- Dropdown option sources ----------

export async function getVehicleMakes(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_vehicle_makes')
  if (error) throw new Error(error.message)
  return ((data as Array<{ make: string }>) ?? []).map((r) => r.make).filter(Boolean)
}

export async function getVehicleModels(make: string): Promise<string[]> {
  if (!make.trim()) return []
  const { data, error } = await supabase.rpc('get_vehicle_models', { p_make: make })
  if (error) throw new Error(error.message)
  return ((data as Array<{ model: string }>) ?? []).map((r) => r.model).filter(Boolean)
}

export interface Insurer { id: string; name: string }
export async function getInsurers(): Promise<Insurer[]> {
  const { data, error } = await supabase.rpc('get_insurers_only')
  if (error) throw new Error(error.message)
  return ((data as Array<{ id: string; insurer_name: string }>) ?? [])
    .map((r) => ({ id: r.id, name: r.insurer_name }))
    .filter((r) => r.name)
}

export interface Broker { id: string; legacyId: number | null; name: string }
export async function getBrokersByInsurance(insurerId: string): Promise<Broker[]> {
  if (!insurerId) return []
  const { data, error } = await supabase.rpc('get_brokers_by_insurance', { p_insurance_id: insurerId })
  if (error) throw new Error(error.message)
  return ((data as Array<{ id: string; legacy_id: number | null; broker_name: string }>) ?? [])
    .map((r) => ({ id: r.id, legacyId: r.legacy_id ?? null, name: r.broker_name }))
    .filter((r) => r.name)
}

export async function updateClaimInsuranceDetails(
  claimId: string,
  userId: string,
  ins: { insuranceCompanyId?: string; brokerId?: number | null; brokerName?: string; policyNo?: string; insurerClaimNo?: string; claimsAdmin?: string },
): Promise<void> {
  const { data, error } = await supabase.rpc('update_claim_insurance_details', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_insurance_company_id: ins.insuranceCompanyId ?? '',
    p_broker_id: ins.brokerId != null ? String(ins.brokerId) : '',
    p_broker_name: ins.brokerName ?? '',
    p_policy_no: ins.policyNo ?? '',
    p_insurer_claim_no: ins.insurerClaimNo ?? '',
    p_insurer_agent: ins.claimsAdmin ?? '',
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (res && res.success === false) throw new Error(res.error || 'Failed to save insurance details')
}

// ---------- Financial Data (TMS) ----------

export interface FinancialData {
  drNo: number | null
  // editable
  originalQuote: number | null
  originalParts: number | null
  approvedQuote: number | null
  approvedParts: number | null
  additionalQuote: number | null
  additionalParts: number | null
  precosting: number | null
  jobFinalCosting: number | null
  partsFinalCosting: number | null
  finalComments: string
  // read-only (from TMS)
  currentJobValue: number | null
  currentPartsValue: number | null
  creditorsPartsCost: number | null
  projectedCos: number | null
  actualCos: number | null
  insuredValue: number | null
  retail: number | null
  trade: number | null
  jobInvoicedValue: number | null
  partsInvoicedValue: number | null
  excessAmount: number | null
  costingSent: boolean
  costingReceived: boolean
  invoiceSent: boolean
  invoiceConfirmed: boolean
}

export async function getTmsFinancialData(claimId: string, drNo: number, branchId: string | null): Promise<FinancialData | null> {
  const { data, error } = await supabase.functions.invoke('get-tms-financial-data', {
    body: { claimId, drNo, branchId: branchId ?? undefined },
  })
  if (error) throw new Error(error.message)
  const r = data as {
    error?: boolean
    conversions_quoting?: Record<string, number | null>
    vehicle_evaluation?: Record<string, number | null>
    final_costing?: Record<string, unknown>
    invoicing?: Record<string, number | null>
    distributionTracking?: Record<string, unknown>
    drNo?: number
  } | null
  if (!r || r.error) return null
  const cq = r.conversions_quoting ?? {}
  const ve = r.vehicle_evaluation ?? {}
  const fc = r.final_costing ?? {}
  const iv = r.invoicing ?? {}
  const dt = r.distributionTracking ?? {}
  return {
    drNo: r.drNo ?? drNo,
    originalQuote: cq.originalQuote ?? null,
    originalParts: cq.originalParts ?? null,
    approvedQuote: cq.approvedQuote ?? null,
    approvedParts: cq.approvedParts ?? null,
    additionalQuote: cq.additionalQuote ?? null,
    additionalParts: cq.additionalParts ?? null,
    precosting: cq.preCosting_projectedPartsCost ?? null,
    projectedCos: cq.projectedCOS_percentage ?? null,
    creditorsPartsCost: cq.creditorsPartsCost ?? null,
    actualCos: cq.actualCOS_percentage ?? null,
    currentJobValue: cq.currentJobValue ?? null,
    currentPartsValue: cq.currentPartsValue ?? null,
    insuredValue: ve.insuredValue ?? null,
    retail: ve.retail ?? null,
    trade: ve.trade ?? null,
    jobFinalCosting: (fc.jobFinalCosting_latestValue as number) ?? null,
    partsFinalCosting: (fc.partsFinalCosting_latestValue as number) ?? null,
    finalComments: (fc.finalComments as string) ?? '',
    costingSent: fc.costingSent === true,
    costingReceived: fc.costingReceived === true,
    jobInvoicedValue: iv.jobInvoicedValue_inclExcess ?? null,
    partsInvoicedValue: iv.partsInvoicedValue ?? null,
    excessAmount: iv.excessAmount ?? null,
    invoiceSent: dt.eie_ID != null && dt.eie_ID !== '' && dt.eie_ID !== false,
    invoiceConfirmed: dt.invoice_Confirmed === true || dt.invoice_Confirmed === 'true',
  }
}

export interface FinancialUpdate {
  originalQuote?: string
  originalParts?: string
  approvedQuote?: string
  approvedParts?: string
  additionalQuote?: string
  additionalParts?: string
  precosting?: string
  jobFinalCosting?: string
  partsFinalCosting?: string
  finalComments?: string
}

export async function updateFinancialData(claimId: string, drNo: number, userId: string, d: FinancialUpdate): Promise<void> {
  const num = (s?: string) => {
    if (s == null || s.trim() === '') return null
    const v = Number(s.replace(/[^\d.-]/g, ''))
    return isNaN(v) ? null : v
  }
  const { data, error } = await supabase.rpc('update_precosting_projected_parts_cost', {
    p_claim_id: claimId,
    p_dr_no: drNo,
    p_user_id: userId,
    p_precosting_value: num(d.precosting),
    p_job_final_costing_latest: num(d.jobFinalCosting),
    p_parts_final_costing_latest: num(d.partsFinalCosting),
    p_final_comments: d.finalComments ?? null,
    p_original_quote: num(d.originalQuote),
    p_original_parts: num(d.originalParts),
    p_approved_quote: num(d.approvedQuote),
    p_approved_parts: num(d.approvedParts),
    p_additional_quote: num(d.additionalQuote),
    p_additional_parts: num(d.additionalParts),
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to save financial data')
}

// ---------- TMS Parts Order ----------

export interface TmsPart {
  lineNo: number | null
  operation: string | null
  description: string | null
  qty: number | null
  partNo: string | null
  extras: boolean
  suppliedByInsurer: boolean
  salePrice: number | null
  cost: number | null
  orderQty: number | null
  orderDate: string | null
  supplierCode: string | null
  backOrder: boolean
  backOrderExpected: string | null
  rfcDone: boolean
  receivedQty: number | null
  receivedDate: string | null
  invoiceNo: string | null
  supplierInvoiceNo: string | null
  outSourced: boolean
  colourCategory: string | null
  orderStatus: string | null
}

export interface TmsPartsSummary {
  totalParts: number
  drRoParts: number
  extrasParts: number
  ordered: number
  received: number
  backOrdered: number
  notOrdered: number
  rfcCount: number
  psiCount: number
  totalSaleValue: number
  totalCostValue: number
}

export interface TmsPartsData {
  shopSerial: number | null
  drNo: number | null
  parts: TmsPart[]
  summary: TmsPartsSummary
}

export async function getTmsParts(drNo: number, branchId: string | null): Promise<TmsPartsData> {
  const url = `${SUPABASE_URL}/functions/v1/get-tms-parts?drNo=${drNo}&branchId=${branchId ?? ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || (body && body.error)) {
    if (res.status === 404) {
      return { shopSerial: null, drNo, parts: [], summary: emptyPartsSummary() }
    }
    const msg = body?.details ? tryParseMsg(body.details) : (body?.message || `Request failed (${res.status})`)
    throw new Error(msg)
  }
  const r = body as { shopSerial?: number; drNo?: number; parts?: Record<string, unknown>[]; summary?: Record<string, number> }
  const parts = (r.parts ?? []).map((p) => ({
    lineNo: (p.lineNo as number) ?? null,
    operation: (p.operation as string) ?? null,
    description: (p.description as string) ?? null,
    qty: (p.qty as number) ?? null,
    partNo: (p.partNo as string) ?? null,
    extras: p.extras === true,
    suppliedByInsurer: p.suppliedByInsurer === true,
    salePrice: (p.salePrice as number) ?? null,
    cost: (p.cost as number) ?? null,
    orderQty: (p.orderQty as number) ?? null,
    orderDate: (p.orderDate as string) ?? null,
    supplierCode: (p.supplierCode as string) ?? null,
    backOrder: p.backOrder === true,
    backOrderExpected: (p.backOrderExpected as string) ?? null,
    rfcDone: p.rfcDone === true,
    receivedQty: (p.receivedQty as number) ?? null,
    receivedDate: (p.receivedDate as string) ?? null,
    invoiceNo: (p.invoiceNo as string) ?? null,
    supplierInvoiceNo: (p.supplierInvoiceNo as string) ?? null,
    outSourced: p.outSourced === true,
    colourCategory: (p.colourCategory as string) ?? null,
    orderStatus: (p.orderStatus as string) ?? null,
  }))
  const s = r.summary ?? {}
  return {
    shopSerial: r.shopSerial ?? null,
    drNo: r.drNo ?? drNo,
    parts,
    summary: {
      totalParts: s.totalParts ?? parts.length,
      drRoParts: s.drRoParts ?? 0,
      extrasParts: s.extrasParts ?? 0,
      ordered: s.ordered ?? 0,
      received: s.received ?? 0,
      backOrdered: s.backOrdered ?? 0,
      notOrdered: s.notOrdered ?? 0,
      rfcCount: s.rfcCount ?? 0,
      psiCount: s.psiCount ?? 0,
      totalSaleValue: s.totalSaleValue ?? 0,
      totalCostValue: s.totalCostValue ?? 0,
    },
  }
}

function emptyPartsSummary(): TmsPartsSummary {
  return { totalParts: 0, drRoParts: 0, extrasParts: 0, ordered: 0, received: 0, backOrdered: 0, notOrdered: 0, rfcCount: 0, psiCount: 0, totalSaleValue: 0, totalCostValue: 0 }
}

function tryParseMsg(details: string): string {
  try { return JSON.parse(details).message ?? details } catch { return details }
}

// ---------- TMS Quote ----------

export interface QuoteLineItem {
  no: number | null
  oper: string | null
  description: string | null
  percent: number | null
  parts: number | null
  saleParts: number | null
  labour: number | null
  paint: number | null
  stripAssm: number | null
  frame: number | null
  miscOutwork: number | null
}

export interface TmsQuote {
  shopSerial: number | null
  drNo: number | null
  roNo: string | null
  quoteTotal: number | null
  approvedQuoteExclVat: number | null
  saleAmtExclVat: number | null
  approvedParts: number | null
  partCost: number | null
  partsInvoiced: number | null
  extrasTotal: number | null
  lineItems: QuoteLineItem[]
  // selected read-only financials
  quoteValue: number | null
  partsValue: number | null
  approvedValue: number | null
  partsAppValue: number | null
  extrasValue: number | null
  precosting: number | null
  projectedCosPercent: number | null
  actualCosPercent: number | null
  invoiceValue: number | null
  excessAmount: number | null
}

export async function getTmsQuote(drNo: number, branchId: string | null): Promise<TmsQuote> {
  const url = `${SUPABASE_URL}/functions/v1/get-tms-parts-data?drNo=${drNo}&branchId=${branchId ?? ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || (body && body.error)) {
    if (res.status === 404) return emptyQuote(drNo)
    const msg = body?.details ? tryParseMsg(body.details) : (body?.message || `Request failed (${res.status})`)
    throw new Error(msg)
  }
  const r = body as Record<string, unknown>
  const fin = (r.financial ?? {}) as Record<string, Record<string, unknown>>
  const qv = fin.quotingValues ?? {}
  const pc = fin.preCostingValues ?? {}
  const iv = fin.invoicingValues ?? {}
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
  const lineItems = ((r.lineItems as Record<string, unknown>[]) ?? []).map((l) => ({
    no: num(l.no),
    oper: (l.oper as string) ?? null,
    description: (l.description as string) ?? null,
    percent: num(l.percent),
    parts: num(l.parts),
    saleParts: num(l.saleParts),
    labour: num(l.labour),
    paint: num(l.paint),
    stripAssm: num(l.stripAssm),
    frame: num(l.frame),
    miscOutwork: num(l.miscOutwork),
  }))
  return {
    shopSerial: num(r.shopSerial),
    drNo: num(r.drNo) ?? drNo,
    roNo: (r.roNo as string) ?? null,
    quoteTotal: num(r.quoteTotal),
    approvedQuoteExclVat: num(r.approvedQuoteExclVat),
    saleAmtExclVat: num(r.saleAmtExclVat),
    approvedParts: num(r.approvedParts),
    partCost: num(r.partCost),
    partsInvoiced: num(r.partsInvoiced),
    extrasTotal: num(r.extrasTotal),
    lineItems,
    quoteValue: num(qv.quoteValue),
    partsValue: num(qv.partsValue),
    approvedValue: num(qv.approvedValue),
    partsAppValue: num(qv.parts_appValue),
    extrasValue: num(qv.extrasValue),
    precosting: num(pc.precosting),
    projectedCosPercent: num(pc.projectedCosPercent),
    actualCosPercent: num(pc.actualCosPercent),
    invoiceValue: num(iv.invoiceValue),
    excessAmount: num(iv.excessAmount),
  }
}

function emptyQuote(drNo: number): TmsQuote {
  return {
    shopSerial: null, drNo, roNo: null, quoteTotal: null, approvedQuoteExclVat: null, saleAmtExclVat: null,
    approvedParts: null, partCost: null, partsInvoiced: null, extrasTotal: null, lineItems: [],
    quoteValue: null, partsValue: null, approvedValue: null, partsAppValue: null, extrasValue: null,
    precosting: null, projectedCosPercent: null, actualCosPercent: null, invoiceValue: null, excessAmount: null,
  }
}

// ---------- TMS Totals ----------

export interface MoneyHours { hours: number; money: number }
export interface TmsTotalsSection {
  parts: number
  labour: MoneyHours
  paint: MoneyHours
  stripAssm: MoneyHours
  frame: MoneyHours
  miscOutwork: number
  shopSupplies: number
  paintSupplies: number
  subtotal: number
}
export interface TmsTotals {
  shopSerial: number | null
  drNo: number | null
  roNo: string | null
  hourlyRates: { labourRate: number; paintRate: number; stripAssmRate: number; frameRate: number }
  drRo: TmsTotalsSection
  extras: TmsTotalsSection
  combined: TmsTotalsSection
  combinedSubtotal: number
  lessDiscounts: number
  afterDiscount: number
  taxRate: number
  vatAmount: number
  totalIncVat: number
  empty: boolean
}

function mhOf(v: unknown): MoneyHours {
  const o = (v ?? {}) as Record<string, unknown>
  return { hours: typeof o.hours === 'number' ? o.hours : 0, money: typeof o.money === 'number' ? o.money : 0 }
}
function sectionOf(v: unknown): TmsTotalsSection {
  const o = (v ?? {}) as Record<string, unknown>
  const n = (x: unknown) => (typeof x === 'number' ? x : 0)
  return {
    parts: n(o.parts),
    labour: mhOf(o.labour),
    paint: mhOf(o.paint),
    stripAssm: mhOf(o.stripAssm),
    frame: mhOf(o.frame),
    miscOutwork: n(o.miscOutwork),
    shopSupplies: n(o.shopSupplies),
    paintSupplies: n(o.paintSupplies),
    subtotal: n(o.subtotal),
  }
}

export async function getTmsTotals(drNo: number, branchId: string | null): Promise<TmsTotals> {
  const url = `${SUPABASE_URL}/functions/v1/get-tms-totals?drNo=${drNo}&branchId=${branchId ?? ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || (body && body.error)) {
    if (res.status === 404) return emptyTotals(drNo)
    const msg = body?.details ? tryParseMsg(body.details) : (body?.message || `Request failed (${res.status})`)
    throw new Error(msg)
  }
  const r = body as Record<string, unknown>
  const tt = (r.tmsTotals ?? {}) as Record<string, unknown>
  const hr = (r.hourlyRates ?? {}) as Record<string, unknown>
  const tot = (r.totals ?? {}) as Record<string, unknown>
  const n = (x: unknown) => (typeof x === 'number' ? x : 0)
  return {
    shopSerial: typeof r.shopSerial === 'number' ? r.shopSerial : null,
    drNo: typeof r.drNo === 'number' ? r.drNo : drNo,
    roNo: (r.roNo as string) ?? null,
    hourlyRates: {
      labourRate: n(hr.labourRate), paintRate: n(hr.paintRate),
      stripAssmRate: n(hr.stripAssmRate), frameRate: n(hr.frameRate),
    },
    drRo: sectionOf(tt.drRo),
    extras: sectionOf(tt.extras),
    combined: sectionOf(tt.combined),
    combinedSubtotal: n(tot.combinedSubtotal),
    lessDiscounts: n(tot.lessDiscounts),
    afterDiscount: n(tot.afterDiscount),
    taxRate: n(tot.taxRate),
    vatAmount: n(tot.vatAmount),
    totalIncVat: n(tot.totalIncVat),
    empty: false,
  }
}

// ---------- TMS Job Card ----------

export interface JobCardLine {
  lineNo: number | null
  operation: string | null
  description: string | null
  qty: number | null
  partNo: string | null
  partPrice: number | null
  labourHrs: number | null
  labourMoney: number | null
  paintHrs: number | null
  paintMoney: number | null
  stripAssmHrs: number | null
  stripAssmMoney: number | null
  frameHrs: number | null
  frameMoney: number | null
  misc: number | null
  outworkCost: number | null
  extras: boolean
  suppliedByInsurer: boolean
  flags: JobCardFlags
}

export interface JobCardFlags {
  parts: boolean
  repNewPart: boolean
  labour: boolean
  paint: boolean
  stripAssm: boolean
  frame: boolean
  misc: boolean
}

export interface TmsJobCard {
  shopSerial: number | null
  drNo: number | null
  lineItems: JobCardLine[]
  totalLines: number
  drRoLines: number
  extrasLines: number
  operationBreakdown: { op: string; count: number }[]
}

function flagsOf(v: unknown): JobCardFlags {
  const o = (v ?? {}) as Record<string, unknown>
  return {
    parts: o.parts === true,
    repNewPart: o.repNewPart === true,
    labour: o.labour === true,
    paint: o.paint === true,
    stripAssm: o.stripAssm === true,
    frame: o.frame === true,
    misc: o.misc === true,
  }
}

export async function getTmsJobCard(drNo: number, branchId: string | null): Promise<TmsJobCard> {
  const url = `${SUPABASE_URL}/functions/v1/get-tms-jobcard-data?drNo=${drNo}&branchId=${branchId ?? ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || (body && body.error)) {
    if (res.status === 404) return { shopSerial: null, drNo, lineItems: [], totalLines: 0, drRoLines: 0, extrasLines: 0, operationBreakdown: [] }
    const msg = body?.details ? tryParseMsg(body.details) : (body?.message || `Request failed (${res.status})`)
    throw new Error(msg)
  }
  const r = body as Record<string, unknown>
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
  const n0 = (v: unknown): number => (typeof v === 'number' ? v : 0)
  const lineItems = ((r.lineItems as Record<string, unknown>[]) ?? []).map((l) => ({
    lineNo: num(l.lineNo),
    operation: (l.operation as string) ?? null,
    description: (l.description as string) ?? null,
    qty: num(l.qty),
    partNo: (l.partNo as string) ?? null,
    partPrice: num(l.partPrice),
    labourHrs: num(l.labourHrs),
    labourMoney: num(l.labourMoney),
    paintHrs: num(l.paintHrs),
    paintMoney: num(l.paintMoney),
    stripAssmHrs: num(l.stripAssmHrs),
    stripAssmMoney: num(l.stripAssmMoney),
    frameHrs: num(l.frameHrs),
    frameMoney: num(l.frameMoney),
    misc: num(l.misc),
    outworkCost: num(l.outworkCost),
    extras: l.extras === true,
    suppliedByInsurer: l.suppliedByInsurer === true,
    flags: flagsOf(l.flags),
  }))
  const sum = (r.summary ?? {}) as Record<string, unknown>
  const ob = (sum.operationBreakdown ?? {}) as Record<string, number>
  return {
    shopSerial: num(r.shopSerial),
    drNo: num(r.drNo) ?? drNo,
    lineItems,
    totalLines: n0(sum.totalLines) || lineItems.length,
    drRoLines: n0(sum.drRoLines),
    extrasLines: n0(sum.extrasLines),
    operationBreakdown: Object.entries(ob).map(([op, count]) => ({ op, count })).sort((a, b) => b.count - a.count),
  }
}

// ---------- TMS Uploads ----------

export interface TmsUploadFile {
  name: string
  url: string
  category: string
}

export interface TmsUploads {
  drNo: string | null
  files: TmsUploadFile[]
  count: number
}

export async function getTmsUploads(drNo: number, branchId: string | null): Promise<TmsUploads> {
  const url = `${SUPABASE_URL}/functions/v1/get-tms-orders?drNo=${drNo}&branchId=${branchId ?? ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || (body && body.error)) {
    if (res.status === 404) return { drNo: String(drNo), files: [], count: 0 }
    const msg = body?.details ? tryParseMsg(body.details) : (body?.message || `Request failed (${res.status})`)
    throw new Error(msg)
  }
  const r = body as { drNo?: string; files?: Record<string, unknown>[]; count?: number }
  const files = (r.files ?? []).map((f) => ({
    name: (f.name as string) ?? 'Document',
    url: (f.url as string) ?? '',
    category: (f.imageDescription as string) ?? 'General',
  }))
  return { drNo: r.drNo ?? String(drNo), files, count: r.count ?? files.length }
}

function emptyTotals(drNo: number): TmsTotals {
  const z = (): TmsTotalsSection => sectionOf({})
  return {
    shopSerial: null, drNo, roNo: null,
    hourlyRates: { labourRate: 0, paintRate: 0, stripAssmRate: 0, frameRate: 0 },
    drRo: z(), extras: z(), combined: z(),
    combinedSubtotal: 0, lessDiscounts: 0, afterDiscount: 0, taxRate: 0, vatAmount: 0, totalIncVat: 0,
    empty: true,
  }
}

// ---------- Global search ----------

export interface SearchResult {
  claimId: string
  drNumber: string | null
  roNumber: string | null
  customer: string | null
  registration: string | null
  status: string | null
  manufacturer: string | null
  insurer: string | null
  csaName: string | null
  category: string | null
  jobType: string | null
  contact: string | null
  aging: number | null
  dip: number | null
  approvedValue: number | null
  speedShop: string | null
  towDrive: string | null
  matchedField: string | null
  matchedValue: string | null
}

function mapSearchRow(r: Record<string, unknown>): SearchResult {
  return {
    claimId: String(r.claim_id),
    drNumber: (r.dr_number as string) ?? null,
    roNumber: (r.ro_number as string) ?? null,
    customer: (r.customer as string) ?? null,
    registration: (r.registration as string) ?? null,
    status: (r.claim_status as string) ?? null,
    manufacturer: (r.manufacturer as string) ?? null,
    insurer: (r.insurer as string) ?? null,
    csaName: (r.csa_name as string) ?? null,
    category: (r.category as string) ?? null,
    jobType: (r.job_type as string) ?? null,
    contact: (r.contact as string) ?? null,
    aging: (r.aging as number) ?? null,
    dip: (r.dip as number) ?? null,
    approvedValue: (r.approved_value as number) ?? null,
    speedShop: (r.speed_shop as string) ?? null,
    towDrive: (r.tow_drive as string) ?? null,
    matchedField: (r.matched_field as string) ?? null,
    matchedValue: (r.matched_value as string) ?? null,
  }
}

export async function globalSearchPredictive(term: string, branchId: string | null, limit = 12): Promise<SearchResult[]> {
  if (!term.trim()) return []
  const { data, error } = await supabase.rpc('global_search_predictive', {
    search_term: term, p_category: null, p_limit: limit, p_branch_id: branchId ?? null, p_min_similarity: 0.2,
  })
  if (error) throw new Error(error.message)
  return ((data as Array<Record<string, unknown>>) ?? []).map(mapSearchRow)
}

export async function globalSearch(term: string, branchId: string | null, limit = 50, offset = 0): Promise<SearchResult[]> {
  if (!term.trim()) return []
  const { data, error } = await supabase.rpc('global_search', {
    search_term: term, p_category: null, p_limit: limit, p_offset: offset, p_branch_id: branchId ?? null,
  })
  if (error) throw new Error(error.message)
  return ((data as Array<Record<string, unknown>>) ?? []).map(mapSearchRow)
}

// ---------- Linked jobs ----------

export interface LinkedClaim {
  claimId: string
  claimNumber: string | null
  drNumber: string | null
  roNumber: string | null
  status: string | null
  jobType: string | null
  description: string | null
  relationship: string | null
  isMainJob: boolean
  isUpsell: boolean
  isWarranty: boolean
  createdAt: string | null
}

export async function getLinkedClaims(claimId: string): Promise<LinkedClaim[]> {
  const { data, error } = await supabase.rpc('get_linked_claims', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const arr = (data as Array<Record<string, unknown>>) ?? []
  return arr.map((r) => ({
    claimId: String(r.claim_id),
    claimNumber: (r.claim_number as string) ?? null,
    drNumber: (r.dr_number as string) ?? null,
    roNumber: (r.ro_number as string) ?? null,
    status: (r.status as string) ?? null,
    jobType: (r.job_type as string) ?? null,
    description: (r.description as string) ?? null,
    relationship: (r.relationship as string) ?? null,
    isMainJob: r.is_main_job === true,
    isUpsell: r.is_upsell === true,
    isWarranty: r.is_warranty === true,
    createdAt: (r.created_at as string) ?? null,
  }))
}

// ---------- Fuel slips ----------

export interface FuelSlip {
  id: string
  refNumber: string | null
  slipType: string | null
  recipientName: string | null
  vehicleReg: string | null
  amount: number | null
  comment: string | null
  drNumber: string | null
  issueDate: string | null
  expiryDate: string | null
  isVoided: boolean
  voidReason: string | null
  createdByName: string | null
}

function mapFuelSlip(s: Record<string, unknown>): FuelSlip {
  return {
    id: String(s.id),
    refNumber: (s.ref_number as string) ?? null,
    slipType: (s.slip_type as string) ?? null,
    recipientName: (s.recipient_name as string) ?? null,
    vehicleReg: (s.vehicle_reg as string) ?? null,
    amount: (s.amount as number) ?? null,
    comment: (s.comment as string) ?? null,
    drNumber: (s.dr_number as string) ?? null,
    issueDate: (s.issue_date as string) ?? null,
    expiryDate: (s.expiry_date as string) ?? null,
    isVoided: s.is_voided === true,
    voidReason: (s.void_reason as string) ?? null,
    createdByName: (s.created_by_name as string) ?? null,
  }
}

export async function getFuelSlips(claimId: string, includeVoided = true): Promise<FuelSlip[]> {
  const { data, error } = await supabase.rpc('get_fuel_slips', {
    p_claim_id: claimId,
    p_include_voided: includeVoided,
    p_limit: 200,
    p_offset: 0,
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string; slips?: Array<Record<string, unknown>> } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to load fuel slips')
  return (res.slips ?? []).map(mapFuelSlip)
}

export interface FuelSlipInput {
  slipType: string
  recipientName: string
  vehicleReg: string
  amount: number
  branchId: string
  comment?: string | null
  claimId?: string | null
}

export async function createFuelSlip(input: FuelSlipInput): Promise<FuelSlip> {
  const { data, error } = await supabase.rpc('create_fuel_slip', {
    p_slip_type: input.slipType,
    p_recipient_name: input.recipientName,
    p_vehicle_reg: input.vehicleReg.toUpperCase(),
    p_amount: input.amount,
    p_branch_id: input.branchId,
    p_comment: input.comment?.trim() || null,
    p_claim_id: input.claimId ?? null,
  })
  if (error) throw new Error(error.message)
  const res = data as (Record<string, unknown> & { success?: boolean; error?: string }) | null
  if (!res || res.success === false) {
    const code = res?.error || 'Failed to create fuel slip'
    const map: Record<string, string> = {
      'Access denied. Agent Type 18 required.': 'You do not have permission to create fuel slips.',
      'Amount must be greater than 0': 'Please enter a valid fuel amount.',
      'Claim not found': 'Repair not found — refresh and try again.',
      'Not authenticated': 'Please log in again.',
    }
    throw new Error(map[code] ?? code)
  }
  return mapFuelSlip(res)
}

export async function voidFuelSlip(slipId: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('void_fuel_slip', { p_slip_id: slipId, p_void_reason: reason || null })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to void fuel slip')
}

// ---------- Comments: system / journal / notes / audit / moderation ----------

export interface FeedEntry {
  id: string
  title: string
  body: string | null
  user: string | null
  date: string | null
  oldValue?: string | null
  newValue?: string | null
}

const notTomb = (u: unknown): string | null => {
  const s = (u as string) ?? null
  return s && !/former employee/i.test(s) ? s : null
}

export async function getSystemChanges(claimId: string): Promise<FeedEntry[]> {
  const { data, error } = await supabase.rpc('get_system_changes', { p_claim_id: claimId, p_limit: 100, p_offset: 0 })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; entries?: Array<Record<string, unknown>> } | null
  if (!res || res.success === false || !res.entries) return []
  return res.entries.filter((e) => {
    // Status changes belong in Journal / Audit, not System changes.
    const col = (e.metadata as { column?: string } | null)?.column ?? ''
    const type = String(e.event_type ?? '')
    const desc = String(e.description ?? '')
    return col !== 'status' && !/status[_ ]?change/i.test(type) && !/^status changed/i.test(desc)
  }).map((e, i) => ({
    id: String(e.system_entry_id ?? i),
    title: String(e.event_type ?? 'Change'),
    body: (e.description as string) ?? null,
    user: notTomb(e.changed_by),
    date: (e.change_date as string) ?? null,
    oldValue: (e.old_value as string) ?? null,
    newValue: (e.new_value as string) ?? null,
  }))
}

export async function getClaimTimeline(claimId: string): Promise<FeedEntry[]> {
  const { data, error } = await supabase.rpc('get_claim_timeline', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; timeline?: Array<Record<string, unknown>> } | null
  if (!res || res.success === false || !res.timeline) return []
  return res.timeline.map((e, i) => {
    let user: string | null = (e.user_name as string) ?? null
    const desc = (e.event_description as string) ?? null
    // Deleted users resolve to a "Former Employee" tombstone; recover the
    // original actor name captured in the description ("… by <name>").
    if (!user || /former employee/i.test(user)) {
      const m = desc?.match(/\bby\s+(.+?)\s*$/i)
      user = m ? m[1].trim() : null // hide the tombstone name if no real name is recoverable
    }
    return {
      id: String(i),
      title: String(e.event_type ?? 'Event'),
      body: desc,
      user,
      date: (e.event_date as string) ?? null,
      oldValue: (e.old_value as string) ?? null,
      newValue: (e.new_value as string) ?? null,
    }
  })
}

export async function getAuditTrail(claimId: string, userId: string): Promise<FeedEntry[]> {
  const { data, error } = await supabase.rpc('get_audit_trail', { p_claim_id: claimId, p_user_id: userId, p_limit: 100, p_offset: 0 })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; data?: Array<Record<string, unknown>> } | null
  if (!res || res.success === false || !res.data) return []
  return res.data.map((e, i) => ({
    id: String(i),
    title: String(e.event_type ?? 'Event'),
    body: (e.description as string) ?? (e.comment as string) ?? null,
    user: notTomb(e.changed_by) ?? notTomb(e.user),
    date: (e.change_date as string) ?? (e.comment_date as string) ?? null,
  }))
}

export interface ClaimNote {
  id: string
  noteType: string | null
  title: string | null
  content: string | null
  author: string | null
  date: string | null
  pinned: boolean
}

export async function getClaimNotes(claimId: string): Promise<ClaimNote[]> {
  const { data, error } = await supabase.rpc('manage_claim_notes', { p_action: 'list', p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; notes?: Array<Record<string, unknown>> } | null
  if (!res || res.success === false || !res.notes) return []
  return res.notes.map((n) => ({
    id: String(n.id),
    noteType: (n.note_type as string) ?? null,
    title: (n.title as string) ?? null,
    content: (n.content as string) ?? null,
    author: notTomb(n.created_by_name),
    date: (n.formatted_date as string) ?? (n.created_at as string) ?? null,
    pinned: n.is_pinned === true,
  }))
}

export async function addClaimNote(claimId: string, title: string, content: string, noteType = 'general'): Promise<void> {
  const { data, error } = await supabase.rpc('manage_claim_notes', {
    p_action: 'add',
    p_claim_id: claimId,
    p_note_data: { note_type: noteType, title, content },
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to add note')
}

export async function deleteClaimNote(claimId: string, noteId: string): Promise<void> {
  const { data, error } = await supabase.rpc('manage_claim_notes', { p_action: 'delete', p_claim_id: claimId, p_note_id: noteId })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to delete note')
}

// ---------- Key dates ----------

export interface ClaimEventDates {
  bookingDate: string | null
  promiseDays: number | null
  promiseDate: string | null
  dateConverted: string | null
  expectedFinishDate: string | null
  expectedCollectionDate: string | null
  // read-only
  startDate: string | null
  targetDate: string | null
  authorizationDate: string | null
  completionDate: string | null
  deliveryDate: string | null
  createdAt: string | null
  updatedAt: string | null
  createdByName: string | null
  updatedByName: string | null
  editingDisabled: boolean
  editingDisabledMessage: string | null
}

export async function getClaimEventDates(claimId: string): Promise<ClaimEventDates | null> {
  const { data, error } = await supabase.rpc('get_claim_event_dates', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; data?: Record<string, unknown>; editing_disabled?: boolean; editing_disabled_message?: string | null } | null
  if (!res || res.success === false) return null
  const d = res.data ?? {}
  const s = (k: string) => (d[k] as string) ?? null
  return {
    bookingDate: s('booking_date'),
    promiseDays: (d.promise_days as number) ?? null,
    promiseDate: s('promise_date'),
    dateConverted: s('date_converted'),
    expectedFinishDate: s('expected_finish_date'),
    expectedCollectionDate: s('expected_collection_date'),
    startDate: s('start_date'),
    targetDate: s('target_date'),
    authorizationDate: s('authorization_date'),
    completionDate: s('completion_date'),
    deliveryDate: s('delivery_date'),
    createdAt: s('created_at'),
    updatedAt: s('updated_at'),
    createdByName: s('created_by_name'),
    updatedByName: s('updated_by_name'),
    editingDisabled: res.editing_disabled === true,
    editingDisabledMessage: res.editing_disabled_message ?? null,
  }
}

export interface EventDatesUpdate {
  bookingDate?: string
  promiseDays?: string
  promiseDate?: string
  dateConverted?: string
  expectedFinishDate?: string
  expectedCollectionDate?: string
}

export async function updateClaimEventDates(claimId: string, userId: string, d: EventDatesUpdate): Promise<void> {
  const dt = (v?: string) => (v && v.trim() ? v : null)
  const num = (v?: string) => (v && v.trim() && !isNaN(Number(v)) ? Number(v) : null)
  const { data, error } = await supabase.rpc('update_claim_event_dates', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_booking_date: dt(d.bookingDate),
    p_promise_days: num(d.promiseDays),
    p_promise_date: dt(d.promiseDate),
    p_date_converted: dt(d.dateConverted),
    p_expected_finish_date: dt(d.expectedFinishDate),
    p_expected_collection_date: dt(d.expectedCollectionDate),
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to save dates')
}

// ---------- Claim files / uploads ----------

export interface ClaimFile {
  id: string
  fileUrl: string | null
  documentTitle: string | null
  category: string | null
  uploaderName: string | null
  createdAt: string | null
}

export const UPLOAD_CATEGORIES = ['Quote', 'Authorised', 'WIP', 'Finalised']

export async function getClaimFiles(claimId: string): Promise<ClaimFile[]> {
  const { data, error } = await supabase.rpc('get_claim_files', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const arr = (data as Array<Record<string, unknown>>) ?? []
  return arr.map((r) => ({
    id: String(r.id),
    fileUrl: (r.file_url as string) ?? null,
    documentTitle: (r.document_title as string) ?? null,
    category: (r.category as string) ?? null,
    uploaderName: (r.uploader_name as string) ?? null,
    createdAt: (r.created_at as string) ?? null,
  }))
}

export async function uploadClaimFile(
  claimId: string,
  file: File,
  documentTitle: string,
  category: string | null,
  userId: string,
): Promise<void> {
  const fileUrl = await uploadToBlob(file)
  const { data, error } = await supabase.rpc('upload_file', {
    p_claim_id: claimId,
    p_file_url: fileUrl,
    p_document_title: documentTitle,
    p_category: category || null,
    p_uploaded_by: userId,
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (res && res.success === false) throw new Error(res.error || 'Upload failed')
}

// ---------- Claim photos ----------

export interface ClaimPhoto {
  id: string
  fileName: string | null
  thumbUrl: string | null
  largeUrl: string | null
  originalUrl: string | null
  photoType: string | null
  description: string | null
  createdAt: string | null
}
export interface ClaimPhotosPage {
  photos: ClaimPhoto[]
  total: number
  hasMore: boolean
}

export async function getClaimPhotos(claimId: string, search: string | null, limit: number, offset: number): Promise<ClaimPhotosPage> {
  const { data, error } = await supabase.rpc('search_claim_photos', {
    p_claim_id: claimId,
    p_photo_type: null,
    p_search_term: search ?? null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw new Error(error.message)
  const res = data as {
    success?: boolean
    total_count?: number
    has_more?: boolean
    photos?: Array<{
      id: string; file_name?: string | null; photo_url?: string | null; thumbnail_url?: string | null
      photo_type?: string | null; description?: string | null
      created_at?: string | null; date_timestamp?: string | null
      urls?: { large?: string; medium?: string; original?: string }
      metadata?: { image_name?: string | null; imported_at?: string | null }
    }>
  } | null
  if (!res || res.success === false || !res.photos) return { photos: [], total: 0, hasMore: false }
  return {
    photos: res.photos.map((p) => ({
      id: String(p.id),
      fileName: p.file_name ?? p.metadata?.image_name ?? null,
      thumbUrl: p.thumbnail_url ?? p.urls?.medium ?? p.photo_url ?? null,
      largeUrl: p.urls?.large ?? p.photo_url ?? null,
      originalUrl: p.urls?.original ?? p.photo_url ?? null,
      photoType: p.photo_type ?? null,
      description: p.description ?? null,
      createdAt: p.created_at ?? p.date_timestamp ?? p.metadata?.imported_at ?? null,
    })),
    total: res.total_count ?? 0,
    hasMore: !!res.has_more,
  }
}

const STAMP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function stampText(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())} ${STAMP_MONTHS[d.getMonth()]} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function formatStamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : stampText(d)
}

// Parse the EXIF capture time (DateTimeOriginal, else DateTime) from JPEG bytes.
function exifCaptureDate(buf: ArrayBuffer): Date | null {
  try {
    const v = new DataView(buf)
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null
    let off = 2
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off)
      if (marker === 0xFFDA) break
      if ((marker & 0xFF00) !== 0xFF00) break
      const segLen = v.getUint16(off + 2)
      if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) { // "Exif"
        const tiff = off + 10
        const little = v.getUint16(tiff) === 0x4949
        const u16 = (o: number) => v.getUint16(o, little)
        const u32 = (o: number) => v.getUint32(o, little)
        const ascii = (o: number) => { let s = ''; for (let k = 0; k < 19; k++) s += String.fromCharCode(v.getUint8(o + k)); return s }
        const ifd0 = tiff + u32(tiff + 4)
        let exifPtr = 0
        let dt = ''
        const n0 = u16(ifd0)
        for (let i = 0; i < n0; i++) {
          const e = ifd0 + 2 + i * 12
          const tag = u16(e)
          if (tag === 0x8769) exifPtr = tiff + u32(e + 8)
          else if (tag === 0x0132 && !dt) dt = ascii(tiff + u32(e + 8))
        }
        let original = ''
        if (exifPtr) {
          const n1 = u16(exifPtr)
          for (let i = 0; i < n1; i++) {
            const e = exifPtr + 2 + i * 12
            if (u16(e) === 0x9003) { original = ascii(tiff + u32(e + 8)); break }
          }
        }
        const chosen = original || dt
        const m = chosen.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
        if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
        return null
      }
      off += 2 + segLen
    }
  } catch { /* ignore malformed exif */ }
  return null
}

// Fetch an image through the proxy (so the canvas isn't tainted), burn the
// timestamp onto the bottom-right, and return a JPEG blob.
async function stampImage(url: string, date: string | null | undefined): Promise<Blob> {
  const proxied = `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`
  const resp = await fetch(proxied, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
  if (!resp.ok) throw new Error('Could not fetch image')
  const buf = await resp.arrayBuffer()
  const srcBlob = new Blob([buf], { type: resp.headers.get('Content-Type') || 'image/jpeg' })
  const bmp = await createImageBitmap(srcBlob)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bmp, 0, 0)
  bmp.close()

  // Prefer the real capture time from EXIF; fall back to the record date.
  const captured = exifCaptureDate(buf)
  const text = captured ? stampText(captured) : formatStamp(date)
  if (text) {
    const fs = Math.max(16, Math.round(canvas.width * 0.026))
    const pad = Math.round(fs * 0.7)
    ctx.font = `bold ${fs}px Arial, Helvetica, sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, fs * 0.16)
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.strokeText(text, canvas.width - pad, canvas.height - pad)
    ctx.fillStyle = '#ffd400'
    ctx.fillText(text, canvas.width - pad, canvas.height - pad)
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', 0.92)
  })
}

export async function downloadPhotosZip(
  zipName: string,
  files: { url: string; name: string; date?: string | null }[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // Stamp/encode images in parallel (bounded) — far faster than one at a time.
  const CONCURRENCY = 6
  const results: (Blob | null)[] = new Array(files.length).fill(null)
  let next = 0
  let done = 0
  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= files.length) break
      try { results[i] = await stampImage(files[i].url, files[i].date) } catch { results[i] = null }
      done++
      onProgress?.(done, files.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker))

  const zip = new JSZip()
  const used = new Set<string>()
  let added = 0
  files.forEach((f, i) => {
    const blob = results[i]
    if (!blob) return
    let name = (f.name || 'photo').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() || 'photo'
    if (!/\.(jpe?g|png|webp)$/i.test(name)) name += '.jpg'
    let unique = name
    let j = 1
    while (used.has(unique.toLowerCase())) unique = name.replace(/(\.[^.]+)$/, `_${j++}$1`)
    used.add(unique.toLowerCase())
    zip.file(unique, blob)
    added++
  })
  if (added === 0) throw new Error('No photos could be downloaded')
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(zipName || 'photos').replace(/[\\/:*?"<>|]+/g, '_')}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ---------- Moderation uploads ----------

export interface ModerationUpload {
  id: string
  fileName: string | null
  fileUrl: string | null
  moderationType: string | null
  uploadedBy: string | null
  date: string | null
}

export const MODERATION_TYPES = [
  'Mod Check Quote',
  'Mod Prelim Request',
  'Mod Prelim Auth',
  'Mod Prelim Resubmit',
  'Mod Pre-Cost Request',
  'Mod Pre-cost Auth',
  'Final Costing Authorised',
  'Mod Approval',
  'Insurer First Auth',
]

export async function getModerationUploads(claimId: string): Promise<ModerationUpload[]> {
  const { data, error } = await supabase.rpc('get_moderation_uploads', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; uploads?: Array<Record<string, unknown>> } | null
  if (!res || res.success === false || !res.uploads) return []
  return res.uploads.map((r) => ({
    id: String(r.id),
    fileName: (r.file_name as string) ?? null,
    fileUrl: (r.file_url as string) ?? null,
    moderationType: (r.moderation_type as string) ?? null,
    uploadedBy: (r.uploaded_by as string) ?? null,
    date: (r.date as string) ?? null,
  }))
}

export async function uploadModerationDocument(
  claimId: string,
  userId: string,
  moderationType: string,
  file: File,
): Promise<void> {
  const fileUrl = await uploadToBlob(file)
  const { data, error } = await supabase.rpc('upload_moderation_document', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_moderation_file_type: moderationType,
    p_file_url: fileUrl,
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Upload failed')
}

// ---------- Job / Staff details ----------

export interface JobStaffDetails {
  isComeback: boolean
  towDriveIn: string | null // 'T' | 'D'
  towingCompanyId: number | null
  towingCompanyName: string | null
  storeId: number | null
  storeName: string | null
  diagnosticReff: string
  partsBuyerId: string | null
  csaId: string | null
  estimatorId: string | null
  productiveStaffId: string | null
  partsBuyerName: string | null
  csaName: string | null
  estimatorName: string | null
  productiveStaffName: string | null
  towReference: string
  notProceedingReasonId: number | null
  upsellStatus: string
  upsellComment: string
  upsellValue: number
  upsellSuggested: boolean
  hailDamageVehicle: boolean
  vehicleFromOtherBranch: boolean
  isNonCommissionableTow: boolean
}

export async function getJobStaffDetails(claimId: string, userId: string): Promise<JobStaffDetails | null> {
  const { data, error } = await supabase.rpc('get_claim_job_staff_details', { p_claim_id: claimId, p_user_id: userId })
  if (error) throw new Error(error.message)
  const r = data as Record<string, unknown> | null
  if (!r || r.error) return null
  const obj = (k: string) => (r[k] as { id?: string | null; name?: string | null } | null) ?? null
  return {
    isComeback: r.is_comeback === true,
    towDriveIn: (r.tow_drive_in as string) ?? null,
    towingCompanyId: (r.towing_company_id as number) ?? null,
    towingCompanyName: (r.towing_company_name as string) ?? null,
    storeId: (r.store_id as number) ?? null,
    storeName: (r.store_name as string) ?? null,
    diagnosticReff: (r.diagnostic_reff as string) ?? '',
    partsBuyerId: obj('parts_buyer')?.id ?? null,
    csaId: obj('csa')?.id ?? null,
    estimatorId: obj('estimator')?.id ?? null,
    productiveStaffId: obj('productive_staff')?.id ?? null,
    partsBuyerName: obj('parts_buyer')?.name ?? null,
    csaName: obj('csa')?.name ?? null,
    estimatorName: obj('estimator')?.name ?? null,
    productiveStaffName: obj('productive_staff')?.name ?? null,
    towReference: (r.tow_reference as string) ?? '',
    notProceedingReasonId: (r.not_proceeding_reason_id as number) ?? null,
    upsellStatus: (r.upsell_status as string) ?? '',
    upsellComment: (r.upsell_comment as string) ?? '',
    upsellValue: (r.upsell_value as number) ?? 0,
    upsellSuggested: r.upsell_suggested === true,
    hailDamageVehicle: r.hail_damage_vehicle === true,
    vehicleFromOtherBranch: r.vehicle_from_other_branch === true,
    isNonCommissionableTow: r.is_non_commissionable_tow === true,
  }
}

export interface JobStaffPayload {
  towingCompanyId?: string
  storeId?: string
  diagnosticReff?: string
  partsBuyerId?: string
  csaId?: string
  estimatorId?: string
  productiveStaffId?: string
  towReference?: string
  notProceedingReasonId?: string
  upsellStatus?: string
  upsellComment?: string
  upsellValue?: string
  upsellSuggested?: boolean
  hailDamageVehicle?: boolean
  vehicleFromOtherBranch?: boolean
  isNonCommissionableTow?: boolean
}

export async function updateClaimJobStaffDetails(claimId: string, userId: string, d: JobStaffPayload): Promise<void> {
  const { data, error } = await supabase.rpc('update_claim_job_staff_details', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_data: {
      towing_company_id: d.towingCompanyId ?? '',
      store_id: d.storeId ?? '',
      diagnostic_reff: d.diagnosticReff ?? '',
      parts_buyer_id: d.partsBuyerId ?? '',
      csa_id: d.csaId ?? '',
      estimator_id: d.estimatorId ?? '',
      productive_staff_id: d.productiveStaffId ?? '',
      tow_reference: d.towReference ?? '',
      not_proceeding_reason_id: d.notProceedingReasonId ?? '',
      upsell_status: d.upsellStatus ?? '',
      upsell_comment: d.upsellComment ?? '',
      upsell_value: d.upsellValue ?? '',
      upsell_suggested: d.upsellSuggested ?? false,
      hail_damage_vehicle: d.hailDamageVehicle ?? false,
      vehicle_from_other_branch: d.vehicleFromOtherBranch ?? false,
      is_non_commissionable_tow: d.isNonCommissionableTow ?? false,
    },
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to save job/staff details')
}

// Sets ONLY the not-proceeding reason on a claim. The RPC updates a field only
// when its key is present in p_data, so sending just this key leaves CSA,
// estimator, and every other job/staff field untouched.
export async function setNotProceedingReason(claimId: string, userId: string, reasonId: number | string): Promise<void> {
  const { data, error } = await supabase.rpc('update_claim_job_staff_details', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_data: { not_proceeding_reason_id: String(reasonId) },
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to save not-proceeding reason')
}

export interface IdName { id: number; name: string }
function dedupeByName(rows: Array<{ id: number; name: string | null }>): IdName[] {
  const seen = new Set<string>()
  const out: IdName[] = []
  for (const r of rows) {
    const name = (r.name ?? '').trim()
    if (!name || name.toLowerCase() === 'none' || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({ id: r.id, name })
  }
  return out
}

export async function getTowingCompanies(): Promise<IdName[]> {
  const { data, error } = await supabase.rpc('get_towing_companies')
  if (error) throw new Error(error.message)
  return dedupeByName((data as Array<{ id: number; name: string }>) ?? [])
}

export async function getStores(): Promise<IdName[]> {
  const { data, error } = await supabase.rpc('get_stores')
  if (error) throw new Error(error.message)
  return dedupeByName((data as Array<{ id: number; name: string }>) ?? [])
}

export interface NotProceedingReason { id: number; reason: string }
export async function getNotProceedingReasons(): Promise<NotProceedingReason[]> {
  const { data, error } = await supabase.rpc('get_not_proceeding_reasons')
  if (error) throw new Error(error.message)
  return ((data as Array<{ id: number; reason: string }>) ?? [])
    .map((r) => ({ id: r.id, reason: r.reason }))
    .filter((r) => r.reason)
}

export async function updateClaimDamageReport(
  claimId: string,
  userId: string,
  d: { damageDescription?: string; severityLevel?: string; repairType?: string; estimatedLabourHours?: string },
): Promise<void> {
  const { data, error } = await supabase.rpc('update_claim_damage_report', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_damage_data: {
      damage_description: d.damageDescription ?? '',
      severity_level: d.severityLevel ?? '',
      repair_type: d.repairType ?? '',
      estimated_labour_hours: d.estimatedLabourHours ?? '',
    },
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to save damage report')
}

export interface ClaimPriorityFlags {
  speedshop: boolean
  priority: boolean
  bumper: boolean
  backorder: boolean
  rental: boolean
  bag: boolean
}
export async function getClaimPriorityDetails(claimId: string): Promise<ClaimPriorityFlags | null> {
  const { data, error } = await supabase.rpc('get_claim_priority_details', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  const r = data as {
    success?: boolean
    speedshop_job?: boolean
    targeted_priority?: boolean
    bumper_repair_only?: boolean
    backorder?: boolean
    rental_car?: boolean
    bag?: boolean
  } | null
  if (!r || r.success === false) return null
  return {
    speedshop: !!r.speedshop_job,
    priority: !!r.targeted_priority,
    bumper: !!r.bumper_repair_only,
    backorder: !!r.backorder,
    rental: !!r.rental_car,
    bag: !!r.bag,
  }
}

export interface CustomerVehiclePayload {
  customer?: Record<string, unknown> | null
  vehicle?: Record<string, unknown> | null
  insurance?: Record<string, unknown> | null
  priority?: Record<string, unknown> | null
  claimDetails?: Record<string, unknown> | null
}

export async function updateCustomerVehicle(claimId: string, payload: CustomerVehiclePayload): Promise<void> {
  const { data, error } = await supabase.rpc('update_customer_vehicle', {
    p_claim_id: claimId,
    p_customer_data: payload.customer ?? null,
    p_vehicle_data: payload.vehicle ?? null,
    p_insurance_data: payload.insurance ?? null,
    p_priority_data: payload.priority ?? null,
    p_claim_details_data: payload.claimDetails ?? null,
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string } | null
  if (!res || res.success === false) throw new Error(res?.error || 'Failed to save changes')
}

export interface StatusTransitions {
  current: string | null
  available: string[]
}

export async function getStatusTransitions(claimId: string, userId: string): Promise<StatusTransitions> {
  const { data, error } = await supabase.rpc('get_available_status_transitions', {
    p_claim_id: claimId,
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
  const res = data as {
    success?: boolean
    current_status?: string | null
    available_statuses?: Array<{ status: string }>
  } | null
  if (!res || res.success === false) return { current: null, available: [] }
  return {
    current: res.current_status ?? null,
    available: (res.available_statuses ?? []).map((s) => s.status).filter(Boolean),
  }
}

export async function updateClaimStatus(
  claimId: string,
  newStatus: string,
  userId: string,
  userType: string,
  comment?: string | null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('update_claim_status', {
    p_claim_id: claimId,
    p_new_status: newStatus,
    p_user_id: userId,
    p_user_type: userType,
    p_comment: comment ?? null,
  })
  if (error) throw new Error(error.message)
  return data === true
}

// ---------- CSA allocation ----------

export interface CsaAllocation {
  insurance_company_id: string
  insurer_name: string
  csa_user_id: string | null
  csa_name: string | null
  allocation_id: string | null
  is_active: boolean
}
export interface CsaUser {
  user_id: string
  name: string
  email: string | null
}
export interface CsaAllocationsData {
  allocations: CsaAllocation[]
  availableCsas: CsaUser[]
}

export async function getCsaAllocations(branchId: string, userId: string): Promise<CsaAllocationsData> {
  const { data, error } = await supabase.rpc('get_csa_allocations', {
    p_branch_id: branchId,
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
  const res = data as {
    success?: boolean
    error?: string
    allocations?: CsaAllocation[]
    available_csas?: CsaUser[]
  } | null
  if (res && res.success === false) throw new Error(res.error || 'Access denied')
  return {
    allocations: res?.allocations ?? [],
    availableCsas: res?.available_csas ?? [],
  }
}

export async function updateCsaAllocation(args: {
  insuranceCompanyId: string
  branchId: string
  csaUserId: string | null
  userId: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('update_csa_allocation', {
    p_insurance_company_id: args.insuranceCompanyId,
    p_branch_id: args.branchId,
    p_csa_user_id: args.csaUserId,
    p_user_id: args.userId,
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; message?: string; error?: string } | null
  if (res && res.success === false) throw new Error(res.error || 'Update failed')
  return res?.message || 'Saved'
}

// ---------- Document library ----------

export interface DocItem {
  id: string
  doc_type: string
  scope: string
  branch_id: string | null
  file_name: string
  file_size: number | null
  file_url: string
  mime_type: string | null
  description: string | null
  created_at: string
  uploaded_by: string | null
}

interface DocLibResult {
  success?: boolean
  count?: number
  documents?: DocItem[]
}

export async function fetchDocumentLibrary(
  docType: string,
  scope: string = 'global',
  branchId: string | null = null,
): Promise<DocItem[]> {
  const { data, error } = await supabase.rpc('fetch_document_library', {
    p_doc_type: docType,
    p_scope: scope,
    p_branch_id: branchId,
  })
  if (error) throw new Error(error.message)
  return ((data as DocLibResult)?.documents ?? []) as DocItem[]
}

// Allowed library document types (enforced by the RPC too).
export const DOC_TYPES: { type: string; label: string }[] = [
  { type: 'costing_sla', label: 'Costing SLA Forms' },
  { type: 'accident_claim', label: 'Accident Claim Forms' },
  { type: 'costing_doc', label: 'Costing Document Forms' },
]

export interface UploadDocInput {
  docType: string
  file: File
  description?: string | null
  scope?: string
  branchId?: string | null
}

// Two-step upload: push the file to blob storage, then register it in the
// document library via RPC.
export async function uploadDocument(input: UploadDocInput): Promise<DocItem> {
  const fileUrl = await uploadToBlob(input.file)
  const { data, error } = await supabase.rpc('upload_document_library', {
    p_doc_type: input.docType,
    p_scope: input.scope ?? 'global',
    p_branch_id: input.branchId ?? null,
    p_file_url: fileUrl,
    p_file_name: input.file.name,
    p_file_size: input.file.size,
    p_mime_type: input.file.type || null,
    p_description: input.description?.trim() || null,
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; error?: string; document?: DocItem } | null
  if (!res || res.success === false) {
    const code = res?.error || 'Upload failed'
    const map: Record<string, string> = {
      invalid_doc_type: 'That document type is not allowed.',
      file_url_and_file_name_required: 'Missing file URL or file name.',
    }
    throw new Error(map[code] ?? code)
  }
  return res.document as DocItem
}

export async function deleteDocument(documentId: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_document_library', {
    p_document_id: documentId,
  })
  if (error) throw new Error(error.message)
  const res = data as { success?: boolean; message?: string; error?: string } | null
  if (res && res.success === false) throw new Error(res.message || res.error || 'Delete failed')
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

// ---------- Profile picture ----------

const AVATAR_BUCKET = 'claim-documents'

// Upload an avatar image to storage and return its public URL.
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `profile-pictures/${userId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Persist the profile picture URL on the user's record.
export async function updateOwnProfilePicture(url: string): Promise<void> {
  const { error } = await supabase.rpc('update_own_profile_picture', { p_profile_picture_url: url })
  if (error) throw new Error(error.message)
}

// ---------- Customers ----------

export interface CustomerRow {
  customerId: string
  name: string
  email: string | null
  mobile: string | null
  phone: string | null
  totalClaims: number
  totalVehicles: number
  latestClaimDate: string | null
}

export async function getCustomersDirectory(search: string | null, limit = 50, offset = 0): Promise<CustomerRow[]> {
  const { data, error } = await supabase.rpc('get_customers_directory', { p_search: search || null, p_limit: limit, p_offset: offset })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    customerId: String(r.customer_id),
    name: (r.name as string) ?? 'Unknown',
    email: (r.email as string) ?? null,
    mobile: (r.mobile as string) ?? null,
    phone: (r.phone as string) ?? null,
    totalClaims: Number(r.total_claims ?? 0),
    totalVehicles: Number(r.total_vehicles ?? 0),
    latestClaimDate: (r.latest_claim_date as string) ?? null,
  }))
}

export interface CustomerDetail {
  id: string
  name: string
  email: string | null
  mobile: string | null
  phone: string | null
  idNumber: string | null
  address: string | null
  totalClaims: number
  totalVehicles: number
  latestClaimDate: string | null
  createdAt: string | null
}

export async function getCustomerById(customerId: string): Promise<CustomerDetail | null> {
  const { data, error } = await supabase.rpc('get_customer_by_id', { p_customer_id: customerId })
  if (error) throw new Error(error.message)
  const r = ((data ?? []) as Record<string, unknown>[])[0]
  if (!r) return null
  return {
    id: String(r.id),
    name: (r.customer_name as string) ?? 'Unknown',
    email: (r.email as string) ?? null,
    mobile: (r.mobile as string) ?? null,
    phone: (r.phone as string) ?? null,
    idNumber: (r.id_number as string) ?? null,
    address: (r.address as string) ?? null,
    totalClaims: Number(r.total_claims ?? 0),
    totalVehicles: Number(r.total_vehicles ?? 0),
    latestClaimDate: (r.latest_claim_date as string) ?? null,
    createdAt: (r.created_at as string) ?? null,
  }
}

export interface CustomerVehicle {
  id: string
  registration: string | null
  make: string | null
  model: string | null
  year: number | null
  color: string | null
  vin: string | null
  totalClaims: number
}

export async function getCustomerVehicles(customerId: string): Promise<CustomerVehicle[]> {
  const { data, error } = await supabase.rpc('get_customer_vehicles', { p_customer_id: customerId, p_limit: 50 })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    registration: (r.registration as string) ?? null,
    make: (r.make as string) ?? null,
    model: (r.model as string) ?? null,
    year: (r.year as number) ?? null,
    color: (r.color as string) ?? null,
    vin: (r.vin as string) ?? null,
    totalClaims: Number(r.total_claims ?? 0),
  }))
}

export interface CustomerClaim {
  claimId: string
  drNumber: string | null
  roNumber: string | null
  status: string | null
  jobType: string | null
  registration: string | null
  make: string | null
  model: string | null
  approvedValue: number
  isUpsell: boolean
  isWarranty: boolean
  createdAt: string | null
  branchName: string | null
}

export async function getCustomerClaims(customerId: string): Promise<CustomerClaim[]> {
  const { data, error } = await supabase.rpc('get_customer_claims', { p_customer_id: customerId, p_limit: 100 })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    claimId: String(r.claim_id),
    drNumber: (r.dr_number as string) ?? null,
    roNumber: (r.ro_number as string) ?? null,
    status: (r.claim_status as string) ?? null,
    jobType: (r.job_type as string) ?? null,
    registration: (r.registration as string) ?? null,
    make: (r.make as string) ?? null,
    model: (r.model as string) ?? null,
    approvedValue: Number(r.approved_value ?? 0),
    isUpsell: r.is_upsell === true,
    isWarranty: r.is_warranty === true,
    createdAt: (r.created_at as string) ?? null,
    branchName: (r.branch_name as string) ?? null,
  }))
}

export interface VehicleLookup {
  found: boolean
  message?: string
  vehicle?: { make: string; model: string; year: string; color: string; vin: string; registration: string }
  customer?: { title: string; firstName: string; surname: string; email: string; cellPhone: string; alternativePhone: string; allowSms: boolean; allowEmail: boolean; allowPhone: boolean; allowWhatsapp: boolean } | null
}

export async function lookupVehicleForClaim(registration: string): Promise<VehicleLookup> {
  const { data, error } = await supabase.rpc('lookup_vehicle_for_claim', { p_registration: registration.trim() })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as { success?: boolean; message?: string; vehicle?: Record<string, unknown>; customer?: Record<string, unknown> | null }
  if (!r.success) return { found: false, message: r.message ?? 'Not found' }
  const v = r.vehicle ?? {}
  const c = r.customer
  const comm = (c?.comm ?? {}) as Record<string, unknown>
  return {
    found: true,
    vehicle: {
      make: (v.make as string) ?? '',
      model: (v.model as string) ?? '',
      year: v.year != null ? String(v.year) : '',
      color: (v.color as string) ?? '',
      vin: (v.vin as string) ?? '',
      registration: (v.registration as string) ?? '',
    },
    customer: c ? {
      title: (c.title as string) ?? '',
      firstName: (c.first_name as string) ?? '',
      surname: (c.surname as string) ?? '',
      email: (c.email as string) ?? '',
      cellPhone: (c.cell_phone as string) ?? '',
      alternativePhone: (c.alternative_phone as string) ?? '',
      allowSms: comm.sms === true,
      allowEmail: comm.email === true,
      allowPhone: comm.phone === true,
      allowWhatsapp: comm.whatsapp === true,
    } : null,
  }
}

// ---------- New Claim / Estimate ----------

export interface ReferralSource { id: string; name: string }

export async function getReferralSources(): Promise<ReferralSource[]> {
  const { data, error } = await supabase
    .from('referral_sources')
    .select('id, source_name, is_active, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as { id: string; source_name: string }[]).map((r) => ({ id: r.id, name: r.source_name }))
}

export const QUOTE_TYPES = ['Insurance Quote', 'Cash Quote', 'Third Party']

// Normalized contact-preference string for a claim's client, handling both the
// legacy {preferred:"..."} shape and the new {sms,email,phone,whatsapp} booleans.
export async function getClaimContactPrefs(claimId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_claim_contact_prefs', { p_claim_id: claimId })
  if (error) throw new Error(error.message)
  return (data as string | null) ?? ''
}

export interface NewEstimateInput {
  jobType: 'drivable' | 'towed'
  referredBy: string
  title: string
  firstName: string
  surname: string
  cellPhone: string
  email: string
  alternativePhone: string
  comments: string
  make: string
  model: string
  year: string
  color: string
  registration: string
  warranty: boolean
  accidentDate: string // YYYY-MM-DD
  damageDescription: string
  additionalDamage: boolean
  otherRepairInformation: string
  rentalCar: boolean
  quoteType: string
  sendAssessmentToBroker: boolean
  estimatorId: string
  allowSms: boolean
  allowEmail: boolean
  allowPhone: boolean
  allowWhatsapp: boolean
  marketingConsent: boolean
}

export interface NewEstimateResult {
  claimId: string
  claimNumber: string
  drNumber: string
  status: string
  tmsIntegrated: boolean
  message: string
}

// Format YYYY-MM-DD -> "Mon DD, YYYY" (what the RPC's TO_DATE expects)
function fmtAccidentDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

export async function createNewEstimate(branchId: string, userId: string, i: NewEstimateInput): Promise<NewEstimateResult> {
  const customerData = {
    referred_by: i.referredBy,
    title: i.title,
    first_name: i.firstName,
    surname: i.surname,
    cell_phone: i.cellPhone,
    email: i.email,
    alternative_phone: i.alternativePhone,
    comments: i.comments,
    allow_sms: i.allowSms,
    allow_email: i.allowEmail,
    allow_phone: i.allowPhone,
    allow_whatsapp: i.allowWhatsapp,
    marketing_consent: i.marketingConsent,
  }
  const vehicleData = {
    make: i.make,
    model: i.model,
    year: i.year,
    color: i.color,
    registration: i.registration,
    warranty: i.warranty,
    additional_damage: i.additionalDamage,
    other_repair_information: i.otherRepairInformation,
  }
  const claimData = {
    job_type: i.jobType,
    accident_date: fmtAccidentDate(i.accidentDate),
    damage_description: i.damageDescription,
    additional_damage: i.additionalDamage,
    other_repair_information: i.otherRepairInformation,
    rental_car: i.rentalCar,
    quote_type: i.quoteType,
    send_assessment_to_broker: i.sendAssessmentToBroker,
    estimator_id: i.estimatorId || null,
    branch_entry_method: i.jobType === 'towed' ? 'towed' : 'drive_in',
  }
  const { data, error } = await supabase.rpc('create_new_estimate', {
    p_branch_id: branchId,
    p_user_id: userId,
    p_customer_data: customerData,
    p_vehicle_data: vehicleData,
    p_claim_data: claimData,
  })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as { success?: boolean; error?: string; claim_id?: string; claim_number?: string; dr_number?: string; status?: string; tms_integrated?: boolean; message?: string }
  if (!r.success) throw new Error(r.error || 'Failed to create claim')
  return {
    claimId: String(r.claim_id ?? ''),
    claimNumber: r.claim_number ?? '',
    drNumber: r.dr_number ?? 'N/A',
    status: r.status ?? '',
    tmsIntegrated: r.tms_integrated === true,
    message: r.message ?? 'Claim created',
  }
}

// ---------- Calendar ----------

export type CalendarEventType = 'new_claim' | 'status_change' | 'promised_date' | 'collection_date' | 'booked_summary'

export interface CalendarEvent {
  claimId: string | null
  roNumber: string | null
  eventDate: string // YYYY-MM-DD
  eventTime: string // ISO timestamp
  eventType: CalendarEventType
  eventTitle: string
  vehicleReg: string | null
  customerName: string | null
  message: string
  totalApprovedValue: number
  bookedClaimsCount: number
}

export interface CalendarSummary {
  totalEvents: number
  newClaims: number
  statusChanges: number
  promisedDates: number
  collectionDates: number
  bookedClaims: number
  totalBookedValue: number
}

export interface CalendarData {
  startDate: string | null
  endDate: string | null
  events: CalendarEvent[]
  summary: CalendarSummary
}

export interface CalendarJob {
  claimId: string
  drNumber: string
  roNumber: string
  registration: string
  claimStatus: string | null
  manufacturer: string
  csa: string
  insurer: string
  approvedValue: number
  customer: string
  contact: string
  speedShop: number
  aging: number | null
  dip: number | null
}

export interface CalendarJobsData {
  date: string
  jobs: CalendarJob[]
  totalJobs: number
  totalApprovedValue: number
}

export async function getCalendarJobsByDate(branchId: string | null, date: string): Promise<CalendarJobsData> {
  const { data, error } = await supabase.rpc('get_calendar_jobs_by_date', { p_branch_id: branchId, p_date: date })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as { success?: boolean; error?: string; date?: string; jobs?: Record<string, unknown>[]; total_jobs?: number; total_approved_value?: number }
  if (r.success === false) throw new Error(r.error || 'Failed to load booked jobs')
  const jobs = (r.jobs ?? []).map((j) => ({
    claimId: String(j.claim_id ?? ''),
    drNumber: (j.dr_number as string) ?? 'N/A',
    roNumber: (j.ro_number as string) ?? 'N/A',
    registration: (j.registration as string) ?? 'N/A',
    claimStatus: (j.claim_status as string) ?? null,
    manufacturer: (j.manufacturer as string) ?? 'N/A',
    csa: (j.csa as string) ?? 'N/A',
    insurer: (j.insurer as string) ?? 'N/A',
    approvedValue: typeof j.approved_value === 'number' ? j.approved_value : 0,
    customer: (j.customer as string) ?? 'Unknown',
    contact: (j.contact as string) ?? 'N/A',
    speedShop: typeof j.speed_shop === 'number' ? j.speed_shop : 0,
    aging: typeof j.aging === 'number' ? j.aging : null,
    dip: typeof j.dip === 'number' ? j.dip : null,
  }))
  return {
    date: r.date ?? date,
    jobs,
    totalJobs: r.total_jobs ?? jobs.length,
    totalApprovedValue: r.total_approved_value ?? 0,
  }
}

export async function getCalendarEvents(branchId: string | null, startDate: string, endDate: string): Promise<CalendarData> {
  const { data, error } = await supabase.rpc('get_calendar_events', {
    p_branch_id: branchId,
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as {
    success?: boolean
    error?: string
    date_range?: { start_date?: string; end_date?: string }
    events?: Record<string, unknown>[]
    summary?: Record<string, number>
  }
  if (r.success === false) throw new Error(r.error || 'Failed to load calendar events')
  const events = (r.events ?? []).map((e) => ({
    claimId: (e.claim_id as string) ?? null,
    roNumber: (e.ro_number as string) ?? null,
    eventDate: String(e.event_date ?? ''),
    eventTime: String(e.event_time ?? ''),
    eventType: (e.event_type as CalendarEventType) ?? 'new_claim',
    eventTitle: (e.event_title as string) ?? '',
    vehicleReg: (e.vehicle_reg as string) ?? null,
    customerName: (e.customer_name as string) ?? null,
    message: (e.message as string) ?? '',
    totalApprovedValue: typeof e.totalApprovedValue === 'number' ? e.totalApprovedValue : 0,
    bookedClaimsCount: typeof e.bookedClaimsCount === 'number' ? e.bookedClaimsCount : 0,
  }))
  const s = r.summary ?? {}
  return {
    startDate: r.date_range?.start_date ?? startDate,
    endDate: r.date_range?.end_date ?? endDate,
    events,
    summary: {
      totalEvents: s.total_events ?? events.length,
      newClaims: s.new_claims ?? 0,
      statusChanges: s.status_changes ?? 0,
      promisedDates: s.promised_dates ?? 0,
      collectionDates: s.collection_dates ?? 0,
      bookedClaims: s.booked_claims ?? 0,
      totalBookedValue: s.total_booked_value ?? 0,
    },
  }
}

// ---------- Claim Disclaimers ----------
// Staff send a signing link to the customer; customer reviews 4 acknowledgement
// sections + signs. Backed by the `disclaimer` edge function (send/load/sign/
// status) and `disclaimer-pdf` (signed PDF). Function routes on the LAST path
// segment, so the slugs are e.g. `disclaimer/send`.

const DISCLAIMER_FN = `${SUPABASE_URL}/functions/v1/disclaimer`

const disclaimerHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
}

// The four fixed acknowledgement sections, in order, with their full legal copy.
export const DISCLAIMER_SECTIONS: { key: string; label: string; body: string }[] = [
  {
    key: 'personal_items',
    label: 'Personal Items',
    body: 'I acknowledge that I have removed all personal belongings from the vehicle. Renew-It Group will not be held responsible for any personal items left in the vehicle during the repair process.',
  },
  {
    key: 'windscreen',
    label: 'Windscreen',
    body: 'I acknowledge that Renew-It Group will not be held responsible for any existing windscreen damage, including chips, cracks, or scratches present before the vehicle was received.',
  },
  {
    key: 'fuel_battery',
    label: 'Fuel & Battery',
    body: 'I acknowledge that the fuel level and battery condition have been noted. Renew-It Group is not responsible for fuel consumption during vehicle movement or pre-existing battery conditions.',
  },
  {
    key: 'lock_nut',
    label: 'Lock Nut',
    body: 'I confirm that if my vehicle has locking wheel nuts, I have provided the key. Renew-It Group will not be responsible for delays or costs if the lock nut key was not provided.',
  },
]

export type DisclaimerSentVia = 'whatsapp' | 'email' | 'sms' | 'link'

export interface DisclaimerStatus {
  token: string
  sentVia: string | null
  sentAt: string | null
  firstOpenedAt: string | null
  lastOpenedAt: string | null
  openCount: number
  isSigned: boolean
  signedAt: string | null
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  vehicleReg: string | null
}

export interface DisclaimerSendResult {
  token: string
  disclaimerId: string
  claimNumber: string | null
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  alreadyExisted: boolean
}

function normalizeDisclaimer(d: Record<string, unknown>): DisclaimerStatus {
  const name = [d.customer_name, d.customer_surname].filter(Boolean).join(' ').trim()
  return {
    token: (d.token as string) ?? '',
    sentVia: (d.sent_via as string) ?? null,
    sentAt: (d.sent_at as string) ?? (d.created_at as string) ?? null,
    firstOpenedAt: (d.first_opened_at as string) ?? null,
    lastOpenedAt: (d.last_opened_at as string) ?? null,
    openCount: (d.open_count as number) ?? 0,
    isSigned: d.is_signed === true,
    signedAt: (d.signed_at as string) ?? null,
    customerName: name || null,
    customerEmail: (d.customer_email as string) ?? null,
    customerPhone: (d.customer_phone as string) ?? null,
    vehicleReg: (d.vehicle_reg as string) ?? null,
  }
}

// Build the public signing link. Base comes from VITE_DISCLAIMER_BASE_URL when
// set (e.g. the deployed domain), otherwise the current origin — so it's correct
// in dev (localhost) and prod without code changes.
export function disclaimerLink(token: string): string {
  const envBase = (import.meta.env.VITE_DISCLAIMER_BASE_URL as string | undefined)?.trim()
  const base = envBase || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base.replace(/\/$/, '')}/disclaimer/${token}`
}

export function disclaimerPdfUrl(token: string): string {
  return `${SUPABASE_URL}/functions/v1/disclaimer-pdf?token=${encodeURIComponent(token)}`
}

// CALL 1 — create (or reuse) a disclaimer for a claim; returns the token.
export async function sendDisclaimer(
  claimId: string,
  sentVia: DisclaimerSentVia = 'link',
  sentBy?: string | null,
): Promise<DisclaimerSendResult> {
  const res = await fetch(`${DISCLAIMER_FN}/send`, {
    method: 'POST',
    headers: disclaimerHeaders,
    body: JSON.stringify({ claim_id: claimId, sent_via: sentVia, sent_by: sentBy ?? null }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) {
    throw new Error(body?.error || `Failed to create disclaimer (${res.status})`)
  }
  return {
    token: body.token,
    disclaimerId: body.disclaimer_id,
    claimNumber: body.claim_number ?? null,
    customerName: body.customer_name ?? null,
    customerEmail: body.customer_email ?? null,
    customerPhone: body.customer_phone ?? null,
    alreadyExisted: body.already_existed === true,
  }
}

// CALL 4 — list disclaimers for a claim (latest first) for the dashboard.
export async function getDisclaimerStatus(claimId: string): Promise<{ hasSigned: boolean; disclaimers: DisclaimerStatus[] }> {
  const res = await fetch(`${DISCLAIMER_FN}/status?claim_id=${encodeURIComponent(claimId)}`, {
    method: 'GET',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) {
    throw new Error(body?.error || `Failed to load disclaimer status (${res.status})`)
  }
  const rows = (body.disclaimers as Record<string, unknown>[]) ?? []
  return { hasSigned: body.has_signed === true, disclaimers: rows.map(normalizeDisclaimer) }
}

export interface DisclaimerLoad {
  isSigned: boolean
  signedAt: string | null
  customerName: string | null
  vehicleReg: string | null
  branchName: string | null
  acknowledgements: { sectionKey: string; acknowledged: boolean }[]
}

// CALL 2 — load a disclaimer by token (customer-facing page). Also tracks opens.
export async function loadDisclaimer(token: string): Promise<DisclaimerLoad> {
  const res = await fetch(`${DISCLAIMER_FN}/load?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) {
    throw new Error(body?.error || `This signing link is invalid or has expired.`)
  }
  const d = (body.disclaimer ?? {}) as Record<string, unknown>
  const name = [d.customer_name, d.customer_surname].filter(Boolean).join(' ').trim()
  const acks = (d.disclaimer_acknowledgements as Record<string, unknown>[]) ?? []
  return {
    isSigned: body.is_signed === true,
    signedAt: body.signed_at ?? null,
    customerName: name || null,
    vehicleReg: (d.vehicle_reg as string) ?? null,
    branchName: (body.branch_name as string) ?? null,
    acknowledgements: acks.map((a) => ({ sectionKey: a.section_key as string, acknowledged: a.acknowledged === true })),
  }
}

// CALL 3 — submit the signed disclaimer.
export async function signDisclaimer(
  token: string,
  acknowledgements: { section_key: string; acknowledged: boolean; notes?: string }[],
  signatureData: string,
  signedName?: string,
): Promise<{ signedAt: string }> {
  const res = await fetch(`${DISCLAIMER_FN}/sign`, {
    method: 'POST',
    headers: disclaimerHeaders,
    body: JSON.stringify({ token, acknowledgements, signature_data: signatureData, signed_name: signedName ?? null }),
  })
  const body = await res.json().catch(() => null)
  if (res.status === 409 || body?.already_signed) {
    const err = new Error('This disclaimer has already been signed.') as Error & { alreadySigned?: boolean }
    err.alreadySigned = true
    throw err
  }
  if (!res.ok || !body?.success) {
    throw new Error(body?.error || `Failed to submit (${res.status})`)
  }
  return { signedAt: body.signed_at }
}
