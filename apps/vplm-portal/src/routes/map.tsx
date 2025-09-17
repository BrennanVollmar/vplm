import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { db } from '../features/offline/db'

export default function AllJobsMap() {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [clusterOn, setClusterOn] = useState(true)
  const [mapType, setMapType] = useState<'aerial' | 'street'>('aerial')

  useEffect(() => { (async () => setJobs(await db.jobs.toArray()))() }, [])

  // Initialize map with OSM underlay and fade-in Aerial
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const first = jobs.find((j) => typeof j.lat === 'number' && typeof j.lon === 'number')
    const center: [number, number] = first ? [first.lat, first.lon] : [30.2672, -97.7431]
    const map = L.map(mapEl.current).setView(center, 7)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 })
    const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxZoom: 19, opacity: 0 })
    imagery.on('load', () => imagery.setOpacity(1))
    if (mapType === 'aerial') { osm.addTo(map); (osm as any).bringToBack?.(); imagery.addTo(map) } else { osm.addTo(map) }
    setTimeout(() => map.invalidateSize(), 150)
    mapRef.current = map
  }, [jobs])

  // Switch base layer on toggle
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let imagery: any = null
    let osm: any = null
    Object.values((map as any)._layers || {}).forEach((ly: any) => {
      if (ly && ly._url && String(ly._url).includes('ArcGIS/rest/services/World_Imagery')) imagery = ly
      if (ly && ly.getAttribution && String(ly.getAttribution()).includes('OpenStreetMap')) osm = ly
    })
    if (!osm) { osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map) }
    if (mapType === 'aerial') {
      try { osm && (osm as any).bringToBack?.() } catch {}
      if (imagery) { imagery.setOpacity?.(0); imagery.addTo?.(map); imagery.once?.('load', () => imagery.setOpacity?.(1)) }
      else {
        const im = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxZoom: 19, opacity: 0 }).addTo(map)
        im.once('load', () => im.setOpacity(1))
      }
    } else {
      if (imagery) try { map.removeLayer(imagery) } catch {}
      osm.addTo(map)
    }
  }, [mapType])

  // Place markers and fit to bounds
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pts: L.LatLngExpression[] = []
    // Remove previous markers
    map.eachLayer((layer: any) => { if (layer instanceof L.Marker) map.removeLayer(layer) })
    const items = jobs.filter((j) => typeof j.lat === 'number' && typeof j.lon === 'number')
    if (clusterOn && items.length > 30) {
      const zoom = map.getZoom()
      const factor = Math.max(1, 12 - zoom)
      const bins = new Map<string, { lat: number; lon: number; count: number; sample: any }>()
      for (const j of items) {
        const key = `${(j.lat).toFixed(factor)}_${(j.lon).toFixed(factor)}`
        const b = bins.get(key) || { lat: 0, lon: 0, count: 0, sample: j }
        b.lat += j.lat; b.lon += j.lon; b.count += 1; b.sample = j
        bins.set(key, b)
      }
      for (const [,b] of bins) {
        const lat = b.lat / b.count, lon = b.lon / b.count
        const m = L.marker([lat, lon]).addTo(map)
        m.bindPopup(b.count > 1 ? `${b.count} sites near here` : `<strong>${escapeHtml(b.sample.clientName || '')}</strong>${b.sample.siteName ? ' - ' + escapeHtml(b.sample.siteName) : ''}`)
        pts.push([lat, lon])
      }
    } else {
      for (const j of items) {
        const latlng: L.LatLngExpression = [j.lat, j.lon]
        L.marker(latlng).addTo(map).bindPopup(`<strong>${escapeHtml(j.clientName || '')}</strong>${j.siteName ? ' - ' + escapeHtml(j.siteName) : ''}`)
        pts.push(latlng)
      }
    }
    if (pts.length > 1) {
      const bounds = L.latLngBounds(pts)
      map.fitBounds(bounds, { padding: [24,24] })
    } else if (pts.length === 1) {
      map.setView(pts[0] as any, 13)
    }
  }, [jobs, clusterOn])

  return (
    <div className="grid">
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>All Sites</h2>
          <div className="row" style={{ gap: 12 }}>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={clusterOn} onChange={(e) => setClusterOn(e.target.checked)} /> Cluster markers
            </label>
            <label className="row" style={{ gap: 8 }}>
              <span className="muted">Map</span>
              <select className="select" value={mapType} onChange={(e) => setMapType(e.target.value as any)}>
                <option value="aerial">Aerial</option>
                <option value="street">Street</option>
              </select>
            </label>
          </div>
        </div>
        <div ref={mapEl} style={{ height: 540, width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
      </section>
    </div>
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c] || c)
}

