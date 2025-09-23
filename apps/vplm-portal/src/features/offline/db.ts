import Dexie, { Table } from 'dexie'
import type { CalcResult, ChemLabel, ChemProduct, FieldNote, Job, Measurement, Photo } from '../../types'

export interface OutboxItem {
  id: string
  type: 'note' | 'photo' | 'measurement' | 'job'
  op: 'create' | 'update' | 'delete'
  payload: any
  createdAt: string
}

class TpmDB extends Dexie {
  jobs!: Table<Job, string>
  notes!: Table<FieldNote, string>
  photos!: Table<Photo, string>
  measurements!: Table<Measurement, string>
  calcResults!: Table<CalcResult, string>
  chemProducts!: Table<ChemProduct, string>
  chemLabels!: Table<ChemLabel, string>
  outbox!: Table<OutboxItem, string>
  tracks!: Table<Track, string>
  waterQuality!: Table<WaterQualityEntry, string>
  checklists!: Table<ChecklistItem, string>
  audioNotes!: Table<AudioNote, string>
  timeEntries!: Table<TimeEntry, string>
  tasks!: Table<JobTask, string>
  fishSessions!: Table<FishSession, string>
  fishCounts!: Table<FishCount, string>
  fishRuns!: Table<FishRun, string>
  fishStops!: Table<FishStop, string>
  chemRefs!: Table<ChemRef, string>
  profiles!: Table<Profile, string>
  jobLogs!: Table<JobLogEntry, string>
  acreage!: Table<AcreageTrace, string>
  depthPoints!: Table<DepthPoint, string>
  ponds!: Table<PondOutline, string>
  miscPoints!: Table<MiscPoint, string>
  addressBank!: Table<AddressBankEntry, string>

  constructor() {
    super('tpm_field_db')
    this.version(1).stores({
      jobs: 'id, clientName, createdAt, updatedAt',
      notes: 'id, jobId, createdAt',
      photos: 'id, jobId, createdAt',
      measurements: 'id, jobId, createdAt',
      calcResults: 'id, jobId, createdAt',
      chemProducts: 'id, brand, active',
      outbox: 'id, type, op, createdAt'
    })
    this.version(2).stores({
      chemLabels: 'id, productId, createdAt'
    })
    this.version(3).stores({
      jobs: 'id, clientName, createdAt, updatedAt, createdBy'
    })
    this.version(4).stores({
      tracks: 'id, jobId, createdAt',
      waterQuality: 'id, jobId, createdAt, kind',
      checklists: 'id, jobId, createdAt, kind'
    })
    this.version(5).stores({
      audioNotes: 'id, jobId, createdAt'
    })
    this.version(6).stores({
      timeEntries: 'id, jobId, date',
      tasks: 'id, jobId, createdAt, done',
      fishSessions: 'id, jobId, startedAt, endedAt',
      fishCounts: 'id, sessionId, species'
    })
    this.version(7).stores({
      chemRefs: 'id, name'
    })
    this.version(8).stores({
      profiles: 'id'
    })
    this.version(9).stores({
      jobLogs: 'id, jobId, ts, kind'
    })
    this.version(10).stores({
      acreage: 'id, createdAt'
    })
    this.version(11).stores({
      depthPoints: 'id, jobId, createdAt'
    })
    this.version(12).stores({
      ponds: 'id, jobId, createdAt'
    })
    this.version(13).stores({
      miscPoints: 'id, jobId, createdAt'
    })
    this.version(14).stores({
      fishRuns: 'id, createdAt',
      fishStops: 'id, runId, seq'
    })
    this.version(15).stores({
      addressBank: 'id, clientName, address'
    })
  }
}

export const db = new TpmDB()

export async function saveNote(note: FieldNote) {
  await db.notes.put(note)
  await enqueueMutation({ id: note.id, type: 'note', op: 'create', payload: note, createdAt: note.createdAt })
}

export async function savePhoto(photo: Photo) {
  await db.photos.put(photo)
  await enqueueMutation({ id: photo.id, type: 'photo', op: 'create', payload: photo, createdAt: photo.createdAt })
}

export async function saveMeasurement(m: Measurement) {
  await db.measurements.put(m)
  await enqueueMutation({ id: m.id, type: 'measurement', op: 'create', payload: m, createdAt: m.createdAt })
}

export async function enqueueMutation(item: OutboxItem) {
  await db.outbox.put(item)
}

export async function saveJob(job: Job) {
  await db.jobs.put(job)
  await enqueueMutation({ id: job.id, type: 'job', op: 'create', payload: job, createdAt: job.createdAt })
}

export async function updateJob(jobId: string, patch: Partial<Job> & { updatedAt?: string }) {
  const updatedAt = patch.updatedAt || new Date().toISOString()
  await db.jobs.update(jobId, { ...patch, updatedAt })
}

export async function saveChemProduct(p: ChemProduct) {
  await db.chemProducts.put(p)
}

export async function saveChemLabel(label: ChemLabel) {
  await db.chemLabels.put(label)
}

