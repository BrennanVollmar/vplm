import { useEffect, useMemo, useRef, useState } from 'react'
import { db, saveNote, saveAudioNote, updateAudioNote, logJob, getActor } from '../features/offline/db'
import { createSpeechRecognizer, isSpeechRecognitionSupported, getTranscriptionKey, transcribeWithOpenAI } from '../lib/transcribe'

export default function NotesPanel({ jobId }: { jobId: string }) {
  // Text notes
  const [text, setText] = useState('')
  const [dictating, setDictating] = useState(false)
  const recRef = useRef<any>(null)

  // Audio recording
  const [mediaRec, setMediaRec] = useState<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const chunksRef = useRef<Blob[]>([])

  // Audio input devices
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string>('')

  // Audio memo list
  const [memos, setMemos] = useState<any[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

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
    async function loadDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return
        const list = await navigator.mediaDevices.enumerateDevices()
        const inputs = list.filter(d => d.kind === 'audioinput')
        setAudioDevices(inputs as MediaDeviceInfo[])
        if (!deviceId && inputs[0]?.deviceId) setDeviceId(inputs[0].deviceId)
      } catch { /* ignore */ }
    }
    loadDevices()
  }, [])

  async function addTextNote(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    const now = new Date().toISOString()
    await saveNote({ id: crypto.randomUUID(), jobId, text: body, createdAt: now } as any)
    await logJob(jobId, 'note_add', `Added note: ${body.slice(0,40)}`, getActor())
    setText('')
  }

  function startDictation() {
    if (!isSpeechRecognitionSupported()) { alert('Speech recognition not supported in this browser'); return }
    try {
      const rec = createSpeechRecognizer({
        onResult: (snippet, _final) => {
          setText((prev) => (prev ? prev + ' ' : '') + String(snippet || '').trim())
        },
        onEnd: () => setDictating(false),
        onError: () => setDictating(false),
      })
      recRef.current = rec
      rec.start()
      setDictating(true)
    } catch (e: any) {
      alert(e?.message || 'Could not start dictation')
    }
  }

  function stopDictation() {
    try { recRef.current?.stop?.() } catch {}
    setDictating(false)
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) { alert('Microphone not supported'); return }
      const constraints: any = deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const mime = pickSupportedMime()
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      r.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data) }
      r.onstop = async () => {
        const type = r.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        const now = new Date().toISOString()
        await saveAudioNote({ id: crypto.randomUUID(), jobId, blob, createdAt: now, mimeType: type, lang: navigator.language } as any)
        try { stream.getTracks().forEach(t => t.stop()) } catch {}
      }
      r.start()
      setMediaRec(r)
      setRecording(true)
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (/NotFoundError|Requested device not found/i.test(msg)) {
        alert('No microphone found or selected. Check device connection and site permissions, then click Refresh and try again.')
      } else if (/NotAllowedError|denied/i.test(msg)) {
        alert('Microphone permission denied. Enable mic access for this site and try again.')
      } else {
        alert(msg || 'Could not start recording')
      }
    }
  }

  function stopRecording() {
    try { mediaRec?.stop() } finally { setRecording(false); setMediaRec(null) }
  }

  function pickSupportedMime(): string | undefined {
    const mimes = ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/webm']
    for (const m of mimes) { if ((window as any).MediaRecorder?.isTypeSupported?.(m)) return m }
    return undefined
  }

  async function transcribe(a: any) {
    try {
      if (!getTranscriptionKey()) { alert('Add an OpenAI API key in Settings to enable transcription.'); return }
      setBusyId(a.id)
      const text = await transcribeWithOpenAI(a.blob, { language: a.lang })
      await updateAudioNote(a.id, { transcript: text })
      await logJob(jobId, 'audio_transcribed', `Transcribed audio note (${(text || '').slice(0, 40)})`, getActor())
      const rows = await db.audioNotes.where('jobId').equals(jobId).reverse().sortBy('createdAt')
      setMemos(rows)
    } catch (e: any) {
      alert(e?.message || 'Transcription failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <form className="row" style={{ gap: 8 }} onSubmit={addTextNote}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder={dictating ? 'Listening… speak to dictate' : 'Add a note...'} value={text} onChange={(e) => setText(e.target.value)} />
        {isSpeechRecognitionSupported() ? (
          !dictating ? (
            <button type="button" className="btn secondary" onClick={startDictation}>Dictate</button>
          ) : (
            <button type="button" className="btn warn" onClick={stopDictation}>Stop</button>
          )
        ) : (
          <button type="button" className="btn secondary" disabled title="Speech recognition not supported">Dictate</button>
        )}
        <button className="btn" type="submit">Add</button>
      </form>

      <div className="row" style={{ gap: 8 }}>
        {audioDevices.length > 0 && (
          <label className="row" style={{ gap: 6 }}>
            <span className="muted">Mic</span>
            <select className="select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              {audioDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
              ))}
            </select>
            <button type="button" className="btn secondary" onClick={async () => {
              try {
                const list = await navigator.mediaDevices.enumerateDevices()
                setAudioDevices(list.filter(d => d.kind === 'audioinput') as MediaDeviceInfo[])
              } catch {}
            }}>Refresh</button>
          </label>
        )}
        {!recording ? (
          <button className="btn" onClick={startRecording} title="Requires an available microphone">Record Voice Memo</button>
        ) : (
          <button className="btn warn" onClick={stopRecording}>Stop</button>
        )}
      </div>

      {memos.length === 0 ? (
        <div className="muted">No voice memos yet.</div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {memos.map((a) => (
            <div key={a.id} className="card" style={{ padding: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <small className="muted">{new Date(a.createdAt).toLocaleString()}</small>
                <div className="row" style={{ gap: 8 }}>
                  <AudioPlayer blob={a.blob} />
                  <button className="btn" disabled={!!busyId} onClick={() => transcribe(a)}>{busyId === a.id ? 'Transcribing…' : 'Transcribe'}</button>
                </div>
              </div>
              {a.transcript && (
                <div style={{ marginTop: 6 }}>
                  <strong>Transcript:</strong> <div>{a.transcript}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AudioPlayer({ blob }: { blob?: Blob }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (!url) return null
  return <audio controls src={url} />
}
