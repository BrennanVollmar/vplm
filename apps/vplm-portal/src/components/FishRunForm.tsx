import { useEffect, useState, useRef } from 'react'
import { db, addFishStop, listFishStops, saveFishRun, updateFishStop, listFishRuns, deleteFishRun, saveAudioNote, type FishRun, type FishStop } from '../features/offline/db'
import L from 'leaflet'
import AddressAutocomplete from './AddressAutocomplete'
import type { AddressSuggestion } from '../lib/places'
import 'leaflet/dist/leaflet.css'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { ensureAudioBlob } from '../lib/audio'
import { normalizeLanguageTag } from '../lib/transcribe'

export default function FishRunForm() {
  const [run, setRun] = useState<FishRun>(() => ({ id: crypto.randomUUID(), title: '', createdAt: new Date().toISOString(), plannedAt: new Date().toISOString().slice(0,10) }))
  const [stops, setStops] = useState<FishStop[]>([])
  const [runs, setRuns] = useState<FishRun[]>([])
  const [expandedStops, setExpandedStops] = useState<string[]>([])
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const osmRef = useRef<L.TileLayer | null>(null)
  const aerialRef = useRef<L.TileLayer | null>(null)
  const [mapType, setMapType] = useState<'aerial' | 'street'>('aerial')
  const [pickerStopId, setPickerStopId] = useState<string | null>(null)
  const pickerStopIdRef = useRef<string | null>(null)
  const detailRefs = useRef<Record<string, HTMLDetailsElement | null>>({})
  const prevExpandedRef = useRef<string[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => { setSaved(false) }, [run])
  useEffect(() => { pickerStopIdRef.current = pickerStopId }, [pickerStopId])

  useEffect(() => {
    if (!pickerStopId) return
    setExpandedStops(prev => (prev.includes(pickerStopId) ? prev : [...prev, pickerStopId]))
  }, [pickerStopId])

  async function save() {
    await saveFishRun(run)
    setSaved(true)
    setRuns(await listFishRuns())
  }

  async function addStop() {
    const s: FishStop = { id: crypto.randomUUID(), runId: run.id, seq: stops.length + 1, createdAt: new Date().toISOString() }
    await addFishStop(s)
    setExpandedStops(prev => (prev.includes(s.id) ? prev : [...prev, s.id]))
    setStops(await listFishStops(run.id))
  }

  useEffect(() => { (async () => { setRuns(await listFishRuns()); setStops(await listFishStops(run.id)) })() }, [run.id])
  useEffect(() => {
    setExpandedStops(prev => {
      if (stops.length === 0) return []
      const ids = new Set(stops.map(s => s.id))
      const filtered = prev.filter(id => ids.has(id))
      if (filtered.length === 0) return [stops[stops.length - 1].id]
      if (filtered.length === prev.length && filtered.every((id, idx) => id === prev[idx])) return prev
      return filtered
    })
  }, [stops])

  useEffect(() => {
    const validIds = new Set(stops.map((s) => s.id))
    const refs = detailRefs.current
    Object.keys(refs).forEach((id) => {
      if (!validIds.has(id)) {
        refs[id] = null
      }
    })
  }, [stops])

  useEffect(() => {
    const prev = prevExpandedRef.current
    const newlyOpened = expandedStops.filter((id) => !prev.includes(id))
    if (newlyOpened.length > 0) {
      const anchorId = newlyOpened[newlyOpened.length - 1]
      const el = detailRefs.current[anchorId]
      if (el) {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
          })
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        }
      }
    }
    prevExpandedRef.current = [...expandedStops]
  }, [expandedStops])


  // Map preview of stops
  useEffect(() => {
    const map = mapRef.current
    if (!mapEl.current) return
    if (!mapRef.current) {
      const first = stops.find(s => typeof s.lat==='number' && typeof s.lon==='number')
      const center: [number, number] = first ? [first.lat as number, first.lon as number] : [30.2672, -97.7431]
      const m = L.map(mapEl.current).setView(center, first ? 12 : 6)
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(m)
      const aerial = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxZoom: 19, opacity: 0 })
      aerial.on('load', () => aerial.setOpacity(1))
      if (mapType === 'aerial') { (osm as any).bringToBack?.(); aerial.addTo(m) }
      L.control.scale({ imperial: true, metric: false }).addTo(m)
      mapRef.current = m; osmRef.current = osm; aerialRef.current = aerial
      m.on('click', async (e: any) => {
        const targetId = pickerStopIdRef.current
        if (!targetId) return
        await updateFishStop(targetId, { lat: e.latlng.lat, lon: e.latlng.lng })
        setStops(await listFishStops(run.id))
        setPickerStopId(null)
      })
      setTimeout(() => m.invalidateSize(), 150)
    } else {
      map.invalidateSize()
    }
    const m2 = mapRef.current!
    // Clear markers
    m2.eachLayer((layer: any) => { if (layer instanceof L.Marker || layer instanceof L.Polyline) m2.removeLayer(layer) })
    const pts: [number, number][] = []
    stops.forEach(s => { if (typeof s.lat==='number' && typeof s.lon==='number') { L.marker([s.lat!, s.lon!]).addTo(m2); pts.push([s.lat!, s.lon!]) } })
    if (pts.length >= 2) { L.polyline(pts, { color: '#0ea5e9' }).addTo(m2) }
    if (pts.length >= 1) { m2.fitBounds(L.latLngBounds(pts as any), { padding: [24,24] }) }
  }, [stops])

  // Switch base layer
  useEffect(() => {
    const m = mapRef.current
    if (!m || !osmRef.current || !aerialRef.current) return
    if (mapType === 'aerial') {
      aerialRef.current.addTo(m)
      aerialRef.current.setOpacity(0)
      aerialRef.current.once('load', () => aerialRef.current!.setOpacity(1))
      ;(osmRef.current as any).bringToBack?.()
    } else {
      try { m.removeLayer(aerialRef.current) } catch {}
      osmRef.current.addTo(m)
    }
  }, [mapType])

  function handleSetFromMap(id: string) {
    setPickerStopId((prev) => {
      const next = prev === id ? null : id
      if (next) {
        setExpandedStops((prevExpanded) => (prevExpanded.includes(next) ? prevExpanded : [...prevExpanded, next]))
      }
      return next
    })
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <section className="card">
        <h3>Fish Run</h3>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <label className="label">Map
            <select className="select" value={mapType} onChange={(e) => setMapType(e.target.value as any)}>
              <option value="aerial">Aerial</option>
              <option value="street">Street</option>
            </select>
          </label>
        </div>
        {runs.length > 0 && (
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <label className="label">Load Existing Run
              <select className="select" value={run.id} onChange={async (e) => {
                const id = e.target.value
                const r = runs.find(x => x.id === id)
                if (r) { setRun(r); setStops(await listFishStops(id)) }
              }}>
                {[run, ...runs.filter(r => r.id !== run.id)].map(r => (
                  <option key={r.id} value={r.id}>{r.title || r.id}</option>
                ))}
              </select>
            </label>
            <button className="btn warn" onClick={async () => { if (!confirm('Really delete this fish run?')) return; await deleteFishRun(run.id); const left = await listFishRuns(); setRuns(left); if (left[0]) { setRun(left[0]); setStops(await listFishStops(left[0].id)) } else { setRun({ id: crypto.randomUUID(), title: '', createdAt: new Date().toISOString() }); setStops([]) } }}>Delete Run</button>
          </div>
        )}
        <div className="form-grid">
          <label className="label">Title
            <input className="input" value={run.title || ''} onChange={(e) => setRun({ ...run, title: e.target.value })} />
          </label>
          <label className="label">Planned Date
            <input className="input" type="date" value={(run.plannedAt || '').slice(0,10)} onChange={(e) => setRun({ ...run, plannedAt: e.target.value })} />
          </label>
          <label className="label" style={{ gridColumn: '1 / -1' }}>Notes
            <textarea className="textarea" value={run.notes || ''} onChange={(e) => setRun({ ...run, notes: e.target.value })} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={save}>{saved ? 'Saved' : 'Save Run'}</button>
          <button className="btn secondary" onClick={addStop}>Add Stop</button>
        </div>
      </section>

      <section className="card">
        <h3>Run Map</h3>
        <div ref={mapEl} style={{ height: 300, width: '100%', borderRadius: 8, border: '1px solid var(--border, #d4d4d8)' }} />
      </section>

      {stops.length === 0 ? (
        <div className="muted">No stops yet</div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {stops.map((s) => {
            const isOpen = expandedStops.includes(s.id)
            const locationLabel = pickerStopId === s.id
              ? 'Awaiting map click...'
              : typeof s.lat === 'number' && typeof s.lon === 'number'
                ? `(${s.lat.toFixed(4)}, ${s.lon.toFixed(4)})`
                : 'No location'
            const summaryStyle = {
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #d4d4d8)',
              background: 'var(--surface, #fff)',
              cursor: 'pointer',
              marginBottom: isOpen ? 8 : 0,
            } as const
            return (
              <details
                key={s.id}
                ref={(el) => { detailRefs.current[s.id] = el }}
                open={isOpen}
                className="accordion"
                onToggle={(event) => {
                  const next = event.currentTarget.open
                  setExpandedStops((prev) => {
                    if (next) {
                      return prev.includes(s.id) ? prev : [...prev, s.id]
                    }
                    return prev.filter((id) => id !== s.id)
                  })
                }}
              >
                <summary className="accordion__summary" style={summaryStyle}>
                  <span>Stop #{s.seq}{s.site ? ` - ${s.site}` : ''}</span>
                  <small className="muted" style={{ marginLeft: 'auto' }}>{locationLabel}</small>
                </summary>
                <FishStopEditor
                  runId={run.id}
                  stop={s}
                  onChange={async (patch) => { await updateFishStop(s.id, patch); setStops(await listFishStops(run.id)) }}
                  onSetFromMap={() => handleSetFromMap(s.id)}
                  awaitingMap={pickerStopId === s.id}
                />
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FishStopEditor({ runId, stop, onChange, onSetFromMap, awaitingMap }: { runId: string; stop: FishStop; onChange: (patch: Partial<FishStop>) => void; onSetFromMap: () => void; awaitingMap: boolean }) {
  const language = typeof navigator !== 'undefined' ? navigator.language : 'en-US'
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [memoRefreshKey, setMemoRefreshKey] = useState(0)

  function handleAddressChange(value: string) {
    onChange({ address: value })
  }

  function handleAddressSelect(suggestion: AddressSuggestion) {
    const patch: Partial<FishStop> = { address: suggestion.label }
    if (suggestion.lat != null) patch.lat = suggestion.lat
    if (suggestion.lon != null) patch.lon = suggestion.lon
    onChange(patch)
  }

  const {
    isRecording,
    startRecording: beginRecording,
    stopRecording: finishRecording,
    error: recordingError,
    resetError: resetRecordingError,
    isSupported: recordingSupported,
  } = useAudioRecorder({ minDurationMs: 800 })

  useEffect(() => {
    if (recordingError) setStatusMessage(recordingError)
  }, [recordingError])

  async function handleStartRecording() {
    setStatusMessage(null)
    resetRecordingError()
    try {
      await beginRecording()
    } catch (err: any) {
      const message = err?.message || 'Could not start recording.'
      setStatusMessage(message)
    }
  }

  async function handleStopRecording() {
    try {
      const result = await finishRecording()
      const durationSec = Math.max(1, Math.round(result.durationMs / 1000))
      const now = new Date().toISOString()
      const lang = normalizeLanguageTag(language)
      await saveAudioNote({ id: crypto.randomUUID(), jobId: runId, stopId: stop.id, blob: result.blob, createdAt: now, mimeType: result.mimeType, lang, durationSec })
      setStatusMessage('Voice memo saved for this stop.')
      setMemoRefreshKey((key) => key + 1)
    } catch (err: any) {
      const message = err?.message || 'Could not save voice memo.'
      setStatusMessage(message)
    }
  }

  return (
    <section className="card">
      <h4>Stop #{stop.seq}</h4>
      <div className="form-grid">
        <label className="label">Client
          <input className="input" value={stop.client || ''} onChange={(e) => onChange({ client: e.target.value })} />
        </label>
        <label className="label">Site
          <input className="input" value={stop.site || ''} onChange={(e) => onChange({ site: e.target.value })} />
        </label>
        <label className="label" style={{ gridColumn: '1 / -1' }}>Address
          <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <AddressAutocomplete
                value={stop.address || ''}
                onChange={handleAddressChange}
                onSelect={handleAddressSelect}
                placeholder="Start typing address"
              />
            </div>
            <button type="button" className="btn secondary" onClick={async () => {
              const q = (stop.address || '').trim(); if (!q) { alert('Enter an address first'); return }
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, { headers: { 'Accept': 'application/json' } })
                const data = await res.json()
                if (data[0]) { await onChange({ lat: Number(data[0].lat), lon: Number(data[0].lon) }) } else { alert('Address not found') }
              } catch (e: any) { alert('Geocoding failed: ' + (e?.message || e)) }
            }}>Find</button>
          </div>
        </label>
        <label className="label">Latitude
          <input className="input" type="number" value={stop.lat ?? ''} onChange={(e) => onChange({ lat: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
        <label className="label">Longitude
          <input className="input" type="number" value={stop.lon ?? ''} onChange={(e) => onChange({ lon: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
        <div className="row" style={{ gridColumn: '1 / -1', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn secondary" onClick={onSetFromMap} title="Click the run map to set location for this stop">{awaitingMap ? 'Waiting For Map...' : 'Set From Map'}</button>
          <small className="muted">{awaitingMap ? 'Click the run map to place this stop.' : 'Press Set From Map and then click the run map.'}</small>
        </div>
        <label className="label">Species
          <input className="input" value={stop.species || ''} onChange={(e) => onChange({ species: e.target.value })} />
        </label>
        <label className="label">Count
          <input className="input" type="number" value={stop.count ?? ''} onChange={(e) => onChange({ count: Number(e.target.value) || undefined })} />
        </label>
        <label className="label">Weight (lb)
          <input className="input" type="number" value={stop.weightLb ?? ''} onChange={(e) => onChange({ weightLb: Number(e.target.value) || undefined })} />
        </label>
        <label className="label">Tank Temp (F)
          <input className="input" type="number" value={stop.tankTempF ?? ''} onChange={(e) => onChange({ tankTempF: Number(e.target.value) || undefined })} />
        </label>
        <label className="label">Pond Temp (F)
          <input className="input" type="number" value={stop.pondTempF ?? ''} onChange={(e) => onChange({ pondTempF: Number(e.target.value) || undefined })} />
        </label>
        <label className="label" style={{ gridColumn: '1 / -1' }}>Notes
          <textarea className="textarea" value={stop.note || ''} onChange={(e) => onChange({ note: e.target.value })} />
        </label>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {recordingSupported ? (
          !isRecording ? (
            <button className="btn" onClick={handleStartRecording}>Record Voice Memo</button>
          ) : (
            <button className="btn warn" onClick={handleStopRecording}>Stop Voice Memo</button>
          )
        ) : (
          <button className="btn" disabled title="MediaRecorder not supported">Record Voice Memo</button>
        )}
      </div>
      {statusMessage && (
        <div className="muted" style={{ marginTop: 8, color: statusMessage.includes('saved') ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)' }}>{statusMessage}</div>
      )}
      <StopMemos stopId={stop.id} refreshKey={memoRefreshKey} />
    </section>
  )
}

import { useEffect as useEffectM, useMemo as useMemoM, useState as useStateM } from 'react'
function StopMemos({ stopId, refreshKey }: { stopId: string; refreshKey: number }) {
  const [memos, setMemos] = useStateM<any[]>([])
  useEffectM(() => {
    let active = true
    const load = async () => {
      const items = await db.audioNotes.where('stopId').equals(stopId).reverse().sortBy('createdAt')
      if (active) setMemos(items)
    }
    load()
    return () => {
      active = false
    }
  }, [stopId, refreshKey])
  if (memos.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <strong>Voice Memos</strong>
      <ul className="list">
        {memos.map((m) => (
          <li key={m.id}>
            <small className="muted">{new Date(m.createdAt).toLocaleString()}</small>
            <div><StopMemoAudio note={m} /></div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StopMemoAudio({ note }: { note: any }) {
  const blob = useMemoM(() => ensureAudioBlob(note), [note])
  const url = useMemoM(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffectM(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
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
