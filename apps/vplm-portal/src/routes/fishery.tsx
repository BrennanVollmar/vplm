import { useEffect, useState } from 'react'
import { db, addFishCount, endFishSession, getFishCounts, startFishSession, type FishSession, logJob, getActor } from '../features/offline/db'

export default function FisheryPage() {
  const [session, setSession] = useState<FishSession | null>(null)
  const [counts, setCounts] = useState<{ [k: string]: number }>({})
  const [jobId, setJobId] = useState('')
  const [species, setSpecies] = useState<string[]>(['Largemouth Bass','Bluegill','Redear','Crappie','Catfish','Shad'])
  const [newSpecies, setNewSpecies] = useState('')
  const [history, setHistory] = useState<FishSession[]>([])

  useEffect(() => { (async () => { if (session) await refresh() })() }, [session])

  async function refresh() {
    if (!session) return
    const rows = await getFishCounts(session.id)
    const map: any = {}
    for (const r of rows) map[r.species] = r.count
    setCounts(map)
  }

  useEffect(() => { (async () => { setHistory(await db.fishSessions.orderBy('startedAt').reverse().toArray()) })() }, [session])

  async function start() { if (!jobId) { alert('Enter Job ID'); return } const s = await startFishSession(jobId); setSession(s); setCounts({}); await logJob(jobId, 'fishery_start', 'Started fishery session', getActor()); setHistory(await db.fishSessions.orderBy('startedAt').reverse().toArray()) }
  async function stop() { if (!session) return; await endFishSession(session.id); if (session.jobId) await logJob(session.jobId, 'fishery_end', 'Ended fishery session', getActor()); setSession(null); setHistory(await db.fishSessions.orderBy('startedAt').reverse().toArray()) }

  async function inc(sp: string, d: number) { if (!session) return; await addFishCount(session.id, sp, d); if (session.jobId) await logJob(session.jobId, 'fishery_count', `Adjusted ${sp} by ${d}`, getActor()); await refresh() }

  function addCustom() { const t = newSpecies.trim(); if (!t) return; if (!species.includes(t)) setSpecies((arr) => [...arr, t]); setNewSpecies('') }

  return (
    <div className="grid">
      <section className="card">
        <h2>Fishery Study</h2>
        <div className="row">
          <input className="input" placeholder="Job ID" value={jobId} onChange={(e) => setJobId(e.target.value)} />
          {!session ? <button className="btn" onClick={start}>Start Session</button> : <button className="btn warn" onClick={stop}>End Session</button>}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input" placeholder="Add species" value={newSpecies} onChange={(e) => setNewSpecies(e.target.value)} />
          <button className="btn secondary" onClick={addCustom}>Add</button>
        </div>
      </section>
      {session && (
        <section className="card">
          <h3>Tap to Count</h3>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {species.map((sp) => (
              <div key={sp} className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 800 }}>{sp}</div>
                <div style={{ fontSize: 24, margin: '6px 0' }}>{counts[sp] || 0}</div>
                <div className="row">
                  <button className="btn" onClick={() => inc(sp, 1)}>+1</button>
                  <button className="btn secondary" onClick={() => inc(sp, -1)}>-1</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="card">
        <h3>Previous Sessions</h3>
        {history.length === 0 ? <div className="muted">No sessions</div> : (
          <ul className="list">
            {history.map(s => (
              <li key={s.id}>
                <button className="btn secondary" onClick={async () => { setSession(s); await refresh() }}>Open</button>
                <span style={{ marginLeft: 8 }}>Job {s.jobId || '(none)'} — {new Date(s.startedAt).toLocaleString()} {s.endedAt ? 'to ' + new Date(s.endedAt).toLocaleString() : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
