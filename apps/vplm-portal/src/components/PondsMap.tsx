import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { addDepthPoint, addMiscPoint, deleteDepthPoint, deleteMiscPoint, listDepthPoints, listMiscPoints, listPonds, logJob, savePond, getActor, deletePond } from '../features/offline/db'

type LatLng = [number, number]

function computePolygonAreaAcres(points: LatLng[]): number {
  if (!points || points.length < 3) return 0
  const toRad = (d: number) => (d * Math.PI) / 180
  const lat0 = points.reduce((a, p) => a + p[0], 0) / points.length
  const lon0 = points.reduce((a, p) => a + p[1], 0) / points.length
  const R = 6371000
  const xy = points.map(([lat, lon]) => [
    R * toRad(lon - lon0) * Math.cos(toRad(lat0)),
    R * toRad(lat - lat0),
  ])
  let area = 0
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i]
    const [x2, y2] = xy[(i + 1) % xy.length]
    area += x1 * y2 - x2 * y1
  }
  area = Math.abs(area) / 2
  return area / 4046.8564224
}

function distM(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function pointInPolygon(point: LatLng, polygon: LatLng[]) {
  const x = point[1], y = point[0]
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0], xi = polygon[i][1]
    const yj = polygon[j][0], xj = polygon[j][1]
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export default function PondsMap({ jobId }: { jobId: string }) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const osmRef = useRef<L.TileLayer | null>(null)
  const aerialRef = useRef<L.TileLayer | null>(null)
  const pondsLayerRef = useRef<L.LayerGroup | null>(null)
  const traceLayerRef = useRef<L.Polyline | null>(null)
  const polygonLayerRef = useRef<L.LayerGroup | null>(null)
  const verticesLayerRef = useRef<L.LayerGroup | null>(null)
  const depthLayerRef = useRef<L.LayerGroup | null>(null)
  const miscLayerRef = useRef<L.LayerGroup | null>(null)
  const pondSummaryLayerRef = useRef<L.LayerGroup | null>(null)
  const userLayerRef = useRef<L.LayerGroup | null>(null)
  const searchLayerRef = useRef<L.LayerGroup | null>(null)

  const [mapType, setMapType] = useState<'street' | 'aerial'>('aerial')
  const [trace, setTrace] = useState<LatLng[]>([])
  const [tracing, setTracing] = useState(false)
  const [depthMode, setDepthMode] = useState(false)
  const [ponds, setPonds] = useState<any[]>([])
  const [depths, setDepths] = useState<any[]>([])
  const [misc, setMisc] = useState<any[]>([])
  const [armedDeletePondId, setArmedDeletePondId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Init map with Street base and scale
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const map = L.map(mapEl.current).setView([30.2672, -97.7431], 15)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
    L.control.scale({ imperial: true, metric: false }).addTo(map)
    osmRef.current = osm
    aerialRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxZoom: 19, opacity: 0 })
    pondsLayerRef.current = L.layerGroup().addTo(map)
    polygonLayerRef.current = L.layerGroup().addTo(map)
    verticesLayerRef.current = L.layerGroup().addTo(map)
    depthLayerRef.current = L.layerGroup().addTo(map)
    miscLayerRef.current = L.layerGroup().addTo(map)
    pondSummaryLayerRef.current = L.layerGroup().addTo(map)
    userLayerRef.current = L.layerGroup().addTo(map)
    searchLayerRef.current = L.layerGroup().addTo(map)
    const north = L.control({ position: 'topright' })
    north.onAdd = () => {
      const d = L.DomUtil.create('div')
      d.textContent = 'N'
      d.className = 'north-arrow'
      return d
    }
    north.addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 100)
  }, [])

  // Invalidate size and fit content when the accordion opens
  // Listen on document because the event bubbles upward from the panel
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handler = () => {
      setTimeout(() => {
        map.invalidateSize()
        const bounds = collectContentBounds()
        if (bounds) map.fitBounds(bounds, { padding: [24, 24] })
      }, 0)
    }
    document.addEventListener('accordion:open', handler as any)
    return () => { try { document.removeEventListener('accordion:open', handler as any) } catch {} }
  }, [mapRef.current, ponds, depths, misc])

  function collectContentBounds(): L.LatLngBounds | null {
    const items: LatLng[] = []
    ponds.forEach((p) => (p.polygon || []).forEach((pt: LatLng) => items.push(pt)))
    depths.forEach((d) => items.push([d.lat, d.lon]))
    misc.forEach((m) => items.push([m.lat, m.lon]))
    if (items.length === 0) return null
    return L.latLngBounds(items.map(([a,b]) => L.latLng(a,b)))
  }

  // Switch base map
  useEffect(() => {
    const map = mapRef.current
    if (!map || !osmRef.current || !aerialRef.current) return
    if (mapType === 'aerial') {
      aerialRef.current.addTo(map)
      aerialRef.current.setOpacity(0)
      aerialRef.current.once('load', () => aerialRef.current!.setOpacity(1))
      ;(osmRef.current as any).bringToBack?.()
    } else {
      try { map.removeLayer(aerialRef.current) } catch {}
      osmRef.current.addTo(map)
    }
  }, [mapType])

  // Render ponds
  useEffect(() => { (async () => setPonds(await listPonds(jobId)))() }, [jobId])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !pondsLayerRef.current) return
    pondsLayerRef.current.clearLayers()
    ponds.forEach((p) => {
      const layer = L.polygon(p.polygon as any, { color: p.color || '#16a34a', fillOpacity: 0.15, weight: 2 })
      layer.bindTooltip(p.name || 'Pond', { permanent: true, direction: 'center' })
      pondsLayerRef.current!.addLayer(layer)
    })
  }, [ponds])

  // Geocode/search helper for lat,lon or address
  async function goSearch() {
    const map = mapRef.current
    if (!map) return
    const q = (searchQuery || '').trim()
    if (!q) return
    // Try "lat,lon"
    const m = q.match(/^\s*([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)\s*$/)
    let lat: number | null = null, lon: number | null = null
    if (m) { lat = Number(m[1]); lon = Number(m[2]) }
    if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
      searchLayerRef.current?.clearLayers()
      const marker = L.circleMarker([lat, lon], { radius: 7, color: '#10b981', weight: 2, fillColor: '#a7f3d0', fillOpacity: 0.95 })
      searchLayerRef.current!.addLayer(marker)
      map.setView([lat, lon], 16)
      return
    }
    // Address geocode via Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      const data = await res.json()
      if (Array.isArray(data) && data[0]) {
        const r = data[0]
        const la = Number(r.lat), lo = Number(r.lon)
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          searchLayerRef.current?.clearLayers()
          const marker = L.circleMarker([la, lo], { radius: 7, color: '#10b981', weight: 2, fillColor: '#a7f3d0', fillOpacity: 0.95 })
          searchLayerRef.current!.addLayer(marker)
          map.setView([la, lo], 16)
        }
      }
    } catch {
      // ignore
    }
  }

  // Render depths
  useEffect(() => { (async () => setDepths(await listDepthPoints(jobId)))() }, [jobId])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !depthLayerRef.current) return
    depthLayerRef.current.clearLayers()
    depths.forEach((d) => {
      const m = L.circleMarker([d.lat, d.lon], { radius: 5, color: '#2563eb', weight: 2, fillColor: '#93c5fd', fillOpacity: 0.9 })
      m.bindTooltip(`${Number(d.depthFt).toFixed(1)} ft`, { permanent: true, direction: 'top', offset: L.point(0, -8) })
      m.on('click', async () => { if (confirm('Delete this depth point?')) { await deleteDepthPoint(d.id); setDepths(await listDepthPoints(jobId)) } })
      depthLayerRef.current!.addLayer(m)
    })
  }, [depths, jobId])

  // Render misc points
  useEffect(() => { (async () => setMisc(await listMiscPoints(jobId)))() }, [jobId])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !miscLayerRef.current) return
    miscLayerRef.current.clearLayers()
    misc.forEach((mpt: any) => {
      const m = L.circleMarker([mpt.lat, mpt.lon], { radius: 6, color: '#f97316', weight: 2, fillColor: '#fdba74', fillOpacity: 0.9 })
      m.bindPopup(`<strong>${mpt.name}</strong>${mpt.note ? '<br/>' + mpt.note : ''}<br/><button data-mid="${mpt.id}">Delete</button>`)
      m.on('popupopen', () => {
        const btn = document.querySelector(`button[data-mid="${mpt.id}"]`)
        btn?.addEventListener('click', async () => { if (confirm('Delete point?')) { await deleteMiscPoint(mpt.id); setMisc(await listMiscPoints(jobId)) } })
      })
      miscLayerRef.current!.addLayer(m)
    })
  }, [misc, jobId])

  // Draw trace visuals
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (traceLayerRef.current) traceLayerRef.current.remove()
    if (polygonLayerRef.current) polygonLayerRef.current.clearLayers?.()
    verticesLayerRef.current?.clearLayers()
    if (trace.length >= 2) traceLayerRef.current = L.polyline(trace as any, { color: '#16a34a', dashArray: '6,6' }).addTo(map)
    if (trace.length >= 3) L.polygon(trace as any, { color: '#16a34a', fillOpacity: 0.2, weight: 2 }).addTo(polygonLayerRef.current!)
    trace.forEach(([lat, lon]) => verticesLayerRef.current?.addLayer(L.circleMarker([lat, lon], { radius: 3, color: '#16a34a', fillColor: '#16a34a', fillOpacity: 1 })))
  }, [trace])
  // Toggle simplified view when zoomed out: one marker per pond
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => {
      const z = map.getZoom()
      const showSummary = z <= 12
      if (showSummary) {
        try { pondsLayerRef.current && map.removeLayer(pondsLayerRef.current) } catch {}
        try { depthLayerRef.current && map.removeLayer(depthLayerRef.current) } catch {}
        try { miscLayerRef.current && map.removeLayer(miscLayerRef.current) } catch {}
        if (pondSummaryLayerRef.current && !map.hasLayer(pondSummaryLayerRef.current)) pondSummaryLayerRef.current.addTo(map)
        pondSummaryLayerRef.current?.clearLayers()
        ponds.forEach((p: any) => {
          const pts: LatLng[] = p.polygon || []
          if (pts.length === 0) return
          const lat = pts.reduce((a,pt)=>a+pt[0],0)/pts.length
          const lon = pts.reduce((a,pt)=>a+pt[1],0)/pts.length
          const m = L.circleMarker([lat, lon], { radius: 8, color: '#0ea5e9', weight: 2, fillColor: '#93c5fd', fillOpacity: 0.9 })
          m.bindTooltip(p.name || 'Pond', { direction: 'top', offset: L.point(0,-8) })
          pondSummaryLayerRef.current!.addLayer(m)
        })
      } else {
        try { pondSummaryLayerRef.current && map.removeLayer(pondSummaryLayerRef.current) } catch {}
        if (pondsLayerRef.current && !map.hasLayer(pondsLayerRef.current)) pondsLayerRef.current.addTo(map)
        if (depthLayerRef.current && !map.hasLayer(depthLayerRef.current)) depthLayerRef.current.addTo(map)
        if (miscLayerRef.current && !map.hasLayer(miscLayerRef.current)) miscLayerRef.current.addTo(map)
      }
    }
    map.on('zoomend', update)
    update()
    return () => { map.off('zoomend', update) }
  }, [ponds])

  // Map clicks for modes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onClick = async (e: any) => {
      if (tracing) { setTrace((arr) => [...arr, [e.latlng.lat, e.latlng.lng]]); return }
      if (depthMode) {
        const pondsList = await listPonds(jobId)
        let pondId: string | undefined
        for (const p of pondsList) if (pointInPolygon([e.latlng.lat, e.latlng.lng], p.polygon)) { pondId = p.id; break }
        if (!pondId) { alert('Save a pond outline first, then add depth points inside it.'); return }
        const input = prompt('Depth (ft)?')
        const val = input ? Number(input) : NaN
        if (!Number.isFinite(val)) return
        await addDepthPoint({ id: crypto.randomUUID(), jobId, lat: e.latlng.lat, lon: e.latlng.lng, depthFt: val, createdAt: new Date().toISOString(), pondId })
        setDepths(await listDepthPoints(jobId))
        logJob(jobId, 'depth_add', `Depth ${val} ft`, getActor())
      }
    }
    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [tracing, depthMode, jobId])

  // Metrics per pond
  const pondMetrics = useMemo(() => {
    const out: Record<string, { acres: number; perimeterFt: number; avgDepth: number | null; count: number }> = {}
    ponds.forEach((p: any) => {
      const acres = computePolygonAreaAcres(p.polygon || [])
      let per = 0
      const pts: LatLng[] = p.polygon || []
      for (let i=0;i<pts.length;i++) per += distM(pts[i], pts[(i+1)%pts.length])
      const pDepths = depths.filter((d) => d.pondId === p.id)
      const avg = pDepths.length ? pDepths.reduce((a:number,d:any)=>a+(Number(d.depthFt)||0),0)/pDepths.length : null
      out[p.id] = { acres, perimeterFt: per*3.28084, avgDepth: avg, count: pDepths.length }
    })
    return out
  }, [ponds, depths])

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setTracing((v) => !v)}>{tracing ? 'Finish Pond Trace' : 'Start Pond Trace'}</button>
          <button className="btn secondary" onClick={() => setTrace([])}>Clear Trace</button>
          {trace.length >= 3 && (
            <button className="btn" onClick={async () => {
              const name = prompt('Pond name') || undefined
              await savePond({ id: crypto.randomUUID(), jobId, name, polygon: trace, createdAt: new Date().toISOString() } as any)
              setTrace([])
              setPonds(await listPonds(jobId))
              logJob(jobId, 'pond_save', `Saved pond ${name || ''}`, getActor())
            }}>Save Pond</button>
          )}
          <button className="btn secondary" onClick={async () => {
            if (!navigator.geolocation) { alert('Geolocation not available'); return }
            navigator.geolocation.getCurrentPosition((pos) => {
              const { latitude, longitude, accuracy } = pos.coords
              const map = mapRef.current
              if (!map) return
              userLayerRef.current?.clearLayers()
              const m = L.circleMarker([latitude, longitude], { radius: 7, color: '#06b6d4', weight: 2, fillColor: '#67e8f9', fillOpacity: 0.95 })
              userLayerRef.current!.addLayer(m)
              if (Number.isFinite(accuracy) && accuracy > 0) {
                const a = L.circle([latitude, longitude], { radius: Math.min(accuracy, 100), color: '#06b6d4', weight: 1, fillColor: '#67e8f9', fillOpacity: 0.2 })
                userLayerRef.current!.addLayer(a)
              }
              map.setView([latitude, longitude], 16)
            }, (err) => alert(err.message || 'Location permission denied'))
          }}>Use My Location</button>
        </div>
        <label className="row" style={{ gap: 8 }}>
          <span className="muted">Map</span>
          <select className="select" value={mapType} onChange={(e) => setMapType(e.target.value as any)}>
            <option value="street">Street</option>
            <option value="aerial">Aerial</option>
          </select>
        </label>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label className="row" style={{ gap: 8, flex: 1 }}>
          <span className="muted">Find</span>
          <input className="input" style={{ minWidth: 240, flex: 1 }} placeholder="lat,lon or address" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if ((e as any).key === 'Enter') goSearch() }} />
          <button className="btn secondary" onClick={goSearch}>Go</button>
        </label>
      </div>

      <div ref={mapEl} style={{ height: 540, width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />

      <div className="row">
        <button className="btn secondary" onClick={() => setDepthMode((v) => !v)}>{depthMode ? 'Done Adding Depths' : 'Add Depth Point'}</button>
        <button className="btn secondary" onClick={async () => {
          const name = prompt('Name this point (misc)')
          if (!name) return
          const note = prompt('Optional note') || undefined
          alert('Click the map to place the misc point')
          const map = mapRef.current
          if (!map) return
          const once = async (e: any) => {
            await addMiscPoint({ id: crypto.randomUUID(), jobId, name, note, lat: e.latlng.lat, lon: e.latlng.lng, createdAt: new Date().toISOString() })
            setMisc(await listMiscPoints(jobId))
            map.off('click', once)
          }
          map.on('click', once)
        }}>Add Misc Point</button>
      </div>

      {ponds.length > 0 && (
        <section className="card">
          <h3>Ponds Summary</h3>
          <table className="table">
            <thead><tr><th>Name</th><th>Acreage</th><th>Perimeter (ft)</th><th>Avg Depth (ft)</th><th>Depths</th><th>Actions</th></tr></thead>
            <tbody>
              {ponds.map((p:any) => (
                <tr key={p.id}>
                  <td>{p.name || '(unnamed)'}</td>
                  <td>{pondMetrics[p.id]?.acres?.toFixed(3) || '-'}</td>
                  <td>{pondMetrics[p.id] ? pondMetrics[p.id].perimeterFt.toFixed(1) : '-'}</td>
                  <td>{pondMetrics[p.id]?.avgDepth != null ? pondMetrics[p.id].avgDepth.toFixed(2) : '-'}</td>
                  <td>{pondMetrics[p.id]?.count ?? 0}</td>
                  <td>
                    <button className="btn secondary" onClick={() => {
                      const bounds = L.latLngBounds((p.polygon||[]).map((pt:LatLng)=>L.latLng(pt[0],pt[1])))
                      mapRef.current?.fitBounds(bounds, { padding: [24,24] })
                    }}>Zoom</button>
                    {armedDeletePondId === p.id ? (
                      <button className="btn warn" style={{ marginLeft: 6 }} onClick={async () => {
                        if (!confirm('Really delete this pond and its stats?')) { setArmedDeletePondId(null); return }
                        await deletePond(p.id)
                        setPonds(await listPonds(jobId))
                        setArmedDeletePondId(null)
                      }}>Confirm Delete</button>
                    ) : (
                      <button className="btn secondary" style={{ marginLeft: 6 }} onClick={() => setArmedDeletePondId(p.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}







