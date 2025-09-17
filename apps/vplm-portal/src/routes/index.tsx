import { Link, useNavigate } from 'react-router-dom'
// import CalcPanel from '../components/CalcPanel'
import JobForm from '../components/JobForm'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../features/offline/db'
import Accordion from '../components/Accordion'

export default function Dashboard() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<any[]>([])
  const [employeeFilter, setEmployeeFilter] = useState('')

  useEffect(() => {
    const load = async () => setJobs(await db.jobs.toArray())
    load()
  }, [])

  const filtered = useMemo(() => {
    const list = jobs.filter((j) => employeeFilter ? (j.createdBy || '').toLowerCase().includes(employeeFilter.toLowerCase()) : true)
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [jobs, employeeFilter])

  return (
    <div className="grid">
      <Accordion
        items={[
          { label: 'New Job', accent: 'green', startOpen: true, content: <div className="card"><JobForm onCreated={(id) => navigate(`/job/${id}`)} /></div> },
          { label: 'Recent Jobs', accent: 'amber', content: (
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}>
                <label className="label">Filter by employee
                  <input className="input" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} placeholder="Employee name" />
                </label>
              </div>
              {filtered.length === 0 ? <p className="muted">No jobs yet.</p> : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Site</th>
                      <th>Created</th>
                      <th>Employee</th>
                      <th>Location</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((j) => (
                      <tr key={j.id}>
                        <td><Link to={`/job/${j.id}`}>{j.clientName}</Link></td>
                        <td>{j.siteName || '-'}</td>
                        <td>{new Date(j.createdAt).toLocaleString()}</td>
                        <td>{j.createdBy || '-'}</td>
                        <td>{typeof j.lat === 'number' && typeof j.lon === 'number' ? `${j.lat.toFixed(5)}, ${j.lon.toFixed(5)}` : '-'}</td>
                        <td>
                          <Link className="btn secondary" to={`/job/${j.id}/summary`}>Summary</Link>
                          <button className="btn warn" style={{ marginLeft: 6 }} onClick={() => deleteJobCascade(j.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) },
        ]}
      />
    </div>
  )
}

async function deleteJobCascade(jobId: string) {
  if (!confirm('Delete this job and all related notes, photos, measurements, etc.?')) return
  await db.notes.where('jobId').equals(jobId).delete()
  await db.photos.where('jobId').equals(jobId).delete()
  await db.measurements.where('jobId').equals(jobId).delete()
  await db.waterQuality.where('jobId').equals(jobId).delete()
  await db.tracks.where('jobId').equals(jobId).delete()
  await db.checklists.where('jobId').equals(jobId).delete()
  await db.audioNotes.where('jobId').equals(jobId).delete()
  if ((db as any).depthPoints) await (db as any).depthPoints.where('jobId').equals(jobId).delete()
  if ((db as any).ponds) await (db as any).ponds.where('jobId').equals(jobId).delete()
  if (db.jobLogs) await (db as any).jobLogs.where('jobId').equals(jobId).delete()
  await db.jobs.delete(jobId)
  location.reload()
}
