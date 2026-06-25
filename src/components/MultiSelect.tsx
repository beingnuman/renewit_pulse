import { useEffect, useMemo, useRef, useState } from 'react'

export interface MSOption {
  id: string
  label: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Search…',
}: {
  options: MSOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter((o) => !selected.includes(o.id) && (!q || o.label.toLowerCase().includes(q)))
  }, [options, selected, query])

  const add = (id: string) => {
    onChange([...selected, id])
    setQuery('')
  }
  const remove = (id: string) => onChange(selected.filter((x) => x !== id))

  return (
    <div className="ms" ref={ref}>
      <div className="ms-control" onClick={() => setOpen(true)}>
        {selected.map((id) => (
          <span key={id} className="ms-chip">
            {byId.get(id) ?? id}
            <button type="button" className="ms-x" onClick={(e) => { e.stopPropagation(); remove(id) }} aria-label="Remove">✕</button>
          </span>
        ))}
        <input
          className="ms-input"
          value={query}
          placeholder={selected.length ? '' : placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="ms-menu">
          {filtered.length === 0 ? (
            <div className="ms-empty">{options.length === selected.length ? 'All selected' : 'No matches'}</div>
          ) : (
            filtered.map((o) => (
              <button key={o.id} type="button" className="ms-option" onClick={() => add(o.id)}>
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
