import { useEffect, useState } from 'react'
import { getTimeEntries, startTimeEntry, stopTimeEntry } from '../features/offline/db'

export default function TimePage() {
  const [jobId, setJobId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [rows, setRows] = useState<any[]>([])

  async function load() { if (!jobId) return; setRows(await getTimeEntries(jobId)) }
  useEffect(() => { load() }, [jobId])

  async function clockIn() {
    if (!jobId) return
    try {
      await startTimeEntry(jobId, date)
      await load()
    } catch (error: any) {
      alert(error?.message || 'Could not clock in.')
    }
  }
  async function clockOut() {
    if (!jobId) return
    try {
      await stopTimeEntry(jobId)
      await load()
    } catch (error: any) {
      alert(error?.message || 'No active clock-in to close.')
    }
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
            <thead><tr><th>#</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Duration</th></tr></thead>
            <tbody>
              {(() => {
                const ordered = [...rows].sort((a, b) => new Date(b.arrivalAt).getTime() - new Date(a.arrivalAt).getTime())
                return ordered.map((r, idx) => {
                  const durMs = r.departureAt ? new Date(r.departureAt).getTime() - new Date(r.arrivalAt).getTime() : 0
                  const hrs = durMs > 0 ? Math.floor(durMs / 3600000) : 0
                  let mins = durMs > 0 ? Math.round((durMs % 3600000) / 60000) : 0
                  let displayHrs = hrs
                  if (mins === 60) {
                    displayHrs += 1
                    mins = 0
                  }
                  const durationLabel = durMs > 0 ? `${displayHrs}h ${String(mins).padStart(2, '0')}m` : 'In progress'
                  const indexLabel = ordered.length - idx
                  return (
                    <tr key={r.id}>
                      <td>{indexLabel}</td>
                      <td>{r.date}</td>
                      <td>{new Date(r.arrivalAt).toLocaleString()}</td>
                      <td>{r.departureAt ? new Date(r.departureAt).toLocaleString() : '-'}</td>
                      <td>{durationLabel}</td>
                    </tr>
                  )
                })
              })()}
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td>
                <td>{formatTotalDuration(rows)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function formatTotalDuration(rows: any[]) {
  const totalMs = rows.reduce((sum, row) => {
    if (!row.departureAt) return sum
    const diff = new Date(row.departureAt).getTime() - new Date(row.arrivalAt).getTime()
    return diff > 0 ? sum + diff : sum
  }, 0)
  if (totalMs <= 0) return '0h 00m'
  let hrs = Math.floor(totalMs / 3600000)
  let mins = Math.round((totalMs % 3600000) / 60000)
  if (mins === 60) {
    hrs += 1
    mins = 0
  }
  return `${hrs}h ${String(mins).padStart(2, '0')}m`
}