export async function getAllData() {
  const [jobs, notes, photos, measurements, calcResults, chemProducts, chemLabels, outbox] = await Promise.all([
    db.jobs.toArray(),
    db.notes.toArray(),
    db.photos.toArray(),
    db.measurements.toArray(),
    db.calcResults.toArray(),
    db.chemProducts.toArray(),
    db.chemLabels?.toArray?.() ?? Promise.resolve([]),
    db.outbox.toArray(),
  ])
  return { jobs, notes, photos, measurements, calcResults, chemProducts, chemLabels, outbox }
}

// New types for field features
export interface TrackPoint { lat: number; lon: number; ts: string }
export interface Track { id: string; jobId: string; points: TrackPoint[]; createdAt: string }
export interface WaterQualityEntry {
  id: string
  jobId: string
  kind: 'secchi' | 'ph' | 'do' | 'temp' | 'alkalinity' | 'hardness'
  value: number
  unit: string
  depthFt?: number
  createdAt: string
}
export interface ChecklistItem {
  id: string
  jobId: string
  kind: 'safety'
  items: { label: string; checked: boolean }[]
  notes?: string
  createdAt: string
}

export interface AudioNote {
  id: string
  jobId: string
  createdAt: string
  durationSec?: number
  transcript?: string
  mimeType?: string
  lang?: string
  stopId?: string
  data?: ArrayBuffer | Uint8Array
  blob?: Blob // optional in-memory helper; not persisted for compatibility
  promotedNoteId?: string
}

type AudioNotePayload = Omit<AudioNote, 'data'> & {
  data?: ArrayBuffer | Uint8Array
  blob?: Blob
}

export async function saveTrack(t: Track) { await db.tracks.put(t); await enqueueMutation({ id: t.id, type: 'job', op: 'update', payload: { track: true, jobId: t.jobId }, createdAt: t.createdAt }) }
export async function saveWaterQuality(e: WaterQualityEntry) { await db.waterQuality.put(e); await enqueueMutation({ id: e.id, type: 'job', op: 'update', payload: { waterQuality: true, jobId: e.jobId }, createdAt: e.createdAt }) }
export async function saveChecklist(c: ChecklistItem) { await db.checklists.put(c) }
export async function saveAudioNote(note: AudioNotePayload) {
  const { blob, data, mimeType, ...rest } = note
  let resolvedData: Uint8Array | undefined
  if (blob) {
    resolvedData = new Uint8Array(await blob.arrayBuffer())
  } else if (data instanceof Uint8Array) {
    resolvedData = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  } else if (data instanceof ArrayBuffer) {
    resolvedData = new Uint8Array(data)
  }
  const record: AudioNote = {
    ...rest,
    mimeType: mimeType || blob?.type || 'audio/webm',
    ...(resolvedData ? { data: resolvedData } : {}),
  }
  await db.audioNotes.put(record)
}
export async function updateAudioNote(id: string, patch: Partial<AudioNote>) { await db.audioNotes.update(id, patch) }

// Fish Run types
export interface FishRun {
  id: string
  title?: string
  createdAt: string
  plannedAt?: string
  notes?: string
}
export interface FishStop {
  id: string
  runId: string
  seq: number
  client?: string
  site?: string
  address?: string
  lat?: number
  lon?: number
  species?: string
  count?: number
  weightLb?: number
  tankTempF?: number
  pondTempF?: number
  note?: string
  createdAt: string
}

export async function saveFishRun(run: FishRun) { await db.fishRuns.put(run) }
export async function listFishRuns() { return db.fishRuns.orderBy('createdAt').reverse().toArray() }
export async function deleteFishRun(id: string) { await db.fishStops.where('runId').equals(id).delete(); await db.fishRuns.delete(id) }
export async function addFishStop(stop: FishStop) { await db.fishStops.put(stop) }
export async function updateFishStop(id: string, patch: Partial<FishStop>) { await db.fishStops.update(id, patch) }
export async function listFishStops(runId: string) { return db.fishStops.where('runId').equals(runId).sortBy('seq') }

// Job action log
export interface JobLogEntry { id: string; jobId: string; ts: string; actor?: string; kind: string; message: string }
export async function logJob(jobId: string, kind: string, message: string, actor?: string) {
  const entry: JobLogEntry = { id: crypto.randomUUID(), jobId, ts: new Date().toISOString(), kind, message, actor }
  await db.jobLogs.put(entry)
}
export async function getJobLogs(jobId: string) { return db.jobLogs.where('jobId').equals(jobId).reverse().sortBy('ts') }

export function getActor() {
  try { return localStorage.getItem('defaultEmployee') || undefined } catch { return undefined }
}

// Acreage traces (image-based tool)
export interface AcreageTrace {
  id: string
  createdAt: string
  name?: string
  image?: Blob
  imageType?: string
  scaleFeet?: number
  scalePts?: [number, number][] // two points [x,y] in canvas pixel space
  polygon?: [number, number][] // list of [x,y] in canvas pixel space
}
export async function saveAcreageTrace(t: AcreageTrace) { await db.acreage.put(t) }
export async function listAcreageTraces() { return db.acreage.orderBy('createdAt').reverse().toArray() }
export async function getAcreageTrace(id: string) { return db.acreage.get(id) }

