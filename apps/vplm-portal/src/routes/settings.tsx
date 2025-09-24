import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

export default function SettingsPage() {
  const [employee, setEmployee] = useState('')
  const [dark, setDark] = useState(false)
  const [fieldMode, setFieldMode] = useState(false)
  const { deviceTrusted, trustedUntil, revokeDeviceTrust } = useAuth()
  useEffect(() => {
    setEmployee(localStorage.getItem('defaultEmployee') || '')
    setDark(document.documentElement.classList.contains('theme-dark'))
    setFieldMode(document.documentElement.classList.contains('field-mode'))
  }, [])

  function save() {
    localStorage.setItem('defaultEmployee', employee)
    alert('Saved')
  }
  function toggleDark(v: boolean) {
    setDark(v)
    document.documentElement.classList.toggle('theme-dark', v)
    try { localStorage.setItem('theme', v ? 'dark' : 'light') } catch {}
  }
  function toggleFieldMode(v: boolean) {
    setFieldMode(v)
    document.documentElement.classList.toggle('field-mode', v)
    try { localStorage.setItem('fieldMode', v ? '1' : '0') } catch {}
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
        <div className="row" style={{ gap: 16, alignItems: 'center', marginTop: 8 }}>
          <div className="label">Dark Mode
            <button type="button" className="btn" onClick={() => toggleDark(!dark)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="badge" style={{ background: dark ? '#111827' : '#e5e7eb', color: dark ? '#fff' : '#111827' }}>{dark ? 'On' : 'Off'}</span>
              <span>Toggle</span>
            </button>
          </div>
          <div className="label">Field Mode
            <button type="button" className="btn" onClick={() => toggleFieldMode(!fieldMode)}>
              {fieldMode ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={save}>Save</button></div>
      </section>
      <section className="card">
        <h2>Device Trust</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Trusted devices can refresh or reopen the site without signing in again for 24 hours.
        </p>
        {deviceTrusted ? (
          <p style={{ marginBottom: 12 }}>
            This device is trusted until <strong>{trustedUntil ? new Date(trustedUntil).toLocaleString() : 'the end of the window'}</strong>.
          </p>
        ) : (
          <p style={{ marginBottom: 12 }}>
            This device is currently <strong>not</strong> trusted. You’ll be asked to sign in again after a refresh.
          </p>
        )}
        <div className="row">
          <button
            className="btn secondary"
            type="button"
            onClick={revokeDeviceTrust}
            disabled={!deviceTrusted}
            title={deviceTrusted ? 'Stop trusting this device' : 'This device is not currently trusted'}
          >
            Stop trusting this device
          </button>
        </div>
      </section>
    </div>
  )
}
