import { useEffect, useMemo, useState } from 'react'
import { db } from '../features/offline/db'
import { ensureAudioBlob } from '../lib/audio'

export default function FishRunSummary({ runId }: { runId: string }) {
  const [data, setData] = useState<any>({})
  useEffect(() => {
    const load = async () => {
      const run = await (db as any).fishRuns.get(runId)
      const stops = await (db as any).fishStops.where('runId').equals(runId).sortBy('seq')
      const audio = await db.audioNotes.where('jobId').equals(runId).toArray()
      setData({ run, stops, audio })
    }
    load()
  }, [runId])
  return (
    <div className="grid" id="printable-map">
      <div className="row"><button className="btn" onClick={() => window.print()}>Print / Save as PDF</button></div>
      <section className="card">
        <h3>Fish Run</h3>
        <div><strong>{data.run?.title || '(untitled)'}</strong></div>
        <div className="muted">Planned: {data.run?.plannedAt || '-'}</div>
        {data.run?.notes && <div style={{ marginTop: 8 }}>{data.run.notes}</div>}
      </section>
      <section className="card">
        <h3>Stops</h3>
        {data.stops?.length ? (
          <table className="table">
            <thead><tr><th>#</th><th>Client</th><th>Site</th><th>Species</th><th>Count</th><th>Weight (lb)</th><th>Tank Temp</th><th>Pond Temp</th></tr></thead>
            <tbody>
              {data.stops.map((s: any) => (
                <tr key={s.id}>
                  <td>{s.seq}</td>
                  <td>{s.client || '-'}</td>
                  <td>{s.site || '-'}</td>
                  <td>{s.species || '-'}</td>
                  <td>{s.count ?? '-'}</td>
                  <td>{s.weightLb ?? '-'}</td>
                  <td>{s.tankTempF ?? '-'}</td>
                  <td>{s.pondTempF ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="muted">No stops</div>}
      </section>
      <section className="card">
        <h3>Voice Memos</h3>
        {data.audio?.length ? (
          <ul className="list">
            {data.audio.map((a: any) => (
              <li key={a.id}>
                <small className="muted">{new Date(a.createdAt).toLocaleString()} {a.stopId ? `(Stop #${data.stops?.find((s:any)=>s.id===a.stopId)?.seq || '?'})` : ''}</small>
                <div><MemoAudio note={a} /></div>
              </li>
            ))}
          </ul>
        ) : <div className="muted">No memos</div>}
      </section>
    </div>
  )
}

function MemoAudio({ note }: { note: any }) {
  const blob = useMemo(() => ensureAudioBlob(note), [note])
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (!blob || !url) {
    return <span className="muted">Audio unavailable</span>
  }
  const type = blob.type || note?.mimeType || 'audio/webm'
  return (
    <audio controls>
      <source src={url} type={type} />
    </audio>
  )
}
