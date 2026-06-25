import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import {
  getAllUsers,
  getCsas,
  getEstimators,
  getPartsBuyers,
  getProductionStaff,
  prettyRole,
  roleColor,
  type AdminUser,
  type RoleMember,
  type RoleEntity,
} from '../lib/api'
import { Loader } from '../components/Loader'
import { AddUserModal } from '../components/AddUserModal'
import { RoleMemberModal } from '../components/RoleMemberModal'
import { UploadDocs } from '../components/UploadDocs'
import { BranchControls } from '../components/BranchControls'
import {
  IconSearch,
  IconCustomers,
  IconAllocate,
  IconReports,
  IconClaims,
  IconDashboard,
  IconDocuments,
  IconAdmin,
  IconPlus,
} from '../components/icons'

type TabKey = 'users' | 'csa' | 'estimator' | 'parts' | 'production' | 'upload' | 'branches'

const TABS: { key: TabKey; label: string; Icon: typeof IconCustomers }[] = [
  { key: 'users', label: 'Manage App Users', Icon: IconCustomers },
  { key: 'csa', label: 'CSA', Icon: IconAllocate },
  { key: 'estimator', label: 'Estimator', Icon: IconReports },
  { key: 'parts', label: 'Parts Buyer', Icon: IconClaims },
  { key: 'production', label: 'Production Staff', Icon: IconDashboard },
  { key: 'upload', label: 'Upload Docs', Icon: IconDocuments },
  { key: 'branches', label: 'Branch Controls', Icon: IconAdmin },
]

function Status({ active }: { active: boolean }) {
  return <span className={`pill-status ${active ? 'on' : 'off'}`}>{active ? 'Active' : 'Inactive'}</span>
}

type ActiveFilter = 'all' | 'active' | 'inactive'

function Toolbar({
  search,
  onSearch,
  filter,
  onFilter,
  counts,
  extra,
  action,
}: {
  search: string
  onSearch: (v: string) => void
  filter: ActiveFilter
  onFilter: (f: ActiveFilter) => void
  counts?: Record<ActiveFilter, number>
  extra?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="admin-bar">
      <div className="search rm-search admin-search">
        <span className="search-icon" aria-hidden><IconSearch size={17} /></span>
        <input placeholder="Search…" value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
      <div className="admin-right">
        {extra}
        <div className="chips">
          {(['all', 'active', 'inactive'] as ActiveFilter[]).map((f) => (
            <button key={f} className={`chip-f${filter === f ? ' active' : ''}`} onClick={() => onFilter(f)}>
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Inactive'}
              {counts && <span className="chip-count">{counts[f]}</span>}
            </button>
          ))}
        </div>
        {action}
      </div>
    </div>
  )
}

function matchFilter(isActive: boolean, f: ActiveFilter): boolean {
  return f === 'all' || (f === 'active' ? isActive : !isActive)
}

function UsersSection() {
  const { branches, branchId, profile } = useAuth()
  const [rows, setRows] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ActiveFilter>('active')
  const [branchFilter, setBranchFilter] = useState<string>(branchId ?? '')
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const d = await getAllUsers()
        if (on) setRows(d)
      } catch (e: unknown) {
        if (on) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [reload])

  const branchName = (id: string | null) =>
    branches.find((b) => b.id === id)?.branch_name ?? (id ? '—' : 'All')

  const { filtered, counts } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const scoped = rows.filter((u) => {
      if (branchFilter && u.branchId !== branchFilter) return false
      if (!q) return true
      return [u.name, u.email, u.role, u.agentType].some((v) => (v ?? '').toLowerCase().includes(q))
    })
    const isActive = (u: AdminUser) => (u.status ?? 'active').toLowerCase() !== 'inactive'
    const c: Record<ActiveFilter, number> = {
      all: scoped.length,
      active: scoped.filter(isActive).length,
      inactive: scoped.filter((u) => !isActive(u)).length,
    }
    return { filtered: scoped.filter((u) => matchFilter(isActive(u), filter)), counts: c }
  }, [rows, search, filter, branchFilter])

  const currentBranch = branches.find((b) => b.id === branchId)
  const otherBranches = branches.filter((b) => b.id !== branchId)

  if (loading) return <Loader label="Loading users…" />
  if (error) return <div className="login-error">{error}</div>

  // "All branches" always on top, then current branch, then the rest
  const branchSelect = (
    <select className="rm-status" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
      <option value="">All branches</option>
      {currentBranch && <option value={currentBranch.id}>{currentBranch.branch_name}</option>}
      {otherBranches.map((b) => (
        <option key={b.id} value={b.id}>{b.branch_name}</option>
      ))}
    </select>
  )

  const addBtn = profile?.isAdmin ? (
    <button className="new-claim add-user-btn" onClick={() => setShowAdd(true)}>
      <IconPlus size={16} /> Add User
    </button>
  ) : null

  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        extra={branchSelect}
        action={addBtn}
      />
      <table className="admin-table fixed">
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '11%' }} />
        </colgroup>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Branch</th><th>Status</th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td className="empty" colSpan={6}>No users found.</td></tr>}
          {filtered.map((u) => (
            <tr
              key={u.id}
              className={profile?.isAdmin ? 'row-clickable' : ''}
              onClick={profile?.isAdmin ? () => setEditUser(u) : undefined}
              title={profile?.isAdmin ? 'Click to edit' : undefined}
            >
              <td title={u.name}>
                <span className="cell-name">{u.name}</span>
              </td>
              <td title={u.email ?? ''}>{u.email}</td>
              <td>{u.phone || '—'}</td>
              <td className="cell-badge">
                {(() => {
                  const val = u.agentType || u.role
                  if (!val) return '—'
                  const c = roleColor(u.agentType ?? u.role)
                  return (
                    <span className="role-pill" style={{ background: c.bg, color: c.fg }} title={prettyRole(val)}>
                      {prettyRole(val)}
                    </span>
                  )
                })()}
              </td>
              <td title={u.canAccessAllBranches ? 'All branches' : branchName(u.branchId)}>
                {u.canAccessAllBranches ? 'All branches' : branchName(u.branchId)}
              </td>
              <td className="cell-badge"><Status active={(u.status ?? 'active').toLowerCase() !== 'inactive'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="admin-foot">{filtered.length} users</div>

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setReload((n) => n + 1) }}
        />
      )}
      {editUser && (
        <AddUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); setReload((n) => n + 1) }}
        />
      )}
    </>
  )
}

