import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import { fetchDocumentLibrary, deleteDocument, formatFileSize, type DocItem } from '../lib/api'
import { Loader } from '../components/Loader'
import {
  IconSearch,
  IconExternal,
  IconTrash,
  IconFilePdf,
  IconListView,
  IconGridView,
} from '../components/icons'

const TABS: { type: string; label: string }[] = [
  { type: 'costing_sla', label: 'Costing SLAs' },
  { type: 'accident_claim', label: 'Accident Claims' },
  { type: 'costing_doc', label: 'Costing Documents' },
]

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export function Documents() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.isAdmin

  const [tab, setTab] = useState(TABS[0].type)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<DocItem | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const d = await fetchDocumentLibrary(tab, 'global', null)
        if (active) setDocs(d)
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load documents')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [tab])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((d) => d.file_name.toLowerCase().includes(q))
  }, [docs, search])

  const doDelete = async (doc: DocItem) => {
    setConfirm(null)
    setDeleting(doc.id)
    try {
      await deleteDocument(doc.id)
      setDocs((list) => list.filter((d) => d.id !== doc.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Document Library</h1>
          <div className="muted">Reference documents — SLAs, claim forms and costing files</div>
        </div>
      </div>

      <div className="doc-tabs">
        {TABS.map((t) => (
          <button
            key={t.type}
            className={`doc-tab${tab === t.type ? ' active' : ''}`}
            onClick={() => { setTab(t.type); setSearch('') }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rm-toolbar" style={{ marginTop: 16 }}>
        <div className="search rm-search">
          <span className="search-icon" aria-hidden><IconSearch size={17} /></span>
          <input placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="view-toggle">
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
            title="List view"
            aria-label="List view"
          >
            <IconListView size={18} />
          </button>
          <button
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
            title="Grid view"
            aria-label="Grid view"
          >
            <IconGridView size={18} />
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}

      {loading ? (
        <div className="table-card"><Loader label="Loading documents…" /></div>
      ) : filtered.length === 0 ? (
        <div className="table-card"><div className="empty">No documents found.</div></div>
      ) : view === 'grid' ? (
        <div className="doc-grid">
          {filtered.map((d) => (
            <div key={d.id} className="doc-card">
              <div className="doc-icon"><IconFilePdf size={22} /></div>
              <div className="doc-info">
                <div className="doc-name" title={d.file_name}>{d.file_name}</div>
                <div className="doc-meta">
                  {formatFileSize(d.file_size)} · {formatDate(d.created_at)}
                </div>
              </div>
              <div className="doc-actions">
                <a className="doc-view" href={d.file_url} target="_blank" rel="noopener noreferrer" title="View">
                  <IconExternal size={17} /> View
                </a>
                {isAdmin && (
                  <button
                    className="doc-del"
                    onClick={() => setConfirm(d)}
                    disabled={deleting === d.id}
                    title="Delete"
                    aria-label="Delete document"
                  >
                    <IconTrash size={17} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="doc-list">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="doc-row-name">
                        <span className="doc-row-icon"><IconFilePdf size={18} /></span>
                        <span className="doc-row-text" title={d.file_name}>{d.file_name}</span>
                      </div>
                    </td>
                    <td className="doc-row-meta">{formatFileSize(d.file_size)}</td>
                    <td className="doc-row-meta">{formatDate(d.created_at)}</td>
                    <td>
                      <div className="doc-row-actions">
                        <a className="doc-view sm" href={d.file_url} target="_blank" rel="noopener noreferrer">
                          <IconExternal size={15} /> View
                        </a>
                        {isAdmin && (
                          <button
                            className="doc-del"
                            onClick={() => setConfirm(d)}
                            disabled={deleting === d.id}
                            aria-label="Delete document"
                          >
                            <IconTrash size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete document?</div>
            <div className="modal-body">
              This will permanently remove <strong>{confirm.file_name}</strong> from the library.
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => doDelete(confirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
