import { db, getAllData } from '../features/offline/db'

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function generateExport(includeMedia: boolean) {
  const data = await getAllData()

  // Expand photos to include data URLs when requested
  const photos = await Promise.all(
    data.photos.map(async (p: any) => {
      const out: any = { ...p }
      if (includeMedia) {
        try {
          if (p.blob instanceof Blob) {
            out.dataUrl = await blobToDataUrl(p.blob)
          } else if (p.localUri && typeof p.localUri === 'string' && p.localUri.startsWith('blob:')) {
            const res = await fetch(p.localUri)
            const blob = await res.blob()
            out.dataUrl = await blobToDataUrl(blob)
          }
        } catch {
          // ignore
        }
      }
      return out
    })
  )

  // Include label PDFs as data URLs if stored
  const chemLabels = await Promise.all(
    (data.chemLabels || []).map(async (l: any) => ({
      id: l.id,
      productId: l.productId,
      filename: l.filename,
      mimeType: l.mimeType,
      size: l.size,
      createdAt: l.createdAt,
      dataUrl: includeMedia ? await blobToDataUrl(l.blob) : undefined,
    }))
  )

  const payload = {
    exportedAt: new Date().toISOString(),
    jobs: data.jobs,
    notes: data.notes,
    photos,
    measurements: data.measurements,
    calcResults: data.calcResults,
    chemProducts: data.chemProducts,
    chemLabels,
    outbox: data.outbox,
    disclaimer: 'Field export for offline backup. Contains estimates only — verify against product labels and regulations.'
  }

  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  return { url, size: json.length }
}
