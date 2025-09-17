import { useEffect, useState } from 'react'
import { getProfile, saveProfile } from '../features/offline/db'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [license, setLicense] = useState('')
  useEffect(() => { (async () => { const p = await getProfile('me'); if (p?.name) setName(p.name); if (p?.insuranceLicense) setLicense(p.insuranceLicense) })() }, [])
  async function save() { await saveProfile({ id: 'me', name, insuranceLicense: license }); alert('Profile saved') }
  return (
    <div className="grid">
      <section className="card">
        <h2>Profile</h2>
        <div className="row">
          <label className="label">Name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="label">Insurance License Number
            <input className="input" value={license} onChange={(e) => setLicense(e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={save}>Save</button>
        </div>
      </section>
    </div>
  )
}

