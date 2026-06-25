import { useEffect, useMemo, useState } from 'react'
import {
  listBranches,
  listFuelStations,
  updateBranch,
  type Branch,
  type BranchUpdate,
  type FuelStation,
} from '../lib/api'
import { Loader } from './Loader'
import { useToast } from './Toast'
import { BranchEditModal } from './BranchEditModal'
import { FuelStationModal } from './FuelStationModal'
import { IconSearch, IconPlus } from './icons'

type SubTab = 'branches' | 'fuel' | 'bulk' | 'drive' | 'tow'

const SUBTABS: { key: SubTab; label: string }[] = [
  { key: 'branches', label: 'Branches' },
  { key: 'fuel', label: 'Fuel Stations' },
  { key: 'bulk', label: 'Bulk Move' },
  { key: 'drive', label: 'Drive Show' },
  { key: 'tow', label: 'Tow Show' },
]

// A small on/off switch.
function Toggle({
  on,
  busy,
  onChange,
}: {
  on: boolean
  busy?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`switch${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => onChange(!on)}
    >
      <span className="switch-knob" />
    </button>
  )
}

function SearchBar({ value, onChange, action }: { value: string; onChange: (v: string) => void; action?: React.ReactNode }) {
  return (
    <div className="admin-bar">
      <div className="search rm-search admin-search">
        <span className="search-icon" aria-hidden><IconSearch size={17} /></span>
        <input placeholder="Search branches…" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      {action && <div className="admin-right">{action}</div>}
    </div>
  )
}

// Branch list with a single toggle column (Bulk Move / Drive Show / Tow Show).
function ToggleSection({
  branches,
  field,
  columnLabel,
  blurb,
  onPatched,
}: {
  branches: Branch[]
  field: 'bulk_move' | 'drive_show_status' | 'tow_show_status'
  columnLabel: string
  blurb: string
  onPatched: (id: string, patch: Partial<Branch>) => void
}) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return branches
    return branches.filter((b) =>
      [b.branch_name, b.branch_code].some((v) => (v ?? '').toLowerCase().includes(q)),
    )
  }, [branches, search])

  const flip = async (b: Branch, v: boolean) => {
    setBusyId(b.id)
    onPatched(b.id, { [field]: v }) // optimistic
    try {
      await updateBranch(b.id, { [field]: v } as BranchUpdate)
    } catch (err: unknown) {
      onPatched(b.id, { [field]: !v }) // revert
      toast(err instanceof Error ? err.message : 'Update failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="branch-blurb">{blurb}</div>
      <SearchBar value={search} onChange={setSearch} />
      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr><th>Branch</th><th>Code</th><th className="r">{columnLabel}</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td className="empty" colSpan={3}>No branches found.</td></tr>}
            {filtered.map((b) => (
              <tr key={b.id}>
                <td><span className="cell-name">{b.branch_name}</span></td>
                <td>{b.branch_code}</td>
                <td className="r">
                  <Toggle on={!!b[field]} busy={busyId === b.id} onChange={(v) => flip(b, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-foot">{filtered.length} branches</div>
    </>
  )
}

function BranchesSection({
  branches,
  onSaved,
}: {
  branches: Branch[]
  onSaved: () => void
}) {
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<Branch | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return branches
    return branches.filter((b) =>
      [b.branch_name, b.branch_code, b.address].some((v) => (v ?? '').toLowerCase().includes(q)),
    )
  }, [branches, search])

  return (
    <>
      <SearchBar value={search} onChange={setSearch} />
      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr><th>Branch</th><th>Code</th><th>Address</th><th>Phone</th><th>Status</th><th className="r">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td className="empty" colSpan={6}>No branches found.</td></tr>}
            {filtered.map((b) => (
              <tr key={b.id} className="row-clickable" onClick={() => setEdit(b)} title="Click to edit">
                <td><span className="cell-name">{b.branch_name}</span></td>
                <td>{b.branch_code}</td>
                <td title={b.address ?? ''}>{b.address || '—'}</td>
                <td>{b.phone || '—'}</td>
                <td className="cell-badge">
                  <span className={`pill-status ${b.is_active !== false ? 'on' : 'off'}`}>
                    {b.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="r">
                  <button
                    className="btn-ghost sm"
                    onClick={(e) => { e.stopPropagation(); setEdit(b) }}
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-foot">{filtered.length} branches</div>

      {edit && (
        <BranchEditModal
          branch={edit}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); onSaved() }}
        />
      )}
    </>
  )
}

function FuelSection({ branches }: { branches: Branch[] }) {
  const [rows, setRows] = useState<FuelStation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [reload, setReload] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [edit, setEdit] = useState<FuelStation | null>(null)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const d = await listFuelStations(null)
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.name, r.account_no, r.address, r.branch_name].some((v) => (v ?? '').toLowerCase().includes(q)),
    )
  }, [rows, search])

  if (loading) return <Loader label="Loading fuel stations…" />
  if (error) return <div className="login-error">{error}</div>

  const addBtn = (
    <button className="new-claim add-user-btn" onClick={() => setShowAdd(true)}>
      <IconPlus size={16} /> Add Fuel Station
    </button>
  )

  return (
    <>
      <SearchBar value={search} onChange={setSearch} action={addBtn} />
      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr><th>Station</th><th>Branch</th><th>Account no.</th><th>Address</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td className="empty" colSpan={5}>No fuel stations found.</td></tr>}
            {filtered.map((s) => (
              <tr key={s.id} className="row-clickable" onClick={() => setEdit(s)} title="Click to edit">
                <td><span className="cell-name">{s.name}</span></td>
                <td>{s.branch_name || '—'}</td>
                <td>{s.account_no || '—'}</td>
                <td title={s.address ?? ''}>{s.address || '—'}</td>
                <td className="cell-badge">
                  <span className={`pill-status ${s.is_active !== false ? 'on' : 'off'}`}>
                    {s.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-foot">{filtered.length} fuel stations</div>

      {showAdd && (
        <FuelStationModal
          branches={branches}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setReload((n) => n + 1) }}
        />
      )}
      {edit && (
        <FuelStationModal
          branches={branches}
          station={edit}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); setReload((n) => n + 1) }}
        />
      )}
    </>
  )
}

export function BranchControls() {
  const [sub, setSub] = useState<SubTab>('branches')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const refresh = () => setReload((n) => n + 1)

  useEffect(() => {
    let on = true
    const run = async () => {
      setLoading(true)
      try {
        const d = await listBranches() // active branches only
        if (on) setBranches(d)
      } catch (e: unknown) {
        if (on) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [reload])

  const patchBranch = (id: string, patch: Partial<Branch>) =>
    setBranches((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  return (
    <>
      <div className="doc-tabs branch-subtabs">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            className={`doc-tab${sub === t.key ? ' active' : ''}`}
            onClick={() => setSub(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader label="Loading branches…" />
      ) : error ? (
        <div className="login-error">{error}</div>
      ) : (
        <>
          {sub === 'branches' && <BranchesSection branches={branches} onSaved={refresh} />}
          {sub === 'fuel' && <FuelSection branches={branches} />}
          {sub === 'bulk' && (
            <ToggleSection
              branches={branches}
              field="bulk_move"
              columnLabel="Bulk Move"
              blurb="When on, the branch’s 02-LOADING claims list shows the Bulk Move column, allowing claims to be moved to 05-Assembly in bulk."
              onPatched={patchBranch}
            />
          )}
          {sub === 'drive' && (
            <ToggleSection
              branches={branches}
              field="drive_show_status"
              columnLabel="Drive Show"
              blurb="When on, the “71-Drive-Client not proceeding” row appears on the live sales dashboard for this branch."
              onPatched={patchBranch}
            />
          )}
          {sub === 'tow' && (
            <ToggleSection
              branches={branches}
              field="tow_show_status"
              columnLabel="Tow Show"
              blurb="When on, the “70-Tow-Client not proceeding” row appears on the live sales dashboard for this branch."
              onPatched={patchBranch}
            />
          )}
        </>
      )}
    </>
  )
}
