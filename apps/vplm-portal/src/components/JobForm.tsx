import { useEffect, useState } from 'react'
import { saveJob, db } from '../features/offline/db'
import { apiFetch } from '../lib/api'
import { listUsersLocal } from '../features/users/local'
import AddressAutocomplete from './AddressAutocomplete'
import type { AddressSuggestion } from '../lib/places'

export default function JobForm({ onCreated }: { onCreated: (jobId: string) => void }) {
  const [clientName, setClientName] = useState('')
  const [siteName, setSiteName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [county, setCounty] = useState('')
  const [zip, setZip] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [employees, setEmployees] = useState<Array<{ id: string; name?: string; phone: string }>>([])
  const [cities, setCities] = useState<string[]>([])
  const [counties, setCounties] = useState<string[]>([])
  const [addressCoords, setAddressCoords] = useState<{ lat?: number; lon?: number } | null>(null)

  useEffect(() => {
    const def = localStorage.getItem('defaultEmployee')
    if (def) setCreatedBy(def)
    apiFetch('/users')
      .then((j) => {
        setEmployees(j.users || [])
      })
      .catch(() => {
        setEmployees(listUsersLocal())
      })
    ;(async () => {
      try {
        const all = await db.jobs.toArray()
        const cs = new Set<string>()
        const cos = new Set<string>()
        all.forEach((j) => {
          if (j.city) cs.add(j.city)
          if (j.county) cos.add(j.county)
        })
        setCities(Array.from(cs).sort())
        setCounties(Array.from(cos).sort())
      } catch {}
    })()
  }, [])
  const [useLocation, setUseLocation] = useState(false)
  const [locNote, setLocNote] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  function onAddressChange(value: string) {
    setAddress(value)
    setAddressCoords(null)
  }

  function onAddressSelect(suggestion: AddressSuggestion) {
    setAddress(suggestion.label)
    setAddressCoords({ lat: suggestion.lat, lon: suggestion.lon })
    if (!city && suggestion.city) setCity(suggestion.city)
    if (!zip && suggestion.postalCode) setZip(suggestion.postalCode)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim()) return
    setSubmitting(true)
    try {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      let lat: number | undefined
      let lon: number | undefined
      if (useLocation && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
          })
          lat = pos.coords.latitude
          lon = pos.coords.longitude
          setLocNote('Location captured.')
        } catch (err: any) {
          setLocNote('Could not capture location. Ensure you are on site and allow location access.')
        }
      } else if (addressCoords?.lat != null && addressCoords?.lon != null) {
        lat = addressCoords.lat
        lon = addressCoords.lon
      }
      await saveJob({
        id,
        clientName,
        siteName,
        address,
        city: city || undefined,
        county: county || undefined,
        zip: zip || undefined,
        lat,
        lon,
        createdBy: createdBy || undefined,
        createdAt: now,
        updatedAt: now,
      })
      setClientName('')
      setSiteName('')
      setAddress('')
      setAddressCoords(null)
      setCity('')
      setCounty('')
      setZip('')
      setCreatedBy('')
      onCreated(id)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'grid', gap: 10, maxWidth: 760, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
    >
      <label className="label">
        Client Name
        <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
      </label>
      <label className="label">
        Site Name
        <input className="input" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
      </label>
      <div style={{ gridColumn: '1 / -1' }}>
        <AddressAutocomplete
          id="job-address"
          label="Address"
          value={address}
          onChange={onAddressChange}
          onSelect={onAddressSelect}
          placeholder="Start typing an address"
        />
      </div>
      <label className="label">
        City
        <input className="input" list="cities-list" value={city} onChange={(e) => setCity(e.target.value)} />
        <datalist id="cities-list">
          {cities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="label">
        County
        <input className="input" list="counties-list" value={county} onChange={(e) => setCounty(e.target.value)} />
        <datalist id="counties-list">
          {counties.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="label">
        Zip
        <input
          className="input"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          pattern="^\d{5}(?:-\d{4})?$"
          title="Enter 5-digit ZIP or ZIP+4"
        />
      </label>
      <label className="label" style={{ gridColumn: '1 / -1' }}>
        Employee Name
        <input list="employees-list" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Your name" />
        <datalist id="employees-list">
          {employees.map((u) => (
            <option key={u.id} value={u.name || u.phone} />
          ))}
        </datalist>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={useLocation} onChange={(e) => setUseLocation(e.target.checked)} />
        Store current location (must be on site and allow location access)
      </label>
      {locNote && <small style={{ color: '#555' }}>{locNote}</small>}
      <div style={{ gridColumn: '1 / -1' }}>
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Job'}
        </button>
      </div>
    </form>
  )
}
