import { useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import { useAuth } from '../lib/auth'
import { deleteUserLocal, listUsersLocal, upsertUserLocal } from '../features/users/local'
import {
  deleteAddressBankEntry,
  saveAddressBankEntry,
  createBackupSnapshot,
  getBackupHistory,
  clearBackupHistory,
  type AddressBankEntry,
  type ClientBankContact,
  type BackupEntry,
} from '../features/offline/db'
import AddressAutocomplete from '../components/AddressAutocomplete'
import { getMapboxToken, setMapboxToken } from '../lib/places'
import type { AddressSuggestion } from '../lib/places'

type ClientContact = ClientBankContact

type ClientFormState = {
  id: string | null
  clientName: string
  address: string
  contactName: string
  primaryPhone: string
  notes: string
  lat: string
  lon: string
}

export default function AdminPage() {
  const { user } = useAuth()
  const [list, setList] = useState<any[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'developer'>('user')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [backupHistory, setBackupHistory] = useState<BackupEntry[]>([])

  if (!user || user.role !== 'developer') {
    return (
      <div className="card">
        <h2>Developer Only</h2>
        <p className="muted">Sign in as a developer to access this page.</p>
      </div>
    )
  }

  useEffect(() => {
    setList(listUsersLocal())
  }, [])

  useEffect(() => {
    setBackupHistory(getBackupHistory())
  }, [])

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !password.trim()) {
      setErr('Phone and password are required.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      upsertUserLocal({ phone, password, role, name })
      setName('')
      setPhone('')
      setEmail('')
      setPassword('')
      setRole('user')
      setList(listUsersLocal())
    } catch (e: any) {
      setErr(e?.message || 'Failed to save user')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this user?')) return
    try {
      deleteUserLocal(id)
    } finally {
      setList(listUsersLocal())
    }
  }

  async function handleManualBackup() {
    const entry = await createBackupSnapshot('manual')
    setBackupHistory([entry, ...getBackupHistory().filter((b) => b.id !== entry.id)])
  }

  function refreshBackups() {
    setBackupHistory(getBackupHistory())
  }

  function handleClearBackups() {
    if (!backupHistory.length) return
    if (!confirm('Clear all stored backups on this device?')) return
    clearBackupHistory()
    setBackupHistory([])
  }

  function downloadBackup(entry: BackupEntry) {
    if (typeof document === 'undefined') return
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `vplm-backup-${entry.createdAt.replace(/[:.]/g, '-')}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section className="card">
        <h2>Create or Update Users</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Seed local test accounts or sync with the API when it is running.
        </p>
        <form onSubmit={addUser} style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label className="label" style={{ flex: '1 1 200px' }}>
              Name
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Developer" />
            </label>
            <label className="label" style={{ flex: '1 1 200px' }}>
              Email
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </label>
            <label className="label" style={{ flex: '1 1 160px' }}>
              Phone
              <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5551234567" required />
            </label>
            <label className="label" style={{ flex: '1 1 160px' }}>
              Password
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="******" required />
            </label>
            <label className="label" style={{ width: 160 }}>
              Role
              <select className="select" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="user">User</option>
                <option value="developer">Developer</option>
              </select>
            </label>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" disabled={busy} type="submit">
              {busy ? 'Saving...' : 'Save User'}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setName('')
                setEmail('')
                setPhone('')
                setPassword('')
                setRole('user')
                setErr(null)
              }}
              disabled={busy}
            >
              Clear
            </button>
          </div>
          {err && <div className="badge" style={{ background: 'var(--danger)', color: '#fff', marginTop: 4 }}>{err}</div>}
        </form>
      </section>

      <section className="card">
        <h3>Existing Users</h3>
        {list.length === 0 ? (
          <div className="muted">No users found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                <th>Role</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const created = u.created_at ? new Date(u.created_at).toLocaleString() : 'Local only'
                return (
                  <tr key={u.id}>
                    <td>{u.name || ''}</td>
                    <td>{u.email || ''}</td>
                    <td>{u.phone}</td>
                    <td>{u.role}</td>
                    <td>{created}</td>
                    <td>
                      <button
                        className="btn secondary"
                        onClick={() => {
                          setName(u.name || '')
                          setEmail(u.email || '')
                          setPhone(u.phone || '')
                          setRole(u.role || 'user')
                          setPassword('')
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn warn"
                        style={{ marginLeft: 6 }}
                        onClick={() => {
                          if (confirm('Really delete this user? This will NOT delete any jobs or data.')) del(u.id)
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        )}
      </section>

      <ClientBankManager />
      <section className="card" style={{ display: 'grid', gap: 16 }}>
        <h3>Local Backups</h3>
        <p className="muted" style={{ marginTop: 4 }}>
          Automatic snapshots of the browser database are stored on this device. Download them regularly so the team has an
          off-device copy in case hardware is lost.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleManualBackup}>Backup Now</button>
          <button className="btn secondary" onClick={refreshBackups} disabled={!backupHistory.length}>Refresh List</button>
          <button className="btn warn" onClick={handleClearBackups} disabled={!backupHistory.length}>Clear History</button>
        </div>
        {backupHistory.length === 0 ? (
          <div className="muted">No backups captured yet. New edits will trigger automatic snapshots.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Reason</th>
                  <th>Approx Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {backupHistory.map((entry) => {
                  const sizeKb = Math.max(0.1, JSON.stringify(entry.data).length / 1024).toFixed(1)
                  return (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>{entry.reason}</td>
                      <td>{sizeKb} KB</td>
                      <td>
                        <button className="btn secondary" onClick={() => downloadBackup(entry)}>Download</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <DevSettings />
    </div>
  )
}


function DevSettings() {
  const [owKey, setOwKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [defaultEmployee, setDefaultEmployee] = useState('')
  const [mapboxToken, setMapboxTokenInput] = useState('')

  useEffect(() => {
    setOwKey(localStorage.getItem('openweather_key') || '')
    setOpenaiKey(localStorage.getItem('openai_api_key') || '')
    setDefaultEmployee(localStorage.getItem('defaultEmployee') || '')
    setMapboxTokenInput(getMapboxToken() || '')
  }, [])

  function save() {
    localStorage.setItem('openweather_key', owKey)
    localStorage.setItem('openai_api_key', openaiKey)
    localStorage.setItem('defaultEmployee', defaultEmployee)
    setMapboxToken(mapboxToken.trim())
    alert('Saved developer settings.')
  }

  return (
    <>
      <section className="card" style={{ display: 'grid', gap: 16 }}>
        <h3>Developer Settings</h3>
        <p className="muted" style={{ marginTop: 4 }}>Store local-only API keys for tooling and crew defaults.</p>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 12 }}>
          <label className="label">Default Employee Name
            <input
              className="input"
              value={defaultEmployee}
              onChange={(e) => setDefaultEmployee(e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label className="label">Mapbox Access Token (addresses)
            <input
              className="input"
              value={mapboxToken}
              onChange={(e) => setMapboxTokenInput(e.target.value)}
              placeholder="pk.xxxxx"
            />
            <small className="muted">Generates real address suggestions across the app.</small>
          </label>
          <label className="label">OpenWeather API Key
            <input
              className="input"
              value={owKey}
              onChange={(e) => setOwKey(e.target.value)}
              placeholder="Enter key"
            />
          </label>
          <label className="label">OpenAI API Key (Whisper)
            <input
              className="input"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
            />
          </label>
        </div>
        <div className="row" style={{ marginTop: 16, gap: 8 }}>
          <button className="btn" onClick={save}>Save</button>
          <button className="btn warn" onClick={() => location.assign('/reset')}>Clear Cache</button>
        </div>
      </section>

      <section className="card">
        <h3>API Setup Guide</h3>
        <ul style={{ margin: '8px 0 0 18px', padding: 0, listStyle: 'disc', display: 'grid', gap: 8 }}>
          <li><strong>Mapbox Places</strong> - Sign up at <a href="https://www.mapbox.com" target="_blank" rel="noreferrer">mapbox.com</a>, create a Public access token, and paste it above. Provides fast address autocomplete; Google Places or Geoapify are viable alternatives if your team already licenses them.</li>
          <li><strong>OpenWeather</strong> - Current weather and radar. Key stored locally; alternatives like Tomorrow.io offer richer forecasts but cost more.</li>
          <li><strong>OpenAI Whisper</strong> - Optional for voice-to-text. Generate a secret key in your OpenAI dashboard and store it here.</li>
          <li>Keys live in browser storage only; each developer keeps their own set.</li>
        </ul>
      </section>
    </>
  )
}


function ClientBankManager() {
  const emptyForm: ClientFormState = {
    id: null,
    clientName: '',
    address: '',
    contactName: '',
    primaryPhone: '',
    notes: '',
    lat: '',
    lon: '',
  }

  const [entries, setEntries] = useState<AddressBankEntry[]>([])
  const [form, setForm] = useState<ClientFormState>(emptyForm)
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [contactNameDraft, setContactNameDraft] = useState('')
  const [contactPhoneDraft, setContactPhoneDraft] = useState('')
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleAddressChange(value: string) {
    setForm((prev) => ({ ...prev, address: value }))
    setLookupStatus(null)
  }

  function handleAddressSelect(suggestion: AddressSuggestion) {
    setForm((prev) => ({
      ...prev,
      address: suggestion.label,
      lat: suggestion.lat != null ? suggestion.lat.toFixed(6) : prev.lat,
      lon: suggestion.lon != null ? suggestion.lon.toFixed(6) : prev.lon,
    }))
    setLookupStatus('Coordinates added from selection.')
  }


  useEffect(() => {
    const sub = liveQuery(() => db.addressBank.orderBy('clientName').toArray()).subscribe({
      next: (rows) => setEntries(rows),
      error: () => {},
    })
    return () => sub.unsubscribe()
  }, [])

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((entry) => {
      const contacts = normalizeEntryContacts(entry)
      const haystack = [
        entry.clientName,
        entry.address,
        entry.contactName,
        entry.primaryPhone,
        entry.notes,
        ...contacts.flatMap((c) => [c.phone, c.label]),
      ]
      return haystack.some((val) => (val || '').toLowerCase().includes(q))
    })
  }, [entries, search])

  function resetForm() {
    setForm(emptyForm)
    setContacts([])
    setContactNameDraft('')
    setContactPhoneDraft('')
    setEditingContactId(null)
    setError(null)
    setLookupStatus(null)
  }

  function hydrateForm(entry: AddressBankEntry) {
    setForm({
      id: entry.id,
      clientName: entry.clientName || '',
      address: entry.address || '',
      contactName: entry.contactName || '',
      primaryPhone: entry.primaryPhone || '',
      notes: entry.notes || '',
      lat: entry.lat != null ? String(entry.lat) : '',
      lon: entry.lon != null ? String(entry.lon) : '',
    })
    setContacts(normalizeEntryContacts(entry))
    setContactNameDraft('')
    setContactPhoneDraft('')
    setEditingContactId(null)
    setError(null)
    setLookupStatus(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clientName.trim() && !form.address.trim()) {
      setError('Enter at least a client name or address.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const id = form.id || crypto.randomUUID()
      const existing = entries.find((row) => row.id === id)
      const now = new Date().toISOString()
      const latVal = form.lat.trim() ? Number(form.lat) : undefined
      const lonVal = form.lon.trim() ? Number(form.lon) : undefined
      if ((latVal != null && !Number.isFinite(latVal)) || (lonVal != null && !Number.isFinite(lonVal))) {
        throw new Error('Lat/Lon must be numbers.')
      }

      const cleanedContacts = contacts.map((c) => ({
        id: c.id || crypto.randomUUID(),
        label: c.label?.trim() || undefined,
        phone: c.phone.trim(),
      })).filter((c) => c.phone)

      const payload: AddressBankEntry = {
        id,
        clientName: form.clientName.trim() || form.address.trim() || 'Untitled Client',
        address: form.address.trim(),
        contactName: form.contactName.trim() || undefined,
        primaryPhone: form.primaryPhone.trim() || undefined,
        otherPhones: cleanedContacts.map((c) => c.phone),
        contacts: cleanedContacts,
        notes: form.notes.trim() || undefined,
        lat: latVal,
        lon: lonVal,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      }

      await saveAddressBankEntry(payload)
      setLookupStatus(form.id ? 'Updated entry.' : 'Saved new entry.')
      resetForm()
    } catch (e: any) {
      setError(e?.message || 'Failed to save client entry')
    } finally {
      setSaving(false)
    }
  }

  async function handleLookup() {
    const query = [form.address, form.clientName].filter(Boolean).join(' ')
    if (!query.trim()) {
      setLookupStatus('Enter an address or client name first.')
      return
    }
    setLookupStatus('Looking up address...')
    setError(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error('Lookup failed')
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) {
        setLookupStatus('No results found for that address.')
        return
      }
      const hit = data[0]
      setForm((prev) => ({
        ...prev,
        lat: hit.lat ? String(Number(hit.lat).toFixed(6)) : prev.lat,
        lon: hit.lon ? String(Number(hit.lon).toFixed(6)) : prev.lon,
      }))
      setLookupStatus('Coordinates added from lookup.')
    } catch (e: any) {
      setLookupStatus('Lookup error. Try again later.')
      setError(e?.message || 'Lookup failed')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this client entry?')) return
    await deleteAddressBankEntry(id)
    if (form.id === id) resetForm()
  }

  function addOrUpdateContact() {
    const phone = contactPhoneDraft.trim()
    if (!phone) {
      setError('Enter a phone number for the contact.')
      return
    }
    setError(null)
    const label = contactNameDraft.trim() || undefined
    if (editingContactId) {
      setContacts((prev) => prev.map((c) => (c.id === editingContactId ? { ...c, phone, label } : c)))
    } else {
      setContacts((prev) => [...prev, { id: crypto.randomUUID(), phone, label }])
    }
    setContactNameDraft('')
    setContactPhoneDraft('')
    setEditingContactId(null)
  }

  function editContact(contact: ClientContact) {
    setContactNameDraft(contact.label || '')
    setContactPhoneDraft(contact.phone)
    setEditingContactId(contact.id)
  }

  function removeContact(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id))
    if (editingContactId === id) {
      setContactNameDraft('')
      setContactPhoneDraft('')
      setEditingContactId(null)
    }
  }

  return (
    <section className="card" style={{ display: 'grid', gap: 16 }}>
      <h3>Client Bank</h3>
      <p className="muted" style={{ marginTop: 4 }}>
        Keep an easy list of ranch clients, contacts, and coordinates. Field users can look them up from the Map tab.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <label className="label">
            Client / Ranch Name
            <input className="input" value={form.clientName} onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))} placeholder="Blue Creek Ranch" />
          </label>
          <div className="label" style={{ display: 'grid', gap: 6 }}>
            <span>Address</span>
            <AddressAutocomplete
              id="client-bank-address"
              value={form.address}
              onChange={handleAddressChange}
              onSelect={handleAddressSelect}
              placeholder="123 FM 100, Llano, TX"
              helpText="Select a suggestion to fill coordinates automatically."
            />
          </div>
          <label className="label">
            Primary Contact Name
            <input className="input" value={form.contactName} onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))} placeholder="Sam Owner" />
          </label>
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label className="label">
            Primary Phone
            <input className="input" value={form.primaryPhone} onChange={(e) => setForm((prev) => ({ ...prev, primaryPhone: e.target.value }))} placeholder="555-123-4567" />
          </label>
          <label className="label" style={{ display: 'grid', gap: 6 }}>
            <span>Notes</span>
            <textarea className="textarea" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Gate code 2468" rows={3} />
          </label>
        </div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'end' }}>
          <label className="label">
            Contact / Role
            <input className="input" value={contactNameDraft} onChange={(e) => setContactNameDraft(e.target.value)} placeholder="Ranch hand" />
          </label>
          <label className="label">
            Phone
            <input className="input" type="tel" value={contactPhoneDraft} onChange={(e) => setContactPhoneDraft(e.target.value)} placeholder="555-987-1234" />
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn secondary" onClick={addOrUpdateContact}>
              {editingContactId ? 'Update Contact' : 'Add Contact'}
            </button>
            {editingContactId && (
              <button type="button" className="btn secondary" onClick={() => { setContactNameDraft(''); setContactPhoneDraft(''); setEditingContactId(null) }}>Cancel</button>
            )}
          </div>
        </div>
        {contacts.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {contacts.map((contact) => (
              <li key={contact.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#f9fafb', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px' }}>
                <div>
                  <strong>{contact.label || 'Contact'}</strong>{contact.label ? ': ' : ' '}{contact.phone}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn secondary" onClick={() => editContact(contact)}>
                    Edit
                  </button>
                  <button type="button" className="btn warn" onClick={() => removeContact(contact.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}>
          <label className="label">
            Latitude
            <input className="input" value={form.lat} onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))} placeholder="30.123456" />
          </label>
          <label className="label">
            Longitude
            <input className="input" value={form.lon} onChange={(e) => setForm((prev) => ({ ...prev, lon: e.target.value }))} placeholder="-97.654321" />
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn secondary" onClick={handleLookup} disabled={saving}>
              Lookup Coordinates
            </button>
            <small className="muted">Uses OpenStreetMap to geocode the address.</small>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : form.id ? 'Update Client' : 'Save Client'}
          </button>
          <button className="btn secondary" type="button" onClick={resetForm} disabled={saving}>
            Reset
          </button>
        </div>
        {lookupStatus && <div className="muted">{lookupStatus}</div>}
        {error && <div className="badge" style={{ background: 'var(--danger)', color: '#fff' }}>{error}</div>}
      </form>

      <div style={{ marginTop: 20 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h4 style={{ margin: 0 }}>Saved Clients</h4>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Search name, address, phone" value={search} onChange={(e) => setSearch(e.target.value)} disabled={entries.length === 0} />
        </div>
        {entries.length === 0 ? (
          <div className="muted" style={{ marginTop: 8 }}>
            No clients yet. Add one above to build the shared bank.
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="muted" style={{ marginTop: 8 }}>No matches for "{search}".</div>
        ) : (
          <div className="accordion" style={{ marginTop: 12 }}>
            {filteredEntries.map((entry) => (
              <ClientAccordionItem key={entry.id} entry={entry} onEdit={() => hydrateForm(entry)} onDelete={() => handleDelete(entry.id)} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

type ClientAccordionItemProps = {
  entry: AddressBankEntry
  onEdit: () => void
  onDelete: () => void
}

function ClientAccordionItem({ entry, onEdit, onDelete }: ClientAccordionItemProps) {
  const [open, setOpen] = useState(false)
  const contacts = normalizeEntryContacts(entry)
  const hasCoords = typeof entry.lat === 'number' && typeof entry.lon === 'number'
  return (
    <section className="accordion-item accent-green">
      <button className="accordion-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{entry.clientName || entry.address || 'Client Entry'}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="accordion-panel" style={{ display: 'grid', gap: 8 }}>
          {entry.address && <div><strong>Address:</strong> {entry.address}</div>}
          {entry.contactName && <div><strong>Primary Contact:</strong> {entry.contactName}</div>}
          {entry.primaryPhone && (
            <div>
              <strong>Primary Phone:</strong> <a href={`tel:${entry.primaryPhone}`}>{entry.primaryPhone}</a>
            </div>
          )}
          {contacts.length > 0 && (
            <div>
              <strong>Team Contacts:</strong>
              <ul style={{ margin: '4px 0 0 18px', padding: 0, listStyle: 'disc' }}>
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    {contact.label ? `${contact.label}: ` : ''}{contact.phone}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasCoords && <div><strong>Coordinates:</strong> {entry.lat?.toFixed(5)}, {entry.lon?.toFixed(5)}</div>}
          {entry.notes && <div><strong>Notes:</strong> {entry.notes}</div>}
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={onEdit}>
              Load Into Form
            </button>
            <button className="btn warn" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function normalizeEntryContacts(entry: AddressBankEntry): ClientContact[] {
  const base = (entry.contacts || []).map((c) => ({
    id: c.id || `${entry.id}-${c.phone}`,
    label: c.label,
    phone: c.phone,
  }))
  if (base.length > 0) return base
  return (entry.otherPhones || [])
    .filter(Boolean)
    .map((phone, idx) => ({ id: `${entry.id}-extra-${idx}`, phone }))
}
