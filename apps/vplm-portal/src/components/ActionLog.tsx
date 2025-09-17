import { useEffect, useState } from 'react'
import { getJobLogs } from '../features/offline/db'

export default function ActionLog({ jobId }: { jobId: string }) {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { (async () => setRows(await getJobLogs(jobId)))() }, [jobId])
  if (rows.length === 0) return <div className="muted">No activity yet</div>
  return (
    <table className="table">
      <thead><tr><th>Time</th><th>Actor</th><th>Action</th></tr></thead>
      <tbody>
        {rows.sort((a,b)=>b.ts.localeCompare(a.ts)).map((r) => (
          <tr key={r.id}><td>{new Date(r.ts).toLocaleString()}</td><td>{r.actor || '-'}</td><td>{r.message}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

