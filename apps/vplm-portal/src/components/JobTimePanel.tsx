import { useEffect, useState } from 'react'
import { getTimeEntries, upsertTimeEntry, logJob, getActor } from '../features/offline/db'

export default function JobTimePanel({ jobId }: { jobId: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { (async () => setRows(await getTimeEntries(jobId)))() }, [jobId])
  async function clockIn() { const id = `${jobId}-${date}`; await upsertTimeEntry({ id, jobId, date, arrivalAt: new Date().toISOString() }); await logJob(jobId, 'time_clock_in', `Clock in for ${date}`, getActor()); setRows(await getTimeEntries(jobId)) }
  async function clockOut() { const id = `${jobId}-${date}`; await upsertTimeEntry({ id, jobId, date, departureAt: new Date().toISOString() }); await logJob(jobId, 'time_clock_out', `Clock out for ${date}`, getActor()); setRows(await getTimeEntries(jobId)) }
  return (
    <div className="grid">
      <div className="row">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn" onClick={clockIn}>Clock In</button>
        <button className="btn secondary" onClick={clockOut}>Clock Out</button>
      </div>
      {rows.length === 0 ? <div className="muted">No time entries</div> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Arrival</th><th>Departure</th></tr></thead>
          <tbody>
            {rows.sort((a,b)=>b.date.localeCompare(a.date)).map(r => (
              <tr key={r.id}><td>{r.date}</td><td>{r.arrivalAt ? new Date(r.arrivalAt).toLocaleString() : '-'}</td><td>{r.departureAt ? new Date(r.departureAt).toLocaleString() : '-'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
