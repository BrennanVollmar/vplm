import { useEffect, useState } from 'react'
import { db } from '../features/offline/db'
import { generateExport } from '../utils/exportData'
import { importFromFile } from '../utils/importData'

export default function OfflinePage() {
  const [counts, setCounts] = useState<{ [k: string]: number }>({})
  const [exporting, setExporting] = useState(false)
  const [includeMedia, setIncludeMedia] = useState(true)
  const [importing, setImporting] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    const load = async () => {
      const [jobs, notes, photos, measurements, outbox] = await Promise.all([
        db.jobs.count(), db.notes.count(), db.photos.count(), db.measurements.count(), db.outbox.count()
      ])
      setCounts({ jobs, notes, photos, measurements, outbox } as any)
    }
    load()
  }, [])

  return (
    <div className="grid">
      <div>
        <div className="card" style={{ marginBottom: 8 }}><h2>Offline</h2></div>
        <div>
          <div className="accordion">
            <section className="accordion-item accent-green">
              <button className="accordion-button" aria-expanded={true} aria-controls="panel-offline" id="btn-offline">
                <span>Offline Data</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div id="panel-offline" role="region" aria-labelledby="btn-offline" className="accordion-panel">
                <ul className="list">
                  <li>Jobs: {counts.jobs ?? 0}</li>
                  <li>Notes: {counts.notes ?? 0}</li>
                  <li>Photos: {counts.photos ?? 0}</li>
                  <li>Measurements: {counts.measurements ?? 0}</li>
                  <li>Outbox: {counts.outbox ?? 0}</li>
                </ul>
              </div>
            </section>
            <section className="accordion-item accent-cyan">
              <button className="accordion-button" aria-expanded={true} aria-controls="panel-export" id="btn-export">
                <span>Export</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div id="panel-export" role="region" aria-labelledby="btn-export" className="accordion-panel">
                <div className="row">
                  <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={includeMedia} onChange={(e) => setIncludeMedia(e.target.checked)} /> Include media (photos, labels)</label>
                  <button className="btn" disabled={exporting} onClick={async () => {
                    setExporting(true)
                    try {
                      const { url } = await generateExport(includeMedia)
                      const a = document.createElement('a')
                      const ts = new Date().toISOString().replace(/[:.]/g, '-')
                      a.href = url
                      a.download = `tpm-export-${ts}.json`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                    } finally {
                      setExporting(false)
                    }
                  }}>{exporting ? 'Preparing...' : 'Export data'}</button>
                </div>
              </div>
            </section>
            <section className="accordion-item accent-amber">
              <button className="accordion-button" aria-expanded={true} aria-controls="panel-import" id="btn-import">
                <span>Import</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div id="panel-import" role="region" aria-labelledby="btn-import" className="accordion-panel">
                <p className="muted">Restore from a previously exported TPM JSON file. This merges data into your current offline database.</p>
                <div className="row">
                  <input className="input" type="file" accept="application/json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <button className="btn secondary" disabled={!file || importing} onClick={async () => {
                    if (!file) return
                    setImporting(true)
                    try {
                      await importFromFile(file)
                      const [jobs, notes, photos, measurements, outbox] = await Promise.all([
                        db.jobs.count(), db.notes.count(), db.photos.count(), db.measurements.count(), db.outbox.count()
                      ])
                      setCounts({ jobs, notes, photos, measurements, outbox } as any)
                      alert('Import complete')
                    } catch (e: any) {
                      alert('Import failed: ' + (e?.message || e))
                    } finally {
                      setImporting(false)
                    }
                  }}>{importing ? 'Importing...' : 'Import data'}</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

