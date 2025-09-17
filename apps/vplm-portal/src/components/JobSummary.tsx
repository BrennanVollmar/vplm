import { useEffect, useState } from 'react'
import { db } from '../features/offline/db'

export default function JobSummary({ jobId }: { jobId: string }) {
  const [data, setData] = useState<any>({})
  useEffect(() => {
    const load = async () => {
      const [job, notes, photos, measurements, waterQuality, audioNotes, depthPoints] = await Promise.all([
        db.jobs.get(jobId),
        db.notes.where('jobId').equals(jobId).toArray(),
        db.photos.where('jobId').equals(jobId).toArray(),
        db.measurements.where('jobId').equals(jobId).toArray(),
        db.waterQuality.where('jobId').equals(jobId).toArray(),
        db.audioNotes.where('jobId').equals(jobId).toArray(),
        (db as any).depthPoints?.where('jobId').equals(jobId).toArray() ?? Promise.resolve([]),
      ])
      setData({ job, notes, photos, measurements, waterQuality, audioNotes, depthPoints })
    }
    load()
  }, [jobId])

  function printSummary() {
    window.print()
  }

  return (
    <div className="grid">
      <div className="row">
        <button className="btn" onClick={printSummary}>Print / Save as PDF</button>
      </div>
      <section className="card">
        <h3>Job</h3>
        <div>{data.job?.clientName} {data.job?.siteName ? ' - ' + data.job.siteName : ''}</div>
        <div className="muted">
          {data.job?.createdAt && <span>Created {new Date(data.job.createdAt).toLocaleString()}</span>}
          {data.job?.createdBy && <span style={{ marginLeft: 12 }}>by {data.job.createdBy}</span>}
          {typeof data.job?.lat === 'number' && typeof data.job?.lon === 'number' && (
            <span style={{ marginLeft: 12 }}>(lat {data.job.lat.toFixed(5)}, lon {data.job.lon.toFixed(5)})</span>
          )}
        </div>
      </section>
      <section className="card">
        <h3>Notes</h3>
        {data.notes?.length ? (
          <ul className="list">{data.notes.map((n: any) => <li key={n.id}>{n.text}</li>)}</ul>
        ) : <div className="muted">No notes</div>}
      </section>
      <section className="card">
        <h3>Audio Notes</h3>
        {data.audioNotes?.length ? (
          <ul className="list">
            {data.audioNotes.map((a: any) => (
              <li key={a.id}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <small className="muted">{new Date(a.createdAt).toLocaleString()}</small>
                  {a.transcript ? (
                    <div><strong>Transcript:</strong> {a.transcript}</div>
                  ) : (
                    <div className="muted">(No transcript)</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : <div className="muted">No audio notes</div>}
      </section>
      <section className="card">
        <h3>Measurements</h3>
        {data.measurements?.length ? (
          <ul className="list">{data.measurements.map((m: any) => <li key={m.id}>{m.kind}: {m.value} {m.unit}</li>)}</ul>
        ) : <div className="muted">No measurements</div>}
      </section>
      <section className="card">
        <h3>Water Quality</h3>
        {data.waterQuality?.length ? (
          <ul className="list">{data.waterQuality.map((w: any) => <li key={w.id}>{w.kind}: {w.value} {w.unit}{w.depthFt ? ` @ ${w.depthFt} ft` : ''}</li>)}</ul>
        ) : <div className="muted">No entries</div>}
      </section>
      <section className="card">
        <h3>Depth Points</h3>
        {data.depthPoints?.length ? (
          <ul className="list">{data.depthPoints.map((d: any) => (
            <li key={d.id}>{d.depthFt} ft at ({d.lat.toFixed(5)}, {d.lon.toFixed(5)})</li>
          ))}</ul>
        ) : <div className="muted">No depth points</div>}
      </section>
      <section className="card">
        <h3>Photos</h3>
        {data.photos?.length ? (
          <div className="row">{data.photos.map((p: any) => <img key={p.id} className="rounded" src={p.serverUri || (p.blob ? URL.createObjectURL(p.blob) : p.localUri)} alt="photo" style={{ width: 120, height: 120, objectFit: 'cover' }} />)}</div>
        ) : <div className="muted">No photos</div>}
      </section>
    </div>
  )
}
