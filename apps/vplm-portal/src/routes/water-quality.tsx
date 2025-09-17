import { useEffect, useMemo, useState } from 'react'
import { db, type WaterQualityEntry } from '../features/offline/db'

export default function WaterQualityPage() {
  const [rows, setRows] = useState<WaterQualityEntry[]>([])
  const [kind, setKind] = useState<string>('')
  const [job, setJob] = useState<string>('')

  useEffect(() => { (async () => {
    const all = await db.waterQuality.toArray()
    setRows(all)
  })() }, [])

  const list = useMemo(() => rows.filter(r => (kind ? r.kind === kind : true) && (job ? r.jobId.includes(job) : true)), [rows, kind, job])

  return (
    <div className="grid">
      <section className="card">
        <h2>Water Quality</h2>
        <div className="row">
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All kinds</option>
            <option value="secchi">Secchi</option>
            <option value="ph">pH</option>
            <option value="do">Dissolved O2</option>
            <option value="temp">Temperature</option>
            <option value="alkalinity">Alkalinity</option>
            <option value="hardness">Hardness</option>
          </select>
          <input className="input" placeholder="Filter by Job ID" value={job} onChange={(e) => setJob(e.target.value)} />
        </div>
      </section>
      <section className="card">
        {list.length === 0 ? <div className="muted">No data</div> : (
          <table className="table">
            <thead><tr><th>Job</th><th>Kind</th><th>Value</th><th>Unit</th><th>Depth (ft)</th><th>Date</th></tr></thead>
            <tbody>
              {list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map((w) => (
                <tr key={w.id}><td>{w.jobId}</td><td>{w.kind}</td><td>{w.value}</td><td>{w.unit}</td><td>{w.depthFt || '-'}</td><td>{new Date(w.createdAt).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

