const DEFAULT_AUDIO_MIME_TYPES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/3gpp',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const

export type MicrophoneIssue = 'not-supported' | 'denied' | 'no-device' | 'hardware' | 'unknown'

export class MicrophoneError extends Error {
  issue: MicrophoneIssue

  constructor(message: string, issue: MicrophoneIssue) {
    super(message)
    this.name = 'MicrophoneError'
    this.issue = issue
  }
}

export function getMediaRecorderSupport() {
  return typeof window !== 'undefined' && typeof (window as any).MediaRecorder !== 'undefined'
}

export function pickSupportedMimeType(preferred: readonly string[] = DEFAULT_AUDIO_MIME_TYPES) {
  if (!getMediaRecorderSupport()) return undefined
  const tester: ((mimeType: string) => boolean) | undefined = (window as any).MediaRecorder?.isTypeSupported?.bind((window as any).MediaRecorder)
  if (!tester) return undefined
  for (const mime of preferred) {
    if (tester(mime)) return mime
  }
  return undefined
}

export function buildAudioConstraints(deviceId?: string | null): MediaStreamConstraints {
  if (deviceId) {
    return { audio: { deviceId: { exact: deviceId } } }
  }
  return { audio: true }
}

export function normalizeMicrophoneError(error: any): MicrophoneError {
  if (!(error instanceof Error)) {
    return new MicrophoneError('Microphone error', 'unknown')
  }
  const name = (error as any).name || (error as any).code
  const message = error.message || 'Microphone error'
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return new MicrophoneError('Microphone permission denied. Allow access in browser settings and try again.', 'denied')
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new MicrophoneError('No microphone is available. Connect one or choose a different input and try again.', 'no-device')
    case 'NotReadableError':
    case 'AbortError':
    case 'InvalidStateError':
    case 'HardwareUnavailableError':
      return new MicrophoneError('The microphone is in use by another application. Close other apps that use audio and retry.', 'hardware')
    default:
      return new MicrophoneError(message, 'unknown')
  }
}

export async function getAudioStream(options: { deviceId?: string | null } = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError('Microphone not supported in this browser.', 'not-supported')
  }
  try {
    return await navigator.mediaDevices.getUserMedia(buildAudioConstraints(options.deviceId))
  } catch (error: any) {
    throw normalizeMicrophoneError(error)
  }
}

export async function probeMicrophoneAccess(options: { deviceId?: string | null } = {}) {
  const stream = await getAudioStream(options)
  try {
    stream.getTracks().forEach((track) => track.stop())
  } catch {
    // ignore
  }
}

export type RecordingResult = {
  blob: Blob
  mimeType: string
  durationMs: number
}

export const DEFAULT_MIME_TYPES = DEFAULT_AUDIO_MIME_TYPES

export function ensureAudioBlob(source: { blob?: any; data?: ArrayBuffer | Uint8Array | null; mimeType?: string }) {
  if (source?.blob instanceof Blob && source.blob.size > 0) {
    return source.blob
  }
  const raw = source?.data
  if (!raw) return null
  let buffer: ArrayBuffer | null = null
  if (raw instanceof ArrayBuffer) {
    buffer = raw
  } else if (raw instanceof Uint8Array) {
    buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
  } else if (ArrayBuffer.isView(raw)) {
    const view = raw as ArrayBufferView
    buffer = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
  }
  if (!buffer) return null
  const type = source?.mimeType || 'audio/webm'
  return new Blob([buffer], { type })
}
