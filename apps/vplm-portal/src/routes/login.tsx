import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try { await login(phone.trim(), password); nav('/') } catch (e: any) { setErr(e?.message || 'Login failed') } finally { setBusy(false) }
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
          {err && <div className="badge" style={{ background: 'var(--danger)', color: '#fff' }}>{err}</div>}
          <button className="btn" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign In'}</button>
        </form>
      </section>
    </div>
  )
}

