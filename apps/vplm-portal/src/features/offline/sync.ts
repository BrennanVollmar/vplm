import { db, OutboxItem } from './db'
import { isSupabaseConfigured, supabase, PHOTO_BUCKET } from '../../lib/supabase'
import type { FieldNote, Job, Measurement, Photo } from '../../types'

// Placeholder sync. Integrate Supabase/Firebase here later.
export async function trySync(): Promise<{ pushed: number; pulled: number }> {
  if (!isSupabaseConfigured) {
    return { pushed: 0, pulled: 0 }
  }

  const items: OutboxItem[] = await db.outbox.toArray()
  let pushed = 0
  for (const item of items) {
    try {
      if (item.type === 'job') await pushJob(item.payload as Job)
      else if (item.type === 'note') await pushNote(item.payload as FieldNote)
      else if (item.type === 'measurement') await pushMeasurement(item.payload as Measurement)
      else if (item.type === 'photo') await pushPhoto(item.payload as Photo)
      await db.outbox.delete(item.id)
      pushed += 1
    } catch (e) {
      // leave in outbox if failed
      console.warn('Sync push failed for', item.type, item.id, e)
    }
  }

  const pulled = await pullRemote()
  return { pushed, pulled }
}

export async function getOutboxCount(): Promise<number> {
  return db.outbox.count()
}

async function pushJob(job: Job) {
  const { error } = await supabase.from('jobs').upsert(job, { onConflict: 'id' })
  if (error) throw error
}

async function pushNote(note: FieldNote) {
  const { error } = await supabase.from('notes').upsert(note, { onConflict: 'id' })
  if (error) throw error
}

async function pushMeasurement(m: Measurement) {
  const { error } = await supabase.from('measurements').upsert(m, { onConflict: 'id' })
  if (error) throw error
}

async function pushPhoto(p: Photo) {
  // 1) Ensure DB row exists
  const base = { id: p.id, jobId: p.jobId, caption: p.caption ?? '', createdAt: p.createdAt, serverUri: p.serverUri ?? null }
  {
    const { error } = await supabase.from('photos').upsert(base, { onConflict: 'id' })
    if (error) throw error
  }
  // 2) If we have a blob and not yet uploaded, upload to storage
  if (p.blob && !p.serverUri) {
    const ext = guessExt(p.blob.type)
    const path = `${p.jobId}/${p.id}${ext}`
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, p.blob, { upsert: true, contentType: p.blob.type || 'image/jpeg' })
    if (upErr && !String(upErr.message || '').includes('The resource already exists')) throw upErr
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
    const url = data.publicUrl
    // 3) Update row with serverUri
    const { error: updErr } = await supabase.from('photos').update({ serverUri: url }).eq('id', p.id)
    if (updErr) throw updErr
    // 4) Reflect locally
    await db.photos.update(p.id, { serverUri: url })
  }
}

function guessExt(mime: string): string {
  if (!mime) return '.jpg'
  if (mime.includes('png')) return '.png'
  if (mime.includes('webp')) return '.webp'
  if (mime.includes('jpeg')) return '.jpg'
  if (mime.includes('jpg')) return '.jpg'
  return '.jpg'
}

async function pullRemote(): Promise<number> {
  // Basic pull of latest jobs/notes/measurements; real world should use delta sync
  let count = 0
  try {
    const tables: Array<{ name: string; upsert: (rows: any[]) => Promise<void> }> = [
      { name: 'jobs', upsert: (rows) => db.jobs.bulkPut(rows) },
      { name: 'notes', upsert: (rows) => db.notes.bulkPut(rows) },
      { name: 'measurements', upsert: (rows) => db.measurements.bulkPut(rows) },
      // photos table: do not overwrite local blobs; just update metadata
      { name: 'photos', upsert: async (rows) => {
        for (const r of rows) {
          const existing = await db.photos.get(r.id)
          await db.photos.put({ ...(existing || {}), ...r })
        }
      } },
    ]
    for (const t of tables) {
      const { data, error } = await supabase.from(t.name).select('*').limit(500)
      if (error) throw error
      if (data && data.length) {
        await t.upsert(data as any[])
        count += data.length
      }
    }
  } catch (e) {
    console.warn('Pull failed', e)
  }
  return count
}
