import { useState } from 'react'
import { saveWaterQuality, logJob, getActor } from '../features/offline/db'

type Kind = 'secchi' | 'ph' | 'do' | 'temp' | 'alkalinity' | 'hardness'

export default function WaterQualityForm({ jobId }: { jobId: string }) {
  const [kind, setKind] = useState<Kind>('secchi')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [depthFt, setDepthFt] = useState('')

  function pickUnit(k: Kind) {
    if (k === 'secchi') return 'ft'
    if (k === 'ph') return 'pH'
    if (k === 'do') return 'mg/L'
    if (k === 'temp') return '°C'
    if (k === 'alkalinity') return 'mg/L as CaCO3'
    if (k === 'hardness') return 'mg/L as CaCO3'
    return ''
  }

  return (
    <form className="row" onSubmit={async (e) => {
      e.preventDefault()
      const v = Number(value)
      if (!Number.isFinite(v)) return
      const now = new Date().toISOString()
      await saveWaterQuality({ id: crypto.randomUUID(), jobId, kind, value: v, unit: unit || pickUnit(kind), depthFt: depthFt ? Number(depthFt) : undefined, createdAt: now })
      await logJob(jobId, 'water_quality_add', `Added ${kind}: ${v} ${unit || pickUnit(kind)}`, getActor())
      setValue(''); setDepthFt('')
    }}>
      <select className="select" value={kind} onChange={(e) => { const k = e.target.value as Kind; setKind(k); setUnit(pickUnit(k)) }}>
        <option value="secchi">Secchi Depth</option>
        <option value="ph">pH</option>
        <option value="do">Dissolved Oxygen</option>
        <option value="temp">Temperature</option>
        <option value="alkalinity">Alkalinity</option>
        <option value="hardness">Hardness</option>
      </select>
      <input className="input" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
      <input className="input" placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 180 }} />
      <input className="input" placeholder="Depth (ft, optional)" value={depthFt} onChange={(e) => setDepthFt(e.target.value)} />
      <button className="btn" type="submit">Add</button>
    </form>
  )
}
