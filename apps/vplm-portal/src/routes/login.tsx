import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from || '/'
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [rememberDevice, setRememberDevice] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      await login(phone.trim(), password, rememberDevice)
      nav(redirectTo, { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Login failed')
    } finally { setBusy(false) }
  }
  return (
    <div className="grid" style={{ maxWidth: 420, margin: '0 auto' }}>
      <section className="card">
        <h2>Sign In</h2>
        <form className="grid" style={{ gap: 10 }} onSubmit={onSubmit}>
          <label className="label">Phone Number
            <input className="input" placeholder="e.g. 555-123-4567" value={phone} onChange={e => setPhone(e.target.value)} />
          </label>
          <label className="label">Password
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          <label className="label" style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
            <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
            <span>Trust this device for 24 hours</span>
          </label>
          {err && <div className="badge" style={{ background: 'var(--danger)', color: '#fff' }}>{err}</div>}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign In'}</button>
        </form>
      </section>
    </div>
  )
}
