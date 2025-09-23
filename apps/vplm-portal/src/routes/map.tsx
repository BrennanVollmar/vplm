import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { liveQuery } from 'dexie'
import { db, type AddressBankEntry, type ClientBankContact } from '../features/offline/db'

function normalizeContacts(entry: AddressBankEntry): ClientBankContact[] {
  const base: ClientBankContact[] = (entry.contacts || []).map((c) => ({
    id: c.id || `${entry.id}-${c.phone}`,
    label: c.label,
    phone: c.phone,
  }))
  if (base.length > 0) return base
  return (entry.otherPhones || [])
    .filter(Boolean)
    .map((phone, idx) => ({ id: `${entry.id}-alt-${idx}`, phone }))
}

export default function AllJobsMap() {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [clusterOn, setClusterOn] = useState(true)
  const [mapType, setMapType] = useState<'aerial' | 'street'>('aerial')
  const [polys, setPolys] = useState<any[]>([])
  const [clientEntries, setClientEntries] = useState<AddressBankEntry[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [openClientId, setOpenClientId] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setJobs(await db.jobs.toArray())
      setPolys(await (db as any).ponds?.toArray?.() ?? [])
    })()
  }, [])

  useEffect(() => {
    const sub = liveQuery(() => db.addressBank.orderBy('clientName').toArray()).subscribe({
      next: (rows) => setClientEntries(rows),
      error: () => {},
    })
    return () => sub.unsubscribe()
  }, [])

  const filteredClients = useMemo(() => {
    const q = clientFilter.trim().toLowerCase()
    if (!q) return clientEntries
    return clientEntries.filter((entry) => {
      const contacts = normalizeContacts(entry)
      const haystack = [
        entry.clientName,
        entry.address,
        entry.contactName,
        entry.primaryPhone,
        entry.notes,
        ...contacts.flatMap((c) => [c.phone, c.label]),
      ]
      return haystack.some((val) => (val || '').toLowerCase().includes(q))
    })
  }, [clientEntries, clientFilter])

  useEffect(() => {
    if (openClientId && !filteredClients.some((entry) => entry.id === openClientId)) {
      setOpenClientId(null)
    }
  }, [filteredClients, openClientId])

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const first = jobs.find((j) => typeof j.lat === 'number' && typeof j.lon === 'number')
    const center: [number, number] = first ? [first.lat, first.lon] : [30.2672, -97.7431]
    const map = L.map(mapEl.current).setView(center, 7)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'Ac OpenStreetMap contributors', maxZoom: 19 })
    const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery Ac Esri, Maxar, Earthstar Geographics', maxZoom: 19, opacity: 0 })
    imagery.on('load', () => imagery.setOpacity(1))
    if (mapType === 'aerial') { osm.addTo(map); (osm as any).bringToBack?.(); imagery.addTo(map) } else { osm.addTo(map) }
    setTimeout(() => map.invalidateSize(), 150)
    mapRef.current = map
  }, [jobs])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let imagery: any = null
    let osm: any = null
    Object.values((map as any)._layers || {}).forEach((ly: any) => {
      if (ly && ly._url && String(ly._url).includes('ArcGIS/rest/services/World_Imagery')) imagery = ly
      if (ly && ly.getAttribution && String(ly.getAttribution()).includes('OpenStreetMap')) osm = ly
    })
    if (!osm) {
      osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'Ac OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
    }
    if (mapType === 'aerial') {
      try { osm && (osm as any).bringToBack?.() } catch {}
      if (imagery) {
        imagery.setOpacity?.(0)
        imagery.addTo?.(map)
        imagery.once?.('load', () => imagery.setOpacity?.(1))
      } else {
        const im = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery Ac Esri, Maxar, Earthstar Geographics', maxZoom: 19, opacity: 0 }).addTo(map)
        im.once('load', () => im.setOpacity(1))
      }
    } else {
      if (imagery) try { map.removeLayer(imagery) } catch {}
      osm.addTo(map)
    }
  }, [mapType])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pts: L.LatLngExpression[] = []
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Polygon) map.removeLayer(layer)
    })
    const items = jobs.filter((j) => typeof j.lat === 'number' && typeof j.lon === 'number')
    if (clusterOn && items.length > 30) {
      const zoom = map.getZoom()
      const factor = Math.max(1, 12 - zoom)
      const bins = new Map<string, { lat: number; lon: number; count: number; sample: any }>()
      for (const j of items) {
        const key = `${(j.lat).toFixed(factor)}_${(j.lon).toFixed(factor)}`
        const b = bins.get(key) || { lat: 0, lon: 0, count: 0, sample: j }
        b.lat += j.lat
        b.lon += j.lon
        b.count += 1
        b.sample = j
        bins.set(key, b)
      }
      for (const [, b] of bins) {
        const lat = b.lat / b.count
        const lon = b.lon / b.count
        const marker = L.marker([lat, lon]).addTo(map)
        marker.bindPopup(b.count > 1 ? `${b.count} sites near here` : `<strong>${escapeHtml(b.sample.clientName || '')}</strong>${b.sample.siteName ? ' - ' + escapeHtml(b.sample.siteName) : ''}`)
        pts.push([lat, lon])
      }
    } else {
      for (const j of items) {
        const latlng: L.LatLngExpression = [j.lat, j.lon]
        L.marker(latlng).addTo(map).bindPopup(`<strong>${escapeHtml(j.clientName || '')}</strong>${j.siteName ? ' - ' + escapeHtml(j.siteName) : ''}`)
        pts.push(latlng)
      }
    }
    for (const p of polys) {
      const poly: [number, number][] = p.polygon || []
      if (poly.length >= 3) {
        const layer = L.polygon(poly as any, { color: p.color || '#16a34a', fillOpacity: 0.12, weight: 2 })
        layer.addTo(map)
        poly.forEach(([lat, lon]) => pts.push([lat, lon]))
      }
    }
    const contactPoints = clientEntries.filter((entry) => typeof entry.lat === 'number' && typeof entry.lon === 'number')
    for (const entry of contactPoints) {
      const latlng: L.LatLngExpression = [entry.lat as number, entry.lon as number]
      const marker = L.circleMarker(latlng, { radius: 7, color: '#7c3aed', weight: 2, fillColor: '#ede9fe', fillOpacity: 0.9 }).addTo(map)
      marker.bindPopup(`<strong>${escapeHtml(entry.clientName || '')}</strong>${entry.address ? '<br/>' + escapeHtml(entry.address) : ''}`)
      marker.on('click', () => setOpenClientId(entry.id))
      pts.push(latlng)
    }
    if (pts.length > 1) {
      const bounds = L.latLngBounds(pts)
      map.fitBounds(bounds, { padding: [24, 24] })
    } else if (pts.length === 1) {
      map.setView(pts[0] as any, 13)
    }
  }, [jobs, polys, clusterOn, clientEntries])

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
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3>Client Bank</h3>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search clients, addresses, or contacts"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            disabled={clientEntries.length === 0}
          />
        </div>
        {clientEntries.length === 0 ? (
          <div className="muted">No saved clients yet. Developers can add them from the Client Bank on the Developer page.</div>
        ) : filteredClients.length === 0 ? (
          <div className="muted">No matches for "{clientFilter}".</div>
        ) : (
          <div className="accordion">
            {filteredClients.map((entry) => {
              const open = openClientId === entry.id
              const contacts = normalizeContacts(entry)
              const hasCoords = typeof entry.lat === 'number' && typeof entry.lon === 'number'
              return (
                <section key={entry.id} className="accordion-item accent-green">
                  <button className="accordion-button" aria-expanded={open} onClick={() => setOpenClientId(open ? null : entry.id)}>
                    <span>{entry.clientName || entry.address}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {open && (
                    <div className="accordion-panel">
                      <div style={{ display: 'grid', gap: 8 }}>
                        {entry.address && <div><strong>Address:</strong> {entry.address}</div>}
                        {entry.contactName && <div><strong>Primary Contact:</strong> {entry.contactName}</div>}
                        {entry.primaryPhone && (
                          <div>
                            <strong>Primary Phone:</strong> <a href={`tel:${entry.primaryPhone}`}>{entry.primaryPhone}</a>
                          </div>
                        )}
                        {contacts.length > 0 && (
                          <div>
                            <strong>Team Contacts:</strong>
                            <ul style={{ margin: '4px 0 0 18px', padding: 0, listStyle: 'disc' }}>
                              {contacts.map((contact) => (
                                <li key={contact.id}>
                                  {contact.label ? `${contact.label}: ` : ''}
                                  <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {hasCoords && <div><strong>Coordinates:</strong> {(entry.lat as number).toFixed(5)}, {(entry.lon as number).toFixed(5)}</div>}
                        {entry.notes && <div><strong>Notes:</strong> {entry.notes}</div>}
                      </div>
                      <div className="row" style={{ marginTop: 10, gap: 8 }}>
                        <button
                          className="btn secondary"
                          disabled={!hasCoords}
                          onClick={() => {
                            if (mapRef.current && hasCoords) {
                              mapRef.current.setView([entry.lat as number, entry.lon as number], 15)
                              setOpenClientId(entry.id)
                            }
                          }}
                        >
                          Show on Map
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </section>
      <section className="card">
        <h3>Sites Table</h3>
        {jobs.length === 0 ? (
          <div className="muted">No jobs yet</div>
        ) : (
          <table className="table">
            <thead><tr><th>Client</th><th>Site</th><th>Address</th><th>City</th><th>County</th><th>Zip</th><th>Location</th><th>Actions</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.clientName}</td>
                  <td>{j.siteName || '-'}</td>
                  <td>{j.address || '-'}</td>
                  <td>{j.city || '-'}</td>
                  <td>{j.county || '-'}</td>
                  <td>{j.zip || '-'}</td>
                  <td>{typeof j.lat === 'number' && typeof j.lon === 'number' ? `${j.lat.toFixed(5)}, ${j.lon.toFixed(5)}` : '-'}</td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        if (mapRef.current && typeof j.lat === 'number' && typeof j.lon === 'number') {
                          mapRef.current.setView([j.lat, j.lon], 15)
                        }
                      }}
                    >
                      Zoom
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c] || c)
}
