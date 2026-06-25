import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth'
import { IconChevron } from './icons'
import { logoFor } from './logos'
import { updateUserBranch } from '../lib/api'

export function BranchSwitcher() {
  const { branches, branchId, setBranchId, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [switch_, setSwitch] = useState<{ from: string; to: string } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (branches.length === 0) return null

  const current = branches.find((b) => b.id === branchId)
  const label = current?.branch_name ?? 'Select branch'
  const switchable = branches.length > 1

  const switchBranch = async (id: string, name: string) => {
    if (id === branchId) {
      setOpen(false)
      return
    }
    setOpen(false)
    setSwitch({ from: current?.branch_name ?? 'Renew-it', to: name })
    setBranchId(id) // persisted to localStorage by AuthProvider
    // Admins roam branches: persist the active branch so backend claim access
    // scopes to it. Non-admins already have backend access to their branches.
    if (profile?.isAdmin) {
      try {
        await updateUserBranch(profile.id, id)
      } catch {
        /* fall through to reload anyway */
      }
    }
    // let the overlay show, then hard-reload the whole CRM onto the dashboard
    setTimeout(() => {
      window.location.assign('/dashboard')
    }, 700)
  }

  return (
    <div className="branch-switcher" ref={ref}>
      <button
        className="branch-trigger"
        onClick={() => switchable && setOpen((o) => !o)}
        disabled={!switchable}
        title={switchable ? 'Switch branch' : label}
      >
        <span className="branch-name">{label}</span>
        {switchable && (
          <span className={`branch-chev${open ? ' open' : ''}`} aria-hidden>
            <IconChevron size={13} />
          </span>
        )}
      </button>

      {open && (
        <div className="branch-menu" role="listbox">
          <div className="branch-menu-head">Switch branch</div>
          {branches.map((b) => (
            <button
              key={b.id}
              role="option"
              aria-selected={b.id === branchId}
              className={`branch-option${b.id === branchId ? ' active' : ''}`}
              onClick={() => switchBranch(b.id, b.branch_name)}
            >
              <span className="branch-option-name">{b.branch_name}</span>
              <span className="branch-option-code">{b.branch_code}</span>
            </button>
          ))}
        </div>
      )}

      {switch_ && (
        <div className="switch-overlay">
          <div className="switch-card">
            <div className="switch-row">
              <div className="switch-branch">
                <img className="switch-logo" src={logoFor(switch_.from)} alt={switch_.from} />
                <span>{switch_.from}</span>
              </div>
              <span className="switch-arrow" aria-hidden>→</span>
              <div className="switch-branch to">
                <img className="switch-logo" src={logoFor(switch_.to)} alt={switch_.to} />
                <span>{switch_.to}</span>
              </div>
            </div>
            <div className="switch-bar"><span /></div>
            <div className="switch-text">Switching branch…</div>
          </div>
        </div>
      )}
    </div>
  )
}