function RoleSection({
  entity,
  label,
  load,
  showDepartment = false,
}: {
  entity: RoleEntity
  label: string
  load: (branchId: string | null) => Promise<RoleMember[]>
  showDepartment?: boolean
}) {
  const { branches, branchId } = useAuth()
  const [rows, setRows] = useState<RoleMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ActiveFilter>('all')
  const [branchFilter, setBranchFilter] = useState<string>(branchId ?? '')
  const [showAdd, setShowAdd] = useState(false)
  const [editMember, setEditMember] = useState<RoleMember | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const d = await load(null) // fetch all branches; filter client-side
        if (on) setRows(d)
      } catch (e: unknown) {
        if (on) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload])

  const { filtered, counts } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const scoped = rows.filter((r) => {
      if (branchFilter && r.branchId !== branchFilter) return false
      if (!q) return true
      return [r.name, r.email].some((v) => (v ?? '').toLowerCase().includes(q))
    })
    const c: Record<ActiveFilter, number> = {
      all: scoped.length,
      active: scoped.filter((r) => r.isActive).length,
      inactive: scoped.filter((r) => !r.isActive).length,
    }
    return { filtered: scoped.filter((r) => matchFilter(r.isActive, filter)), counts: c }
  }, [rows, search, filter, branchFilter])

  const branchName = (id: string | null) =>
    branches.find((b) => b.id === id)?.branch_name ?? '—'

  if (loading) return <Loader label="Loading…" />
  if (error) return <div className="login-error">{error}</div>

  const currentBranch = branches.find((b) => b.id === branchId)
  const otherBranches = branches.filter((b) => b.id !== branchId)
  const branchSelect = (
    <select className="rm-status" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
      <option value="">All branches</option>
      {currentBranch && <option value={currentBranch.id}>{currentBranch.branch_name}</option>}
      {otherBranches.map((b) => (
        <option key={b.id} value={b.id}>{b.branch_name}</option>
      ))}
    </select>
  )

  const addBtn = (
    <button className="new-claim add-user-btn" onClick={() => setShowAdd(true)}>
      <IconPlus size={16} /> Add {label}
    </button>
  )

  const colCount = showDepartment ? 5 : 4

  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        extra={branchSelect}
        action={addBtn}
      />
      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Email</th>{showDepartment && <th>Department</th>}<th>Branch</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td className="empty" colSpan={colCount}>No records found.</td></tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="row-clickable"
                onClick={() => setEditMember(r)}
                title="Click to edit"
              >
                <td><span className="cell-name">{r.name}</span></td>
                <td>{r.email || '—'}</td>
                {showDepartment && <td>{r.department || '—'}</td>}
                <td>{branchName(r.branchId)}</td>
                <td><Status active={r.isActive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-foot">{filtered.length} records</div>

      {showAdd && (
        <RoleMemberModal
          entity={entity}
          label={label}
          showDepartment={showDepartment}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setReload((n) => n + 1) }}
        />
      )}
      {editMember && (
        <RoleMemberModal
          entity={entity}
          label={label}
          member={editMember}
          showDepartment={showDepartment}
          onClose={() => setEditMember(null)}
          onSaved={() => { setEditMember(null); setReload((n) => n + 1) }}
        />
      )}
    </>
  )
}

export function Admin() {
  const [tab, setTab] = useState<TabKey>('users')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <div className="muted">Manage users, roles, documents and branch settings</div>
        </div>
      </div>

      <div className="admin-layout">
        <nav className="admin-nav">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`admin-nav-item${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              <span className="admin-nav-icon"><Icon size={18} /></span>
              {label}
            </button>
          ))}
        </nav>

        <div className="admin-content">
          <div className="table-card admin-panel">
            {tab === 'users' && <UsersSection />}
            {tab === 'csa' && <RoleSection entity="csa" label="CSA" load={(b) => getCsas({ branchId: b })} />}
            {tab === 'estimator' && <RoleSection entity="estimator" label="Estimator" load={(b) => getEstimators({ branchId: b })} />}
            {tab === 'parts' && <RoleSection entity="parts" label="Parts Buyer" load={(b) => getPartsBuyers({ branchId: b })} />}
            {tab === 'production' && (
              <RoleSection entity="production" label="Production Staff" load={(b) => getProductionStaff({ branchId: b })} showDepartment />
            )}
            {tab === 'branches' && <BranchControls />}
            {tab === 'upload' && <UploadDocs />}
          </div>
        </div>
      </div>
    </div>
  )
}
