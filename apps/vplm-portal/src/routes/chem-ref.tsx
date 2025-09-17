import { useEffect, useState } from 'react'
import { listChemRefs, saveChemRef, type ChemRef } from '../features/offline/db'

export default function ChemRefPage() {
  const [items, setItems] = useState<ChemRef[]>([])
  const [tankGal, setTankGal] = useState('100')
  const [targetPct, setTargetPct] = useState('1.0')
  const [productPct, setProductPct] = useState('37.3')

  const productNeeded = calcProductNeeded(Number(tankGal), Number(targetPct), Number(productPct))

  return (
    <div className="grid">
      <section className="card">
        <h2>Chemical References</h2>
        <AddChemRef onAdd={async (c) => { await saveChemRef(c); setItems(await listChemRefs()) }} />
        <table className="table">
          <thead><tr><th>Name</th><th>EPA Reg#</th><th>Label</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}><td>{c.name}</td><td>{c.epaReg || '-'}</td><td>{c.labelUrl ? <a href={c.labelUrl} target="_blank">Label</a> : '-'}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h3>Percentage Calculator</h3>
        <div className="row">
          <label className="label">Tank Volume (gal)
            <input className="input" value={tankGal} onChange={(e) => setTankGal(e.target.value)} />
          </label>
          <label className="label">Target % in tank
            <input className="input" value={targetPct} onChange={(e) => setTargetPct(e.target.value)} />
          </label>
          <label className="label">Product % active
            <input className="input" value={productPct} onChange={(e) => setProductPct(e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: 8 }}>Product needed: <strong>{Number.isFinite(productNeeded) ? productNeeded.toFixed(2) : '-'} gal</strong></div>
      </section>
    </div>
  )
}

function calcProductNeeded(tankGal: number, targetPct: number, productPct: number) {
  if (!tankGal || !targetPct || !productPct) return NaN
  const targetFraction = targetPct / 100
  const productFraction = productPct / 100
  const activeNeededGal = tankGal * targetFraction
  return activeNeededGal / productFraction
}

function AddChemRef({ onAdd }: { onAdd: (c: ChemRef) => void | Promise<void> }) {
  const [name, setName] = useState('')
  const [epa, setEpa] = useState('')
  const [label, setLabel] = useState('')
  useEffect(() => { (async () => {
    const cur = await listChemRefs()
    if (cur.length === 0) {
      const seed: ChemRef[] = [
        { id: 'argos', name: 'Argos (Copper Algaecide)' },
        { id: 'tribune', name: 'Tribune' },
        { id: 'aquathol_k', name: 'Aquathol K' },
        { id: 'aquathol_super_k', name: 'Aquathol Super K' },
        { id: 'cutrine_gran', name: 'Cutrine Granular' },
        { id: 'roundup_custom', name: 'Roundup Custom' },
      ]
      for (const s of seed) await saveChemRef(s)
    }
    const items = await listChemRefs();
    setName(items[0]?.name ? '' : name)
  })() }, [])
  useEffect(() => { (async () => setName(name))() }, [])
  return (
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="EPA Reg#" value={epa} onChange={(e) => setEpa(e.target.value)} />
          <input className="input" placeholder="Label URL (or upload below)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <label className="btn secondary" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Upload Label Image
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => { setLabel(String(reader.result)) }
              reader.readAsDataURL(file)
            }} />
          </label>
          <button className="btn" onClick={async () => { if (!name.trim()) return; await onAdd({ id: name.toLowerCase().replace(/\s+/g,'_'), name, epaReg: epa || undefined, labelUrl: label || undefined }); setName(''); setEpa(''); setLabel('') }}>Add</button>
        </div>
  )
}
