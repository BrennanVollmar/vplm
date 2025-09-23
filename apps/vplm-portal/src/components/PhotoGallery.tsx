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
  const [viewer, setViewer] = useState<{ open: boolean; index: number } | null>(null)
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
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {photos.map((p, i) => (
          <div key={p.id} onClick={() => setViewer({ open: true, index: i })} style={{ cursor: 'pointer' }}>
            <PhotoThumb p={p} />
          </div>
        ))}
      </div>
      {viewer?.open && (
        <Lightbox photos={photos} index={viewer.index} onClose={() => setViewer(null)} onPrev={() => setViewer(v => ({ open: true, index: (v!.index + photos.length - 1) % photos.length }))} onNext={() => setViewer(v => ({ open: true, index: (v!.index + 1) % photos.length }))} />
      )}
    </>
  )
}

function Lightbox({ photos, index, onClose, onPrev, onNext }: { photos: any[]; index: number; onClose: () => void; onPrev: () => void; onNext: () => void }) {
  const p = photos[index]
  const src = useObjectUrl(p.blob) || p.localUri
  if (!src) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'grid', placeItems: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn warn" onClick={async (e) => { e.stopPropagation(); if (!confirm('Really delete this photo?')) return; await db.photos.delete(p.id); onClose(); location.reload() }}>Delete</button>
      </div>
      <button className="btn" style={{ position: 'absolute', left: 16, top: '50%' }} onClick={(e) => { e.stopPropagation(); onPrev() }}>{'<'}</button>
      <img src={src} alt={p.caption || 'photo'} style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
      <button className="btn" style={{ position: 'absolute', right: 16, top: '50%' }} onClick={(e) => { e.stopPropagation(); onNext() }}>{'>'}</button>
    </div>
  )
}
