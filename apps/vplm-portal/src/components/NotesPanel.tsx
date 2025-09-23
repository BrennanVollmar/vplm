import { useEffect, useMemo, useState } from 'react'
import { db, saveNote, saveAudioNote, updateAudioNote, logJob, getActor } from '../features/offline/db'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { ensureAudioBlob } from '../lib/audio'
import { getTranscriptionKey, normalizeLanguageTag, transcribeWithOpenAI } from '../lib/transcribe'

export default function NotesPanel({ jobId }: { jobId: string }) {
  const [text, setText] = useState('')
  const [notes, setNotes] = useState<any[]>([])
  const [memos, setMemos] = useState<any[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string>('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  const {
    isRecording,
    startRecording,
    stopRecording,
    error: recordingError,
    resetError: resetRecordingError,
    isSupported: recordingSupported,
  } = useAudioRecorder({ deviceId, minDurationMs: 800 })

  useEffect(() => {
    if (recordingError) setStatusMessage(recordingError)
  }, [recordingError])

  useEffect(() => {
    let active = true
    const load = async () => {
      const rows = await db.audioNotes.where('jobId').equals(jobId).reverse().sortBy('createdAt')
      if (active) setMemos(rows)
    }
    load()
    const timer = setInterval(load, 2000)
    return () => { active = false; clearInterval(timer) }
  }, [jobId])

  useEffect(() => {
    let active = true
    const loadNotes = async () => {
      const list = await db.notes.where('jobId').equals(jobId).reverse().sortBy('createdAt')
      if (active) setNotes(list)
    }
    loadNotes()
    const t = setInterval(loadNotes, 2000)
    return () => { active = false; clearInterval(t) }
  }, [jobId])

  useEffect(() => {
    async function loadDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return
        const list = await navigator.mediaDevices.enumerateDevices()
        const inputs = list.filter((d) => d.kind === 'audioinput') as MediaDeviceInfo[]
        setAudioDevices(inputs)
        if (!deviceId && inputs[0]?.deviceId) setDeviceId(inputs[0].deviceId)
      } catch {
        // ignore
      }
    }
    loadDevices()
  }, [deviceId])

  async function addTextNote(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    const now = new Date().toISOString()
    await saveNote({ id: crypto.randomUUID(), jobId, text: body, createdAt: now } as any)
    await logJob(jobId, 'note_add', `Added note: ${body.slice(0, 40)}`, getActor())
    setText('')
  }

  async function handleStartRecording() {
    setStatusMessage(null)
    resetRecordingError()
    try {
      await startRecording()
    } catch (err: any) {
      const message = err?.message || 'Could not start recording.'
      setStatusMessage(message)
    }
  }

  async function handleStopRecording() {
    try {
      const result = await stopRecording()
      const durationSec = Math.max(1, Math.round(result.durationMs / 1000))
      const now = new Date().toISOString()
      const lang = normalizeLanguageTag(navigator.language)
      await saveAudioNote({ id: crypto.randomUUID(), jobId, blob: result.blob, createdAt: now, mimeType: result.mimeType, lang, durationSec })
      const rows = await db.audioNotes.where('jobId').equals(jobId).reverse().sortBy('createdAt')
      setMemos(rows)
      setStatusMessage(null)
    } catch (err: any) {
      const message = err?.message || 'Recording did not capture any audio.'
      setStatusMessage(message)
    }
  }

  async function transcribe(a: any) {
    try {
      if (!getTranscriptionKey()) { alert('Add an OpenAI API key in Settings to enable transcription.'); return }
      setBusyId(a.id)
      const blob = ensureAudioBlob(a)
      if (!blob) {
        alert('Audio data is unavailable. Please re-record this memo and try again.')
        return
      }
      const textValue = await transcribeWithOpenAI(blob, { language: normalizeLanguageTag(a.lang) })
      await updateAudioNote(a.id, { transcript: textValue })
      await logJob(jobId, 'audio_transcribed', `Transcribed audio note (${(textValue || '').slice(0, 40)})`, getActor())
      const rows = await db.audioNotes.where('jobId').equals(jobId).reverse().sortBy('createdAt')
      setMemos(rows)
    } catch (e: any) {
      alert(e?.message || 'Transcription failed')
    } finally {
      setBusyId(null)
    }
  }

  async function promoteTranscript(a: any) {
    if (!a?.transcript) return
    const noteText = `Voice memo transcript: ${a.transcript}`
    const now = new Date().toISOString()
    const noteId = crypto.randomUUID()
    await saveNote({ id: noteId, jobId, text: noteText, createdAt: now } as any)
    await updateAudioNote(a.id, { promotedNoteId: noteId })
    await logJob(jobId, 'note_add', `Converted voice memo to note: ${(a.transcript || '').slice(0, 40)}`, getActor())
    const [memoRows, noteRows] = await Promise.all([
      db.audioNotes.where('jobId').equals(jobId).reverse().sortBy('createdAt'),
      db.notes.where('jobId').equals(jobId).reverse().sortBy('createdAt'),
    ])
    setMemos(memoRows)
    setNotes(noteRows)
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <form className="row" style={{ gap: 8 }} onSubmit={addTextNote}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Add a note..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" type="submit">Add</button>
      </form>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {audioDevices.length > 0 && (
          <label className="row" style={{ gap: 6 }}>
            <span className="muted">Mic</span>
            <select className="select" value={deviceId} onChange={(e) => { setDeviceId(e.target.value); setStatusMessage(null) }}>
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
              ))}
            </select>
            <button type="button" className="btn secondary" onClick={async () => {
              try {
                const list = await navigator.mediaDevices.enumerateDevices()
                setAudioDevices(list.filter((d) => d.kind === 'audioinput') as MediaDeviceInfo[])
              } catch { /* ignore */ }
            }}>Refresh</button>
          </label>
        )}
        {recordingSupported ? (
          !isRecording ? (
            <button className="btn" onClick={handleStartRecording} title="Requires an available microphone">Record Voice Memo</button>
          ) : (
            <button className="btn warn" onClick={handleStopRecording}>Stop</button>
          )
        ) : (
          <button className="btn" disabled title="MediaRecorder not supported">Record Voice Memo</button>
        )}
      </div>

      {statusMessage && (
        <div className="muted" style={{ color: 'var(--danger, #dc2626)' }}>{statusMessage}</div>
      )}

      {notes.length > 0 && (
        <section className="card">
          <h4>Text Notes</h4>
          <ul className="list">
            {notes.map((n) => {
              const isEditing = editingId === n.id
              return (
                <li key={n.id}>
                  <small className="muted">{new Date(n.createdAt).toLocaleString()}</small>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                      {isEditing ? (
                        <textarea className="textarea" value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={Math.max(2, editingText.split('\n').length)} />
                      ) : (
                        n.text
                      )}
                    </div>
                    {isEditing ? (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn secondary" onClick={() => { setEditingId(null); setEditingText('') }}>Cancel</button>
                        <button className="btn" onClick={async () => {
                          const trimmed = editingText.trim()
                          if (!trimmed) { alert('Note cannot be empty.'); return }
                          await db.notes.update(n.id, { text: trimmed })
                          await logJob(jobId, 'note_edit', `Updated note: ${trimmed.slice(0, 40)}`, getActor())
                          const updated = await db.notes.where('jobId').equals(jobId).reverse().sortBy('createdAt')
                          setNotes(updated)
                          setEditingId(null)
                          setEditingText('')
                        }}>Save</button>
                      </div>
                    ) : (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn secondary" onClick={() => { setEditingId(n.id); setEditingText(n.text || '') }}>Edit</button>
                        <button className="btn warn" onClick={async () => {
                          if (!confirm('Delete this note?')) return
                          await db.notes.delete(n.id)
                          setNotes(await db.notes.where('jobId').equals(jobId).reverse().sortBy('createdAt'))
                        }}>Delete</button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {memos.length === 0 ? (
        <div className="muted">No voice memos yet.</div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {memos.map((a) => (
            <div key={a.id} className="card" style={{ padding: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <small className="muted">{new Date(a.createdAt).toLocaleString()}</small>
                <div className="row" style={{ gap: 8 }}>
                  <AudioPlayer note={a} />
                  <button className="btn" disabled={!!busyId} onClick={() => transcribe(a)}>{busyId === a.id ? 'Transcribing...' : 'Transcribe'}</button>
                  <button className="btn warn" onClick={async () => { if (!confirm('Delete this voice memo?')) return; await db.audioNotes.delete(a.id); setMemos(await db.audioNotes.where('jobId').equals(jobId).reverse().sortBy('createdAt')) }}>Delete</button>
                </div>
              </div>
              {a.transcript && (
                <div style={{ marginTop: 6 }}>
                  <strong>Transcript:</strong> <div>{a.transcript}</div>
                  <div className="row" style={{ marginTop: 6, gap: 8 }}>
                    <button className="btn secondary" disabled={!!a.promotedNoteId} onClick={() => promoteTranscript(a)}>
                      {a.promotedNoteId ? 'Saved To Notes' : 'Save Transcript as Note'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AudioPlayer({ note }: { note: any }) {
  const blob = useMemo(() => ensureAudioBlob(note), [note])
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (!url || !blob) {
    return <span className="muted">Audio unavailable</span>
  }
  const type = blob.type || note?.mimeType || 'audio/webm'
  return (
    <audio controls>
      <source src={url} type={type} />
      Your browser does not support audio playback.
    </audio>
  )
}
