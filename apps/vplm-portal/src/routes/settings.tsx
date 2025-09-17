import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'

export default function SettingsPage() {
  const [employee, setEmployee] = useState('')
  const [owKey, setOwKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  

  useEffect(() => {
    setEmployee(localStorage.getItem('defaultEmployee') || '')
    setOwKey(localStorage.getItem('openweather_key') || '')
    setOpenaiKey(localStorage.getItem('openai_api_key') || '')
  }, [])

  function save() {
    localStorage.setItem('defaultEmployee', employee)
    if (owKey) localStorage.setItem('openweather_key', owKey); else localStorage.removeItem('openweather_key')
    if (openaiKey) localStorage.setItem('openai_api_key', openaiKey); else localStorage.removeItem('openai_api_key')
    alert('Saved')
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Settings</h2>
        <div className="row">
          <label className="label">Default Employee Name
            <input className="input" value={employee} onChange={(e) => setEmployee(e.target.value)} placeholder="Your name" />
          </label>
        </div>
        <div className="row"><button className="btn" onClick={save}>Save</button></div>
      </section>
      <section className="card">
        <h3>Environment</h3>
        <ul className="list">
          <li>Supabase configured: {isSupabaseConfigured ? 'Yes' : 'No'}</li>
          <li>OpenWeather key: {(import.meta.env.VITE_OPENWEATHER_KEY || owKey) ? 'Present' : 'Missing'}</li>
          <li>OpenAI key: {openaiKey ? 'Present' : 'Missing'}</li>
        </ul>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn secondary" onClick={testSupabase}>Test Supabase</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="label">OpenWeather API Key
            <input className="input" value={owKey} onChange={(e) => setOwKey(e.target.value)} placeholder="Enter key (stored locally)" />
          </label>
          <button className="btn" onClick={save}>Save Environment</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="label">OpenAI API Key (Whisper)
            <input className="input" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-... (stored locally)" />
          </label>
          <button className="btn" onClick={save}>Save Transcription</button>
        </div>
      </section>
    </div>
  )
}

async function testSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  try {
    if (!url || !anon) throw new Error('Missing URL or anon key')
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon }, signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    alert('Supabase connection OK')
  } catch (e: any) {
    alert('Supabase test failed: ' + (e?.message || e))
  }
}
