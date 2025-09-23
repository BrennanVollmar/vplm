import { useCallback, useEffect, useRef, useState } from 'react'
import { MicrophoneError, normalizeMicrophoneError, probeMicrophoneAccess } from '../lib/audio'
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../lib/transcribe'

type UseDictationOptions = {
  language?: string
  onResult: (text: string, isFinal: boolean) => void
}

export function useDictation(options: UseDictationOptions) {
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognizerRef = useRef<any>(null)
  const resultHandlerRef = useRef(options.onResult)
  const languageRef = useRef(options.language)

  useEffect(() => {
    resultHandlerRef.current = options.onResult
  }, [options.onResult])

  useEffect(() => {
    languageRef.current = options.language
  }, [options.language])

  useEffect(() => () => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop()
      } catch {
        // ignore
      }
      recognizerRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    if (isActive) return
    if (!isSpeechRecognitionSupported()) {
      const err = new MicrophoneError('Speech recognition not supported in this browser.', 'not-supported')
      setError(err.message)
      throw err
    }
    setError(null)
    try {
      await probeMicrophoneAccess()
    } catch (err: any) {
      const micErr = err instanceof MicrophoneError ? err : normalizeMicrophoneError(err)
      setError(micErr.message)
      throw micErr
    }

    const recognizer = createSpeechRecognizer({
      lang: languageRef.current,
      interim: true,
      onResult: (text, isFinal) => {
        resultHandlerRef.current?.(text, isFinal)
      },
      onEnd: () => {
        setIsActive(false)
        recognizerRef.current = null
      },
      onError: (err: any) => {
        const message = typeof err?.message === 'string' ? err.message : typeof err?.error === 'string' ? err.error : 'Dictation error.'
        setError(message)
        setIsActive(false)
        recognizerRef.current = null
      },
    })

    recognizerRef.current = recognizer
    recognizer.start()
    setIsActive(true)
  }, [isActive])

  const stop = useCallback(() => {
    if (!recognizerRef.current) return
    try {
      recognizerRef.current.stop()
    } catch {
      // ignore
    }
    recognizerRef.current = null
    setIsActive(false)
  }, [])

  const resetError = useCallback(() => setError(null), [])

  return {
    isActive,
    error,
    start,
    stop,
    resetError,
    isSupported: isSpeechRecognitionSupported(),
  }
}
