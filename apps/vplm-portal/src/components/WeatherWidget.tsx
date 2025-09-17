import { useEffect, useState } from 'react'

interface WeatherData { tempC: number; windMps: number; desc: string }

export default function WeatherWidget({ lat, lon }: { lat?: number; lon?: number }) {
  const [w, setW] = useState<WeatherData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [key, setKey] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const envKey = import.meta.env.VITE_OPENWEATHER_KEY as string | undefined
    const stored = typeof localStorage !== 'undefined' ? (localStorage.getItem('openweather_key') || undefined) : undefined
    setKey(envKey || stored)
  }, [])

  async function fetchWeather() {
    if (!key || lat == null || lon == null) return
    setLoading(true)
    setErr(null)
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=imperial`
      const res = await fetch(url)
      if (!res.ok) throw new Error('weather fetch failed')
      const j = await res.json()
      setW({ tempC: j.main.temp, windMps: j.wind.speed, desc: j.weather?.[0]?.description || '' })
    } catch (e: any) {
      setErr('Weather unavailable')
    } finally {
      setLoading(false)
    }
  }

  // Hide entirely unless the job has coordinates
  if (lat == null || lon == null) return null
  if (!key) return <small className="muted">Set OpenWeather key in Settings</small>
  if (err) return <small className="muted">{err}</small>
  if (!w) return (
    <span className="badge" style={{ background: '#eff6ff', color: '#1e3a8a' }}>
      <button className="btn secondary" disabled={loading || lat == null || lon == null} onClick={fetchWeather}>
        {loading ? 'Fetching…€¦' : 'Get Weather'}
      </button>
    </span>
  )
  return (
    <span className="badge" style={{ background: '#eff6ff', color: '#1e3a8a' }}>
      {w.desc} | {w.tempC.toFixed(0)} deg C | wind {w.windMps.toFixed(1)} m/s
    </span>
  )
}

