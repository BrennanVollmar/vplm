import { useEffect, useState } from 'react'
import type { ChemProduct } from '../types'
import { db, saveChemProduct } from '../features/offline/db'
import AddChemicalForm from './AddChemicalForm'

export default function ChemLookup({ onSelect }: { onSelect: (p: ChemProduct) => void }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<ChemProduct[]>([])
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const load = async () => {
      const existing = await db.chemProducts.toArray()
      if (existing.length > 0) {
        setItems(existing)
      } else {
        try {
          const res = await fetch('/data/chemicals.json')
          const data = await res.json()
          setItems(data as ChemProduct[])
          // seed into DB for offline editing
          for (const p of data as ChemProduct[]) await saveChemProduct(p)
        } catch {
          setItems([])
        }
      }
    }
    load()
  }, [])

  const list = items.filter((p) =>
    [p.id, p.brand, p.active].some((f) => f.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div>
      <div className="row">
        <input className="input" placeholder="Search chemicals" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn secondary" onClick={() => setShowAdd((s) => !s)}>{showAdd ? 'Close' : 'Add Chemical'}</button>
      </div>
      {showAdd && (
        <div className="card" style={{ marginTop: 8 }}>
          <AddChemicalForm onAdded={(p) => { setShowAdd(false); setItems((arr) => [p, ...arr]) }} />
        </div>
      )}
      <ul>
        {list.map((p) => (
          <li key={p.id}>
            <button className="btn ghost" onClick={() => onSelect(p)} style={{ textAlign: 'left' }}>
              <strong>{p.brand}</strong> - {p.active} [{p.form}]
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
