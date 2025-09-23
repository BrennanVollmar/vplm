import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [employee, setEmployee] = useState('')
  const [dark, setDark] = useState(false)
  const [fieldMode, setFieldMode] = useState(false)
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
    </div>
  )
}
