import { useState, type ReactNode } from 'react'
import { IconChevron } from './icons'

export function Panel({
  title,
  icon,
  right,
  children,
  defaultOpen = true,
}: {
  title: string
  icon?: ReactNode
  right?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="panel">
      <header className="panel-head">
        <button className="panel-toggle" onClick={() => setOpen((o) => !o)}>
          {icon && <span className="panel-icon">{icon}</span>}
          <span className="panel-title">{title}</span>
        </button>
        <div className="panel-right">
          {right}
          <button
            className={`panel-chev${open ? ' open' : ''}`}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            <IconChevron size={18} />
          </button>
        </div>
      </header>
      {open && <div className="panel-body">{children}</div>}
    </section>
  )
}
