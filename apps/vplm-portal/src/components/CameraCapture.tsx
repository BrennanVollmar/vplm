import { useRef, useState } from 'react'
import { savePhoto, logJob, getActor } from '../features/offline/db'

export default function CameraCapture({ jobId }: { jobId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    const now = new Date().toISOString()
    // Try to capture location at the time of photo
    let exif: any = {}
    try {
      if ('geolocation' in navigator) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 }))
        exif.lat = pos.coords.latitude
        exif.lon = pos.coords.longitude
        exif.accuracy = pos.coords.accuracy
      }
    } catch {}
    await savePhoto({ id: crypto.randomUUID(), jobId, localUri: url, blob: file, caption: '', createdAt: now, exif })
    await logJob(jobId, 'photo_add', 'Added photo', getActor())
  }

  return (
    <div className="row">
      <input className="input" ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onChange} />
      {preview && (
        <img className="rounded" alt="preview" src={preview} style={{ maxWidth: 200, height: 'auto' }} />
      )}
    </div>
  )
}
