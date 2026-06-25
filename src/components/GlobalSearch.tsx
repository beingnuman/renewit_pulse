import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { globalSearchPredictive, type SearchResult } from '../lib/api'
import { IconSearch } from './icons'

export function GlobalSearch() {
  const navigate = useNavigate()
  const { branchId } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = q.trim()
    let on = true
    const t = setTimeout(async () => {
      if (term.length < 2) { if (on) { setResults([]); setLoading(false) }; return }
      if (on) setLoading(true)
      try {
        const r = await globalSearchPredictive(term, branchId, 12)
        if (on) { setResults(r); setOpen(true) }
      } catch {
        if (on) setResults([])
      } finally {
        if (on) setLoading(false)
      }
    }, term.length < 2 ? 0 : 250)
    return () => { on = false; clearTimeout(t) }
  }, [q, branchId])

  const go = (r: SearchResult) => { setOpen(false); setQ(''); navigate(`/claim/${r.claimId}`) }
  const runFull = () => {
    const term = q.trim()
    if (!term) return
    setOpen(false)
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  return (
    <div className="search gsearch" ref={boxRef}>
      <span className="search-icon" aria-hidden><IconSearch size={17} /></span>
      <input
        placeholder="Search claims, customers, or vehicles..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true) }}
        onKeyDown={(e) => { if (e.key === 'Enter') runFull(); else if (e.key === 'Escape') setOpen(false) }}
      />
      <button className="search-go" aria-label="Search" onClick={runFull}>
        <IconSearch size={16} />
      </button>

      {open && (
        <>
          <div className="gsearch-backdrop" onClick={() => setOpen(false)} />
          <div className="gsearch-panel">
            {loading && results.length === 0 ? (
              <div className="gsearch-msg">Searching…</div>
            ) : results.length === 0 ? (
              <div className="gsearch-msg">No matches for “{q.trim()}”.</div>
            ) : (
              <>
                {results.map((r) => (
                  <button key={r.claimId} type="button" className="gsearch-item" onClick={() => go(r)}>
                    <span className="gsearch-dr">{r.drNumber || '—'}</span>
                    <div className="gsearch-mid">
                      <span className="gsearch-cust">{r.customer || r.registration || 'Claim'}</span>
                      <span className="gsearch-sub">
                        {r.registration ? `${r.registration} · ` : ''}{r.manufacturer ? `${r.manufacturer} · ` : ''}{r.status ?? ''}
                      </span>
                    </div>
                  </button>
                ))}
                <button type="button" className="gsearch-all" onClick={runFull}>
                  See all results for “{q.trim()}”
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
