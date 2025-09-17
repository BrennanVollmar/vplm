import { useEffect, useMemo, useState } from 'react'
import { db } from '../features/offline/db'

function useObjectUrl(blob?: Blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}

function PhotoThumb({ p }: { p: any }) {
  const blobUrl = useObjectUrl(p.blob)
  const src = blobUrl || p.localUri
  return (
    <img key={p.id} src={src} alt={p.caption || 'photo'} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }} />
  )
}

export default function PhotoGallery({ jobId }: { jobId: string }) {
  const [photos, setPhotos] = useState<any[]>([])
  useEffect(() => {
    let active = true
    const load = async () => {
      const list = await db.photos.where('jobId').equals(jobId).reverse().sortBy('createdAt')
      if (active) setPhotos(list)
    }
    load()
    return () => { active = false }
  }, [jobId])

  if (photos.length === 0) return <p>No photos yet.</p>

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {photos.map((p) => (
        <PhotoThumb key={p.id} p={p} />
      ))}
    </div>
  )
}
