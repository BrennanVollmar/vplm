import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../features/offline/db'

type Result = { type: 'job' | 'note'; id: string; label: string; href: string }

export default function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Result[]>([])

  useEffect(() => {
    let active = true
    const run = async () => {
      const term = q.trim().toLowerCase()
      if (!term) { setResults([]); return }
      const [jobs, notes] = await Promise.all([db.jobs.toArray(), db.notes.toArray()])
      const j = jobs
        .filter((x: any) => [x.clientName, x.siteName, x.address, x.createdBy].some((f) => (f || '').toLowerCase().includes(term)))
        .slice(0, 5)
        .map((x: any) => ({ type: 'job', id: x.id, label: `${x.clientName}${x.siteName ? ' - ' + x.siteName : ''}`, href: `/job/${x.id}` }))
      const n = notes
        .filter((x: any) => (x.text || '').toLowerCase().includes(term))
        .slice(0, 5)
        .map((x: any) => ({ type: 'note', id: x.id, label: x.text.slice(0, 60), href: `/job/${x.jobId}` }))
      if (active) setResults([...j, ...n].slice(0, 8))
    }
    run()
    return () => { active = false }
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.('.search')) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  return (
    <div className="search">
      <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} placeholder="Search jobs and notes" />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <Link key={r.id} to={r.href} onClick={() => { setOpen(false); setQ('') }}>
              [{r.type}] {r.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

