import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_MIME_TYPES,
  MicrophoneError,
  MicrophoneIssue,
  RecordingResult,
  getAudioStream,
  getMediaRecorderSupport,
  normalizeMicrophoneError,
  pickSupportedMimeType,
} from '../lib/audio'

type PermissionStatusState = PermissionState | 'unknown'

type UseAudioRecorderOptions = {
  deviceId?: string | null
  preferredMimeTypes?: readonly string[]
  minDurationMs?: number
}

const DEFAULT_MIN_DURATION = 600

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issue, setIssue] = useState<MicrophoneIssue | null>(null)
  const [permission, setPermission] = useState<PermissionStatusState>('unknown')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const stopPromiseRef = useRef<{ resolve: (value: RecordingResult) => void; reject: (reason: Error) => void; promise: Promise<RecordingResult> } | null>(null)
  const finalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (finalizeTimeoutRef.current != null) {
      clearTimeout(finalizeTimeoutRef.current)
      finalizeTimeoutRef.current = null
    }
    if (recorderRef.current) {
      try {
        recorderRef.current.ondataavailable = null as any
        recorderRef.current.onerror = null as any
        recorderRef.current.onstop = null as any
      } catch {
        // ignore
      }
    }
    recorderRef.current = null
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop())
      } catch {
        // ignore
      }
    }
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false
    try {
      const permName: PermissionName = 'microphone' as PermissionName
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        navigator.permissions
          .query({ name: permName })
          .then((status) => {
            if (cancelled) return
            setPermission(status.state)
            status.onchange = () => {
              if (!cancelled) setPermission(status.state)
            }
          })
          .catch(() => setPermission('unknown'))
      }
    } catch {
      setPermission('unknown')
    }
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => () => {
    if (recorderRef.current) {
      cleanup()
    }
  }, [cleanup])

  const startRecording = useCallback(async () => {
    if (isRecording) return
    if (!getMediaRecorderSupport()) {
      const err = new MicrophoneError('This browser does not support audio recording.', 'not-supported')
      setError(err.message)
      setIssue(err.issue)
      throw err
    }
    setError(null)
    setIssue(null)
    const mime = pickSupportedMimeType(options.preferredMimeTypes || DEFAULT_MIME_TYPES)
    let stream: MediaStream
    try {
      stream = await getAudioStream({ deviceId: options.deviceId })
      setPermission('granted')
    } catch (err: any) {
      const micErr = err instanceof MicrophoneError ? err : normalizeMicrophoneError(err)
      setError(micErr.message)
      setIssue(micErr.issue)
      if (micErr.issue === 'denied') setPermission('denied')
      throw micErr
    }
    streamRef.current = stream
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    recorderRef.current = recorder
    chunksRef.current = []
    startTimeRef.current = Date.now()

    const finalizeRecording = () => {
      const pending = stopPromiseRef.current
      if (!pending) return
      if (finalizeTimeoutRef.current != null) {
        clearTimeout(finalizeTimeoutRef.current)
        finalizeTimeoutRef.current = null
      }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' })
      chunksRef.current = []
      const durationMs = Date.now() - startTimeRef.current
      cleanup()
      setIsRecording(false)

      stopPromiseRef.current = null

      if (!blob.size || durationMs < (options.minDurationMs ?? DEFAULT_MIN_DURATION)) {
        const err = new Error('No audio captured. Try again.')
        setError(err.message)
        pending.reject(err)
        return
      }

      pending.resolve({ blob, mimeType: blob.type || 'audio/webm', durationMs })
    }

    const scheduleFinalize = () => {
      if (!stopPromiseRef.current) return
      if (finalizeTimeoutRef.current != null) return
      finalizeTimeoutRef.current = setTimeout(() => {
        finalizeTimeoutRef.current = null
        finalizeRecording()
      }, 30)
    }

    recorder.ondataavailable = (event: BlobEvent) => {
      if (!event?.data) return
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
      if (recorder.state === 'inactive') {
        scheduleFinalize()
      }
    }

    recorder.onerror = (event: any) => {
      const rawError = event.error || new Error('Recording error')
      const micErr = rawError instanceof MicrophoneError ? rawError : normalizeMicrophoneError(rawError)
      setError(micErr.message)
      setIssue(micErr.issue)
      if (micErr.issue === 'denied') setPermission('denied')
      stopPromiseRef.current?.reject(micErr)
      stopPromiseRef.current = null
      cleanup()
      setIsRecording(false)
    }

    recorder.onstop = () => {
      scheduleFinalize()
    }

    try {
      recorder.start()
    } catch {
      recorder.start()
    }
    setIsRecording(true)
  }, [cleanup, isRecording, options.deviceId, options.minDurationMs, options.preferredMimeTypes])

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) {
      return Promise.reject(new Error('No active recording to stop.'))
    }
    if (stopPromiseRef.current?.promise) {
      return stopPromiseRef.current.promise
    }
    let resolveFn: (value: RecordingResult) => void
    let rejectFn: (reason: Error) => void
    const promise = new Promise<RecordingResult>((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })
    stopPromiseRef.current = { resolve: resolveFn!, reject: rejectFn!, promise }
    try {
      try {
        ;(recorderRef.current as any)?.requestData?.()
      } catch {
        // ignore
      }
      recorderRef.current.stop()
    } catch (error: any) {
      const micErr = error instanceof MicrophoneError ? error : normalizeMicrophoneError(error)
      setError(micErr.message)
      setIssue(micErr.issue)
      if (micErr.issue === 'denied') setPermission('denied')
      stopPromiseRef.current = null
      cleanup()
      setIsRecording(false)
      return Promise.reject(micErr)
    }
    return promise
  }, [cleanup])

  const resetError = useCallback(() => {
    setError(null)
    setIssue(null)
  }, [])

  return {
    isRecording,
    error,
    issue,
    permission,
    startRecording,
    stopRecording,
    resetError,
    isSupported: getMediaRecorderSupport(),
  }
}



