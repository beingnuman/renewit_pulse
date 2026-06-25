export function Placeholder({ title }: { title: string }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="muted">This section is part of the Bubble → React migration and is coming soon.</div>
        </div>
      </div>
      <div className="table-card">
        <div className="empty">🚧 {title} — not yet migrated.</div>
      </div>
    </div>
  )
}
