import { useEffect, useRef, useState } from 'react'
import { IconSearch, IconChevron } from './icons'

export function SearchSelect({
  value, onChange, options, placeholder = 'Select…', disabled, error, emptyText = 'No matches',
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  error?: boolean
  emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const filtered = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()))

  const openMenu = () => { if (disabled) return; setQ(''); setOpen(true) }
  const pick = (o: string) => { onChange(o); setOpen(false) }

  return (
    <div className="ss">
      <button
        type="button"
        className={`nc-input ss-trigger${error ? ' nc-err' : ''}${!value ? ' ss-placeholder' : ''}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={disabled}
      >
        <span className="ss-value">{value || placeholder}</span>
        <span className="ss-chev"><IconChevron size={15} /></span>
      </button>

      {open && (
        <>
          <div className="ss-backdrop" onClick={() => setOpen(false)} />
          <div className="ss-panel">
            <div className="ss-search">
              <IconSearch size={14} />
              <input
                ref={inputRef}
                value={q}
                placeholder="Type to search…"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false)
                  else if (e.key === 'Enter' && filtered.length) { e.preventDefault(); pick(filtered[0]) }
                }}
              />
            </div>
            <div className="ss-list">
              {filtered.length === 0 ? (
                <div className="ss-empty">{emptyText}</div>
              ) : (
                filtered.map((o) => (
                  <button key={o} type="button" className={`ss-item${o === value ? ' on' : ''}`} onClick={() => pick(o)}>
                    {o}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
