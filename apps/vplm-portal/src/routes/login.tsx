import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

type TrustChoice = 'yes' | 'no'

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from || '/'
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [trustChoice, setTrustChoice] = useState<TrustChoice>('yes')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      await login(phone.trim(), password, trustChoice === 'yes')
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
          <fieldset className="label" style={{ border: 'none', padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>Is this your device?</legend>
            <div className="grid" style={{ gap: 6 }}>
              <label className="row" style={{ alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="trust-device"
                  value="yes"
                  checked={trustChoice === 'yes'}
                  onChange={() => setTrustChoice('yes')}
                />
                <span>Yes, trust this device for 24 hours</span>
              </label>
              <label className="row" style={{ alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="trust-device"
                  value="no"
                  checked={trustChoice === 'no'}
                  onChange={() => setTrustChoice('no')}
                />
                <span>No, other people use this device</span>
              </label>
            </div>
          </fieldset>
          {err && <div className="badge" style={{ background: 'var(--danger)', color: '#fff' }}>{err}</div>}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign In'}</button>
        </form>
      </section>
    </div>
  )
}
