import { useEffect, useMemo, useState } from 'react'
import { getTimeEntries, upsertTimeEntry } from '../features/offline/db'

export default function TimePage() {
  const [jobId, setJobId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [arrival, setArrival] = useState('')
  const [departure, setDeparture] = useState('')
  const [rows, setRows] = useState<any[]>([])

  async function load() { if (!jobId) return; setRows(await getTimeEntries(jobId)) }
  useEffect(() => { load() }, [jobId])

  async function clockIn() {
    if (!jobId) return
    const id = `${jobId}-${date}`
    await upsertTimeEntry({ id, jobId, date, arrivalAt: new Date().toISOString() })
    await load()
  }
  async function clockOut() {
    if (!jobId) return
    const id = `${jobId}-${date}`
    await upsertTimeEntry({ id, jobId, date, departureAt: new Date().toISOString() })
    await load()
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Site Time Tracking</h2>
        <div className="row">
          <input className="input" placeholder="Job ID" value={jobId} onChange={(e) => setJobId(e.target.value)} />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn" onClick={clockIn}>Clock In</button>
          <button className="btn secondary" onClick={clockOut}>Clock Out</button>
        </div>
      </section>
      <section className="card">
        <h3>Entries</h3>
        {rows.length === 0 ? <div className="muted">No entries</div> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Arrival</th><th>Departure</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}><td>{r.date}</td><td>{r.arrivalAt ? new Date(r.arrivalAt).toLocaleString() : '-'}</td><td>{r.departureAt ? new Date(r.departureAt).toLocaleString() : '-'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

