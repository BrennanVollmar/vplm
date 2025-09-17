import { db } from '../features/offline/db'

function dataURLToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = /data:(.*?);base64/.exec(header)?.[1] || 'application/octet-stream'
  const bin = atob(data)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function importFromFile(file: File) {
  const text = await file.text()
  const json = JSON.parse(text)

  const jobs = json.jobs || []
  const notes = json.notes || []
  const measurements = json.measurements || []
  const calcResults = json.calcResults || []
  const chemProducts = json.chemProducts || []
  const outbox = json.outbox || []

  const photos = (json.photos || []).map((p: any) => {
    const copy = { ...p }
    if (p.dataUrl && !p.blob) {
      try { copy.blob = dataURLToBlob(p.dataUrl) } catch {}
    }
    delete (copy as any).dataUrl
    return copy
  })

  const chemLabels = (json.chemLabels || []).map((l: any) => {
    const copy = { ...l }
    if (l.dataUrl && !l.blob) {
      try { copy.blob = dataURLToBlob(l.dataUrl) } catch {}
    }
    delete (copy as any).dataUrl
    return copy
  })

  await db.transaction('rw', db.jobs, db.notes, db.measurements, db.calcResults, db.chemProducts, db.chemLabels, db.photos, db.outbox, async () => {
    await db.jobs.bulkPut(jobs)
    await db.notes.bulkPut(notes)
    await db.measurements.bulkPut(measurements)
    if (calcResults.length) await db.calcResults.bulkPut(calcResults)
    if (chemProducts.length) await db.chemProducts.bulkPut(chemProducts)
    if (chemLabels.length && db.chemLabels) await db.chemLabels.bulkPut(chemLabels as any)
    if (photos.length) await db.photos.bulkPut(photos)
    if (outbox.length) await db.outbox.bulkPut(outbox)
  })

  return {
    jobs: jobs.length,
    notes: notes.length,
    measurements: measurements.length,
    photos: photos.length,
    chemProducts: chemProducts.length,
    chemLabels: chemLabels.length,
  }
}

