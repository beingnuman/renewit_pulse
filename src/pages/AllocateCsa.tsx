import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import { useToast } from '../components/Toast'
import { getCsaAllocations, updateCsaAllocation, getCsas, type CsaAllocation, type RoleMember } from '../lib/api'
import { Loader } from '../components/Loader'
import { IconSearch } from '../components/icons'

const GRADS = [
  'linear-gradient(135deg,#3b82f6,#2563eb)',
  'linear-gradient(135deg,#8b5cf6,#7c3aed)',
  'linear-gradient(135deg,#14b8a6,#0d9488)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#ec4899,#db2777)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#6366f1,#4f46e5)',
]
const gradOf = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return GRADS[h % GRADS.length]
}
const initials = (s: string) =>
  s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

export function AllocateCsa() {
  const { profile, branchId, branches } = useAuth()
  const toast = useToast()

  const [allocations, setAllocations] = useState<CsaAllocation[]>([])
  const [csas, setCsas] = useState<RoleMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const branchName = branches.find((b) => b.id === branchId)?.branch_name ?? profile?.branch

  useEffect(() => {
    let on = true
    const run = async () => {
      if (!branchId || !profile) return
      setLoading(true)
      setError(null)
      try {
        const [data, csaList] = await Promise.all([
          getCsaAllocations(branchId, profile.id),
          getCsas({ active: true }),
        ])
        if (on) {
          setAllocations(data.allocations)
          setCsas(csaList)
        }
      } catch (e: unknown) {
        if (on) setError(e instanceof Error ? e.message : 'Failed to load CSA allocations')
      } finally {
        if (on) setLoading(false)
      }
    }
    void run()
    return () => { on = false }
  }, [branchId, profile])

  // A row counts as assigned only when it resolves to a real CSA (has a name).
  // A csa_user_id pointing at a deleted user has no name and is treated as unassigned.
  const isAssigned = (a: CsaAllocation) => !!a.csa_user_id && !!a.csa_name

  const assignedCount = allocations.filter(isAssigned).length
  const unassignedCount = allocations.length - assignedCount

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allocations.filter((a) => {
      const assigned = !!a.csa_user_id && !!a.csa_name
      if (filter === 'assigned' && !assigned) return false
      if (filter === 'unassigned' && assigned) return false
      if (!q) return true
      return a.insurer_name.toLowerCase().includes(q) || (a.csa_name ?? '').toLowerCase().includes(q)
    })
  }, [allocations, search, filter])

  const change = async (row: CsaAllocation, csaUserId: string) => {
    if (!branchId || !profile) return
    const newId = csaUserId || null
    setSavingId(row.insurance_company_id)
    try {
      const msg = await updateCsaAllocation({
        insuranceCompanyId: row.insurance_company_id,
        branchId,
        csaUserId: newId,
        userId: profile.id,
      })
      const csa = csas.find((c) => c.id === newId)
      setAllocations((list) =>
        list.map((a) =>
          a.insurance_company_id === row.insurance_company_id
            ? { ...a, csa_user_id: newId, csa_name: csa?.name ?? null }
            : a,
        ),
      )
      toast(msg, 'success')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Allocate CSA</h1>
          <div className="muted">
            Map a CSA to each insurer for {branchName}. New claims for an insurer are auto-assigned its CSA.
          </div>
        </div>
      </div>

      {!loading && !error && (
        <div className="csa-toolbar">
          <div className="search csa-searchbox">
            <span className="search-icon" aria-hidden><IconSearch size={17} /></span>
            <input placeholder="Search insurers or CSAs…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="csa-chips">
            {([['all', 'All', allocations.length], ['assigned', 'Assigned', assignedCount], ['unassigned', 'Unassigned', unassignedCount]] as const).map(([m, label, n]) => (
              <button key={m} className={`csa-chip${filter === m ? ' active' : ''}`} onClick={() => setFilter(m)}>
                {label}<span className="csa-chip-n">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <Loader label="Loading CSA allocations…" />
        ) : error ? (
          <div className="login-error">{error}</div>
        ) : (
          <table className="csa-table">
            <colgroup>
              <col style={{ width: '55%' }} />
              <col style={{ width: '45%' }} />
            </colgroup>
            <thead>
              <tr><th>Insurer</th><th>Assigned CSA</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td className="csa-empty" colSpan={2}>No insurers found.</td></tr>}
              {filtered.map((a) => {
                const assigned = isAssigned(a)
                const knownCsa = !!a.csa_user_id && csas.some((c) => c.id === a.csa_user_id)
                return (
                <tr key={a.insurance_company_id}>
                  <td className="csa-insurer">
                    <span className="csa-avatar" style={{ background: gradOf(a.insurer_name) }}>{initials(a.insurer_name)}</span>
                    <span className="csa-insurer-name">{a.insurer_name}</span>
                    {assigned ? <span className="csa-dot on" title="Assigned" /> : <span className="csa-dot off" title="Unassigned" />}
                  </td>
                  <td>
                    <select
                      className={`csa-select${assigned ? ' assigned' : ''}`}
                      value={assigned ? (a.csa_user_id ?? '') : ''}
                      disabled={savingId === a.insurance_company_id}
                      onChange={(e) => change(a, e.target.value)}
                    >
                      <option value="">— Unassigned —</option>
                      {assigned && !knownCsa && (
                        <option value={a.csa_user_id ?? ''}>{a.csa_name}</option>
                      )}
                      {csas.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
