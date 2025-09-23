export function getTranscriptionKey(): string | undefined {
  try { return localStorage.getItem('openai_api_key') || undefined } catch { return undefined }
}

export function normalizeLanguageTag(tag?: string | null) {
  if (!tag) return undefined
  const trimmed = tag.trim()
  if (!trimmed) return undefined
  const primary = trimmed.split(/[-_]/)[0]?.toLowerCase()
  if (!primary || primary.length < 2) return undefined
  return primary.slice(0, 2)
}

export async function transcribeWithOpenAI(blob: Blob, opts?: { model?: string; language?: string }): Promise<string> {
  const apiKey = getTranscriptionKey()
  if (!apiKey) throw new Error('Missing OpenAI API key in Settings')
  if (!blob || blob.size === 0) throw new Error('Audio clip is empty. Record a new memo and try again.')

  const form = new FormData()
  // Whisper expects a File with a filename
  const file = new File([blob], `audio.${mimeToExt(blob.type)}`, { type: blob.type || 'audio/webm' })
  form.append('file', file)
  form.append('model', opts?.model || 'whisper-1')
  const language = normalizeLanguageTag(opts?.language)
  if (language) form.append('language', language)

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.error?.message || err?.message || ''
    } catch {
      try { detail = await res.text() } catch { detail = '' }
    }
    const suffix = detail ? ` - ${detail}` : ''
    throw new Error(`Transcription failed: HTTP ${res.status}${suffix}`)
  }
  const data = await res.json()
  // Whisper returns { text: "..." }
  if (!data?.text) throw new Error('No text in transcription response')
  return data.text as string
}

function mimeToExt(mime?: string) {
  if (!mime) return 'webm'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp3')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('m4a') || mime.includes('mp4')) return 'm4a'
  return 'webm'
}

// Web Speech API helper for voice typing (live dictation)
export function isSpeechRecognitionSupported() {
  return typeof window !== 'undefined' && (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window))
}

export function createSpeechRecognizer(opts: { lang?: string; interim?: boolean; onResult: (text: string, isFinal: boolean) => void; onEnd?: () => void; onError?: (err: any) => void }) {
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) throw new Error('Speech recognition not supported on this browser')
  const rec = new SR()
  rec.lang = opts.lang || navigator.language || 'en-US'
  rec.continuous = true
  rec.interimResults = opts.interim ?? true
  rec.onresult = (e: any) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      const text = res[0]?.transcript || ''
      const isFinal = res.isFinal
      if (text) opts.onResult(text, isFinal)
    }
  }
  rec.onerror = (e: any) => opts.onError?.(e)
  rec.onend = () => opts.onEnd?.()
  return rec
}
