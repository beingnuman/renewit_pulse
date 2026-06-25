import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth'
import { BranchSwitcher } from './BranchSwitcher'
import { IconCamera } from './icons'

function Avatar({ url, name, size = 36 }: { url: string | null; name?: string; size?: number }) {
  if (url) {
    return <img className="avatar-img" src={url} alt={name ?? 'avatar'} width={size} height={size} />
  }
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {name?.[0]?.toUpperCase() ?? 'U'}
    </div>
  )
}

export function UserMenu() {
  const { profile, updateAvatar } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Image must be under 5 MB.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      await updateAvatar(file)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="userbox" ref={ref}>
      <button className="userbox-trigger" onClick={() => setOpen((o) => !o)} title="Account">
        <Avatar url={profile?.avatarUrl ?? null} name={profile?.name} />
        <span className="userbox-meta">
          <span className="uname">{profile?.name ?? 'User'}</span>
          <span className="urole">{profile?.role ?? ''}</span>
        </span>
      </button>

      <BranchSwitcher />

      {open && (
        <div className="account-menu">
          <div className="account-head">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
            <button
              className="account-avatar"
              onClick={() => !busy && fileRef.current?.click()}
              disabled={busy}
              title={profile?.avatarUrl ? 'Replace photo' : 'Add photo'}
            >
              <Avatar url={profile?.avatarUrl ?? null} name={profile?.name} size={56} />
              <span className="account-avatar-overlay">
                {busy ? <span className="spinner" /> : <IconCamera size={18} />}
              </span>
            </button>
            <div className="account-id">
              <div className="account-name">{profile?.name ?? 'User'}</div>
              <div className="account-email">{profile?.email ?? '—'}</div>
              <div className="account-role">{profile?.role}</div>
            </div>
          </div>

          <div className="account-branch">
            <span className="account-label">Branch</span>
            <span className="account-value">{profile?.branch}</span>
          </div>

          {err && <div className="account-error">{err}</div>}
        </div>
      )}
    </div>
  )
}
