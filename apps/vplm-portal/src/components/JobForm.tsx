import { useEffect, useState } from 'react'
import { saveJob } from '../features/offline/db'

export default function JobForm({ onCreated }: { onCreated: (jobId: string) => void }) {
  const [clientName, setClientName] = useState('')
  const [siteName, setSiteName] = useState('')
  const [address, setAddress] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  useEffect(() => {
    const def = localStorage.getItem('defaultEmployee')
    if (def) setCreatedBy(def)
  }, [])
  const [useLocation, setUseLocation] = useState(false)
  const [locNote, setLocNote] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

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
      }
      await saveJob({ id, clientName, siteName, address, lat, lon, createdBy: createdBy || undefined, createdAt: now, updatedAt: now })
      setClientName(''); setSiteName(''); setAddress('')
      setCreatedBy('')
      onCreated(id)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
      <label>Client Name<input value={clientName} onChange={(e) => setClientName(e.target.value)} required /></label>
      <label>Site Name<input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></label>
      <label>Address<input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
      <label>Employee Name<input value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Your name" /></label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={useLocation} onChange={(e) => setUseLocation(e.target.checked)} />
        Store current location (must be on site and allow location access)
      </label>
      {locNote && <small style={{ color: '#555' }}>{locNote}</small>}
      <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Job'}</button>
    </form>
  )
}
