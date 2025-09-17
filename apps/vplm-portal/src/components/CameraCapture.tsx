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
    await savePhoto({ id: crypto.randomUUID(), jobId, localUri: url, blob: file, caption: '', createdAt: now })
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
