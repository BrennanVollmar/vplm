import { useEffect, useState } from 'react'
import { db, logJob, updateJob } from '../features/offline/db'
import AddressAutocomplete from './AddressAutocomplete'
import type { AddressSuggestion } from '../lib/places'

export default function JobEdit({ jobId }: { jobId: string }) {
  const [clientName, setClientName] = useState('')
  const [siteName, setSiteName] = useState('')
  const [address, setAddress] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [lat, setLat] = useState<number | undefined>(undefined)
  const [lon, setLon] = useState<number | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const j = await db.jobs.get(jobId)
      if (j) {
        setClientName(j.clientName || '')
        setSiteName(j.siteName || '')
        setAddress(j.address || '')
        setCreatedBy(j.createdBy || localStorage.getItem('defaultEmployee') || '')
        setLat(j.lat)
        setLon(j.lon)
      }
    })()
  }, [jobId])

  function onAddressSelect(suggestion: AddressSuggestion) {
    setAddress(suggestion.label)
    if (suggestion.lat != null) setLat(suggestion.lat)
    if (suggestion.lon != null) setLon(suggestion.lon)
  }

  async function save() {
    setBusy(true)
    try {
      await updateJob(jobId, { clientName, siteName, address, createdBy, lat, lon })
      const actor = localStorage.getItem('defaultEmployee') || undefined
      await logJob(jobId, 'update', 'Updated job details', actor || createdBy || undefined)
      alert('Saved')
    } finally {
      setBusy(false)
    }
  }

  async function useCurrentLocation() {
    if (!('geolocation' in navigator)) return
    setBusy(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      })
      setLat(pos.coords.latitude)
      setLon(pos.coords.longitude)
    } catch (e) {
      alert('Could not get location')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid">
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <label className="label">Client Name
          <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </label>
        <label className="label">Site Name
          <input className="input" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        </label>
        <div className="label" style={{ flex: '1 1 300px' }}>
          <AddressAutocomplete
            id="job-edit-address"
            label="Address"
            value={address}
            onChange={setAddress}
            onSelect={onAddressSelect}
            placeholder="Start typing an address"
          />
        </div>
        <label className="label">Created By
          <input className="input" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="label">Latitude
          <input className="input" value={lat ?? ''} onChange={(e) => setLat(e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="label">Longitude
          <input className="input" value={lon ?? ''} onChange={(e) => setLon(e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <button className="btn secondary" disabled={busy} onClick={useCurrentLocation}>Use Current Location</button>
      </div>
      <div className="row">
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </div>
  )
}
