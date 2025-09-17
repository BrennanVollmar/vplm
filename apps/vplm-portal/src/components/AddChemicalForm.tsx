import { useState } from 'react'
import { saveChemLabel, saveChemProduct } from '../features/offline/db'
import type { ChemProduct, DoseRule } from '../types'

export default function AddChemicalForm({ onAdded }: { onAdded: (p: ChemProduct) => void }) {
  const [brand, setBrand] = useState('')
  const [active, setActive] = useState('')
  const [form, setForm] = useState<'liquid' | 'granular' | 'crystal' | 'other'>('liquid')
  const [strength, setStrength] = useState('')
  const [labelNotes, setLabelNotes] = useState('')
  const [ruleBasis, setRuleBasis] = useState<DoseRule['basis']>('acre-foot')
  const [ruleTarget, setRuleTarget] = useState<DoseRule['target']>('algae')
  const [minRate, setMinRate] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [unit, setUnit] = useState('lbs/ac-ft')
  const [labelFile, setLabelFile] = useState<File | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = brand.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Math.random().toString(36).slice(2, 6)
    const product: ChemProduct = {
      id, brand, active, form, strength: strength || undefined, labelNotes: labelNotes || undefined,
      doseRules: [{ target: ruleTarget, basis: ruleBasis, minRate: Number(minRate) || 0, maxRate: Number(maxRate) || 0, unit }]
    }
    await saveChemProduct(product)
    if (labelFile) {
      const blob = labelFile
      await saveChemLabel({
        id: crypto.randomUUID(), productId: id, filename: labelFile.name, mimeType: labelFile.type || 'application/pdf', size: labelFile.size,
        blob, createdAt: new Date().toISOString()
      })
    }
    setBrand(''); setActive(''); setStrength(''); setLabelNotes(''); setMinRate(''); setMaxRate(''); setLabelFile(null)
    onAdded(product)
  }

  return (
    <form onSubmit={onSubmit} className="grid">
      <label className="label">Brand<input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} required /></label>
      <label className="label">Active<input className="input" value={active} onChange={(e) => setActive(e.target.value)} required /></label>
      <label className="label">Form<select className="select" value={form} onChange={(e) => setForm(e.target.value as any)}>
        <option value="liquid">liquid</option>
        <option value="granular">granular</option>
        <option value="crystal">crystal</option>
        <option value="other">other</option>
      </select></label>
      <label className="label">Strength<input className="input" value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="e.g., % a.i." /></label>
      <label className="label">Label Notes<textarea className="textarea" value={labelNotes} onChange={(e) => setLabelNotes(e.target.value)} /></label>
      <fieldset style={{ display: 'grid', gap: 6 }}>
        <legend>Dose Rule</legend>
        <label className="label">Target<select className="select" value={ruleTarget} onChange={(e) => setRuleTarget(e.target.value as any)}>
          <option value="algae">algae</option>
          <option value="weeds">weeds</option>
          <option value="bacteria">bacteria</option>
          <option value="other">other</option>
        </select></label>
        <label className="label">Basis<select className="select" value={ruleBasis} onChange={(e) => setRuleBasis(e.target.value as any)}>
          <option value="surface-acre">surface-acre</option>
          <option value="acre-foot">acre-foot</option>
          <option value="ppm">ppm</option>
          <option value="gal-per-1000gal">gal-per-1000gal</option>
        </select></label>
        <label className="label">Min Rate<input className="input" value={minRate} onChange={(e) => setMinRate(e.target.value)} placeholder="e.g., 2.72" /></label>
        <label className="label">Max Rate<input className="input" value={maxRate} onChange={(e) => setMaxRate(e.target.value)} placeholder="e.g., 5.44" /></label>
        <label className="label">Unit<input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g., lbs/ac-ft" /></label>
      </fieldset>
      <label className="label">Label PDF (optional)<input className="input" type="file" accept="application/pdf" onChange={(e) => setLabelFile(e.target.files?.[0] || null)} /></label>
      <button className="btn" type="submit">Add Chemical</button>
    </form>
  )
}
