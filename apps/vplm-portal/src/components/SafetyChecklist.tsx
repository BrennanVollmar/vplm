import { useEffect, useState } from 'react'
import { saveChecklist, logJob, getActor } from '../features/offline/db'

const DEFAULT_ITEMS = [
  'PPE: Gloves',
  'PPE: Eye protection',
  'PPE: Boots',
  'Spill kit on vehicle',
  'Weather checked (wind/lightning)',
  'Label reviewed and dosing confirmed',
  'Bystander/animal safety considered',
]

export default function SafetyChecklist({ jobId }: { jobId: string }) {
  const [items, setItems] = useState(DEFAULT_ITEMS.map((label) => ({ label, checked: false })))
  const [notes, setNotes] = useState('')

  useEffect(() => {
    // could load previous checklist state if desired
  }, [jobId])

  async function save() {
    const now = new Date().toISOString()
    await saveChecklist({ id: crypto.randomUUID(), jobId, kind: 'safety', items, notes: notes || undefined, createdAt: now })
    await logJob(jobId, 'checklist_save', 'Saved safety checklist', getActor())
  }

  return (
    <div className="grid">
      <ul className="list">
        {items.map((it, i) => (
          <li key={i}>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={it.checked} onChange={(e) => setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, checked: e.target.checked } : x))} />
              {it.label}
            </label>
          </li>
        ))}
      </ul>
      <label className="label">Notes
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" onClick={save}>Save Checklist</button>
      </div>
    </div>
  )
}
