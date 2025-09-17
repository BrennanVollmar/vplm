import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { saveTrack, Track, TrackPoint, logJob, getActor, addDepthPoint, listDepthPoints, savePond, listPonds, deletePond } from '../features/offline/db'

function computePolygonAreaAcres(points: [number, number][]): number {
  if (points.length < 3) return 0
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

export default function MapPanel({ jobId }: { jobId: string }) {
  const [pos, setPos] = useState<[number, number] | null>(null)
  const [track, setTrack] = useState<TrackPoint[]>([])
  const [drawing, setDrawing] = useState(false)
  const [poly, setPoly] = useState<[number, number][]>([])
  const [perimeterM, setPerimeterM] = useState<number>(0)
  const watchRef = useRef<number | null>(null)
  const [accuracyM, setAccuracyM] = useState<number | null>(null)
  const [trackLenM, setTrackLenM] = useState<number>(0)
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const trackLineRef = useRef<L.Polyline | null>(null)
  const polyRef = useRef<L.Polygon | null>(null)
  const depthLayerRef = useRef<L.LayerGroup | null>(null)
  const [depthMode, setDepthMode] = useState(false)
  const [depths, setDepths] = useState<any[]>([])
  const scaleRef = useRef<L.Control.Scale | null>(null)
  const compassRef = useRef<L.Control | null>(null)
  const augmentedRef = useRef<boolean>(false)
  const [mapType, setMapType] = useState<'aerial' | 'street'>('aerial')
  const hasCenteredRef = useRef<boolean>(false)\n  const [ponds, setPonds] = useState<any[]>([])\n  const pondsLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const center = pos || [30.2672, -97.7431]
    const map = L.map(mapEl.current).setView(center as any, 15)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© Esri ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: 19,
    }).addTo(map)
    try {
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
      ;(osm as any).bringToBack?.()
    } catch {}
    try {
      ;(map as any)._layers && Object.values((map as any)._layers).forEach((ly: any) => {
        if (ly && ly._url && String(ly._url).includes('ArcGIS/rest/services/World_Imagery')) {
          ly.setOpacity?.(0)
          ly.once?.('load', () => ly.setOpacity?.(1))
        }
      })
    } catch {}
    setTimeout(() => map.invalidateSize(), 100)
    if (!scaleRef.current) {
      try { scaleRef.current = L.control.scale({ imperial: true, metric: false }); scaleRef.current.addTo(map) } catch {}
    }
    map.on('contextmenu', () => { if (drawing) setDrawing(false) })
    mapRef.current = map
  }, [pos, drawing])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) markerRef.current.remove()
    if (pos) {
      markerRef.current = L.marker(pos as any).addTo(map)
      if (!hasCenteredRef.current) { map.setView(pos as any, 17); hasCenteredRef.current = true }
    }
  }, [pos])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (trackLineRef.current) trackLineRef.current.remove()
    if (track.length > 0) {
      trackLineRef.current = L.polyline(track.map((p) => [p.lat, p.lon]) as any, { color: '#0b6b53' }).addTo(map)
    }
  }, [track])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (polyRef.current) polyRef.current.remove()
    if (poly.length > 2) {
      polyRef.current = L.polygon(poly as any, { color: '#16a34a', fillOpacity: 0.2 }).addTo(map)
    }
  }, [poly])

  // Recompute perimeter when polygon changes
  useEffect(() => {
    if (poly.length < 2) { setPerimeterM(0); return }
    let per = 0
    for (let i=0;i<poly.length;i++) {
      const a = poly[i], b = poly[(i+1)%poly.length]
      per += distM([a[0], a[1]], [b[0], b[1]])
    }
    setPerimeterM(per)
  }, [poly])

  useEffect(() => {
    if (!pos && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((p) => setPos([p.coords.latitude, p.coords.longitude]))
    }
  }, [pos])

  // After map mounts: fix sizing; add unified click handler; init depth layer
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    setTimeout(() => map.invalidateSize(), 200)
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    // Add OSM underlay and fade-in imagery (once) to avoid grey viewport
    if (!augmentedRef.current) {
      try {
        let hasOSM = false
        ;(map as any)._layers && Object.values((map as any)._layers).forEach((ly: any) => {
          if (ly && ly.getAttribution && String(ly.getAttribution()).includes('OpenStreetMap')) hasOSM = true
        })
        if (!hasOSM) {
          const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© OpenStreetMap contributors', maxZoom: 19 })
          osm.addTo(map); (osm as any).bringToBack?.()
        }
        ;(map as any)._layers && Object.values((map as any)._layers).forEach((ly: any) => {
          if (ly && ly._url && String(ly._url).includes('ArcGIS/rest/services/World_Imagery')) {
            try { ly.setOpacity?.(0); ly.once?.('load', () => ly.setOpacity?.(1)) } catch {}
          }
        })
      } catch {}
      augmentedRef.current = true
    }
    if (!scaleRef.current) { try { scaleRef.current = L.control.scale({ imperial: true, metric: false }); scaleRef.current.addTo(map) } catch {} }
    if (!compassRef.current) { try { const c = createCompassControl(); c.addTo(map); compassRef.current = c } catch {} }
    const onClick = async (e: any) => {
      if (drawing) {
        setPoly((arr) => [...arr, [e.latlng.lat, e.latlng.lng]])
        return
      }
      if (depthMode) {
        const input = prompt('Depth at this point (ft)?')
        const depth = input ? Number(input) : NaN
        if (Number.isFinite(depth)) {
          const rec = { id: crypto.randomUUID(), jobId, lat: e.latlng.lat, lon: e.latlng.lng, depthFt: depth, createdAt: new Date().toISOString() }
          await addDepthPoint(rec as any)
          setDepths(await listDepthPoints(jobId))
          logJob(jobId, 'depth_add', `Depth ${depth} ft @ (${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)})`, getActor())
        }
      }
    }
    map.on('click', onClick)
    if (!depthLayerRef.current) depthLayerRef.current = L.layerGroup().addTo(map)
    return () => { window.removeEventListener('resize', onResize); map.off('click', onClick) }
  }, [depthMode, jobId, drawing])

  // Switch base layer based on mapType
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let imagery: any = null
    let osm: any = null
    try {
      Object.values((map as any)._layers || {}).forEach((ly: any) => {
        if (ly && ly._url && String(ly._url).includes('ArcGIS/rest/services/World_Imagery')) imagery = ly
        if (ly && ly.getAttribution && String(ly.getAttribution()).includes('OpenStreetMap')) osm = ly
      })
    } catch {}
    if (!osm) {
      try { osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© OpenStreetMap contributors', maxZoom: 19 }).addTo(map) } catch {}
    }
    if (mapType === 'aerial') {
      try { osm && (osm as any).bringToBack?.() } catch {}
      if (imagery) {
        try { imagery.setOpacity?.(0); imagery.addTo?.(map); imagery.once?.('load', () => imagery.setOpacity?.(1)) } catch {}
      }
    } else {
      try { imagery && map.removeLayer(imagery) } catch {}
      try { osm && osm.addTo?.(map) } catch {}
    }
  }, [mapType])

  // Load and draw depth points
  useEffect(() => { (async () => setDepths(await listDepthPoints(jobId)))() }, [jobId])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !depthLayerRef.current) return
    depthLayerRef.current.clearLayers()
    for (const d of depths) {
      const m = L.circleMarker([d.lat, d.lon], { radius: 6, color: '#2563eb', weight: 2, fillColor: '#93c5fd', fillOpacity: 0.9 })
      m.bindPopup(`<strong>${d.depthFt} ft</strong><br/>(${d.lat.toFixed(5)}, ${d.lon.toFixed(5)})`)
      try { m.bindTooltip(`${Number(d.depthFt).toFixed(1)} ft`, { permanent: true, direction: 'top', offset: L.point(0, -8), className: 'depth-label' }) } catch {}
      try { m.bindTooltip(`${Number(d.depthFt).toFixed(1)} ft`, { permanent: true, direction: 'top', offset: L.point(0, -8), className: 'depth-label' }) } catch {}
      depthLayerRef.current.addLayer(m)
    }
  }, [depths])

  function toggleTracking() {
    if (!('geolocation' in navigator)) return
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
      if (track.length > 0) {
        const t: Track = { id: crypto.randomUUID(), jobId, points: track, createdAt: new Date().toISOString() }
        saveTrack(t)
        logJob(jobId, 'gps_track_save', `Saved GPS track with ${track.length} points`, getActor())
      }
      return
    }
    watchRef.current = navigator.geolocation.watchPosition((p) => {
      const pt: TrackPoint = { lat: p.coords.latitude, lon: p.coords.longitude, ts: new Date().toISOString() }
      setTrack((prev) => {
        const next = [...prev, pt]
        setPos([pt.lat, pt.lon])
        setAccuracyM(p.coords.accuracy ?? null)
        if (prev.length > 0) {
          const last = prev[prev.length - 1]
          const inc = distM([last.lat, last.lon], [pt.lat, pt.lon])
          setTrackLenM((len) => len + inc)
        }
        return next
      })
    }, undefined, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 })
  }

  const acresPoly = useMemo(() => computePolygonAreaAcres(poly), [poly])
  const avgDepthInside = useMemo(() => {
    if (poly.length < 3 || depths.length === 0) return null as number | null
    const inside = depths.filter((d) => pointInPolygon([d.lat, d.lon], poly))
    if (inside.length === 0) return null
    const sum = inside.reduce((a, d) => a + (Number(d.depthFt) || 0), 0)
    return sum / inside.length
  }, [poly, depths])

  return (
    <div className="grid">
      <div className="row">
        <button className="btn" onClick={toggleTracking}>{watchRef.current != null ? 'Stop GPS Track' : 'Start GPS Track'}</button>
        <button className="btn secondary" onClick={() => { setDrawing((d) => !d) }}>{drawing ? 'Finish Outline' : 'Trace Shoreline'}</button>
        <button className="btn secondary" onClick={() => { setPoly([]) }}>Clear Outline</button>
        <button className="btn" onClick={() => setDepthMode((v) => !v)}>{depthMode ? 'Done Adding Depths' : 'Add Depth Point'}</button>
        {track.length > 1 && <button className="btn secondary" onClick={() => exportGPX(track)}>Export GPX</button>}
        <label className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <span className="muted">Map</span>
          <select className="select" value={mapType} onChange={(e) => setMapType(e.target.value as any)}>
            <option value="aerial">Aerial</option>
            <option value="street">Street</option>
          </select>
        </label>
      </div>
      <div id="printable-map" ref={mapEl} style={{ height: 540, width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
      <div className="row">
        {accuracyM != null && <span className="label">GPS Acc (m)
          <input className="input" readOnly value={accuracyM?.toFixed(0)} />
        </span>}
        {track.length > 1 && <span className="label">Track Len (m)
          <input className="input" readOnly value={trackLenM.toFixed(1)} />
        </span>}
        <span className="label">Outline Acres
          <input className="input" readOnly value={acresPoly ? acresPoly.toFixed(3) : ''} />
        </span>
        {poly.length > 2 && (
          <span className="label">Perimeter (ft)
            <input className="input" readOnly value={(perimeterM * 3.28084).toFixed(1)} />
          </span>
        )}
        {avgDepthInside != null && (
          <span className="label">Avg Depth (ft)
            <input className="input" readOnly value={avgDepthInside.toFixed(2)} />
          </span>
        )}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn secondary" onClick={() => window.print()}>Print Map (PDF)</button>
      </div>
      <small className="muted">Tip: Tap Trace Shoreline, click to add points, right-click (long-press) to finish. GPS Track draws breadcrumbs for paths.</small>
    </div>
  )
}

function distM(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function exportGPX(track: TrackPoint[]) {
  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="VPLM" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>VPLM Track</name><trkseg>`
  const gpxPts = track.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${p.ts}</time></trkpt>`).join('')
  const gpxFooter = `</trkseg></trk></gpx>`
  const blob = new Blob([gpxHeader + gpxPts + gpxFooter], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vplm-track-${new Date().toISOString().replace(/[:.]/g, '-')}.gpx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function createCompassControl() {
  const Compass = L.Control.extend({
    options: { position: 'topright' as L.ControlPosition },
    onAdd: function() {
      const div = L.DomUtil.create('div', 'leaflet-bar')
      div.style.background = 'var(--surface, #fff)'
      div.style.border = '1px solid var(--border, #ccc)'
      div.style.padding = '6px 8px'
      div.style.font = '12px/1.2 sans-serif'
      div.style.textAlign = 'center'
      div.style.boxShadow = 'var(--shadow, 0 1px 3px rgba(0,0,0,0.2))'
      div.innerHTML = '<div style="font-weight:600">N</div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid #111;margin:2px auto 0"></div>'
      return div
    }
  })
  return new Compass()
}

// Ray casting point-in-polygon for [lat, lon] points
function pointInPolygon(point: [number, number], polygon: [number, number][]) {
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