// Depth points for aerator planning
export interface DepthPoint { id: string; jobId: string; lat: number; lon: number; depthFt: number; note?: string; createdAt: string; pondId?: string }
export async function addDepthPoint(p: DepthPoint) { await db.depthPoints.put(p) }
export async function listDepthPoints(jobId: string) { return db.depthPoints.where('jobId').equals(jobId).toArray() }
export async function deleteDepthPoint(id: string) { await db.depthPoints.delete(id) }

// Pond outlines (geo polygons per job)
export interface PondOutline { id: string; jobId: string; name?: string; polygon: [number, number][]; createdAt: string; color?: string }
export async function savePond(o: PondOutline) { await db.ponds.put(o) }
export async function listPonds(jobId: string) { return db.ponds.where('jobId').equals(jobId).toArray() }
export async function deletePond(id: string) { await db.ponds.delete(id) }

// Client bank entries (common client sites)
export interface ClientBankContact { id: string; label?: string; phone: string }
export interface AddressBankEntry {
  id: string
  clientName: string
  address: string
  contactName?: string
  primaryPhone?: string
  otherPhones?: string[]
  contacts?: ClientBankContact[]
  notes?: string
  lat?: number
  lon?: number
  createdAt: string
  updatedAt?: string
}
export async function saveAddressBankEntry(entry: AddressBankEntry) { await db.addressBank.put(entry) }
export async function listAddressBankEntries() { return db.addressBank.orderBy('clientName').toArray() }
export async function deleteAddressBankEntry(id: string) { await db.addressBank.delete(id) }

// Miscellaneous points (objects/installs/notes)
export interface MiscPoint { id: string; jobId: string; lat: number; lon: number; name: string; note?: string; createdAt: string }
export async function addMiscPoint(p: MiscPoint) { await db.miscPoints.put(p) }
export async function listMiscPoints(jobId: string) { return db.miscPoints.where('jobId').equals(jobId).toArray() }
export async function deleteMiscPoint(id: string) { await db.miscPoints.delete(id) }

// Time entries (arrival/departure)
export interface TimeEntry {
  id: string
  jobId: string
  date: string
  arrivalAt: string
  departureAt?: string
}

export async function getTimeEntries(jobId: string) {
  return db.timeEntries.where('jobId').equals(jobId).sortBy('arrivalAt')
}

export async function startTimeEntry(jobId: string, date: string) {
  const now = new Date().toISOString()
  const active = await db.timeEntries.where('jobId').equals(jobId).filter((row) => !row.departureAt).first()
  if (active) {
    throw new Error('Already clocked in for this job. Clock out before starting another entry.')
  }
  const entry: TimeEntry = { id: crypto.randomUUID(), jobId, date, arrivalAt: now }
  await db.timeEntries.put(entry)
  return entry
}

export async function stopTimeEntry(jobId: string) {
  const now = new Date().toISOString()
  const active = await db.timeEntries.where('jobId').equals(jobId).filter((row) => !row.departureAt).last()
  if (!active) {
    throw new Error('No active clock-in found for this job.')
  }
  const updated: TimeEntry = { ...active, departureAt: now }
  await db.timeEntries.put(updated)
  return updated
}

// Job tasks
export interface JobTask { id: string; jobId: string; label: string; done: boolean; createdAt: string }
export async function addTask(t: JobTask) { await db.tasks.put(t) }
export async function toggleTask(id: string, done: boolean) { await db.tasks.update(id, { done }) }
export async function getTasks(jobId: string) { return db.tasks.where('jobId').equals(jobId).toArray() }
export async function deleteTask(id: string) { await db.tasks.delete(id) }

// Fishery study
export interface FishSession { id: string; jobId?: string; startedAt: string; endedAt?: string }
export interface FishCount { id: string; sessionId: string; species: string; count: number }
export async function startFishSession(jobId?: string) { const s: FishSession = { id: crypto.randomUUID(), jobId, startedAt: new Date().toISOString() }; await db.fishSessions.put(s); return s }
export async function endFishSession(id: string) { await db.fishSessions.update(id, { endedAt: new Date().toISOString() }) }
export async function addFishCount(sessionId: string, species: string, delta: number) {
  const existing = await db.fishCounts.where({ sessionId, species } as any).first()
  if (existing) { await db.fishCounts.update(existing.id, { count: Math.max(0, existing.count + delta) }) }
  else { await db.fishCounts.put({ id: crypto.randomUUID(), sessionId, species, count: Math.max(0, delta) }) }
}
export async function getFishCounts(sessionId: string) { return db.fishCounts.where('sessionId').equals(sessionId).toArray() }

// Chemical references
export interface ChemRef { id: string; name: string; epaReg?: string; labelUrl?: string }
export async function saveChemRef(c: ChemRef) { await db.chemRefs.put(c) }
export async function listChemRefs() { return db.chemRefs.toArray() }

// Profiles
export interface Profile { id: string; name?: string; insuranceLicense?: string }
export async function saveProfile(p: Profile) { await db.profiles.put(p) }
export async function getProfile(id = 'me') { return db.profiles.get(id) }
