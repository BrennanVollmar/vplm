import { useState } from 'react'
import { saveMeasurement, logJob, getActor } from '../features/offline/db'

type Unit = 'ft' | 'in' | 'yd' | 'm' | 'cm'
type Kind = 'length' | 'width' | 'depth' | 'perimeter' | 'depthSample' | 'custom'

export default function MeasureForm({ jobId }: { jobId: string }) {
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<Unit>('ft')
  const [kind, setKind] = useState<Kind>('depth')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = Number(value)
    if (!Number.isFinite(num)) return
    const now = new Date().toISOString()
    await saveMeasurement({ id: crypto.randomUUID(), jobId, unit, kind, value: num, createdAt: now })
    await logJob(jobId, 'measurement_add', `Added ${kind}: ${num} ${unit}`, getActor())
    setValue('')
  }

  return (
    <form onSubmit={onSubmit} className="row">
      <select className="select" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
        <option value="length">Length</option>
        <option value="width">Width</option>
        <option value="depth">Depth</option>
        <option value="perimeter">Perimeter</option>
        <option value="depthSample">Depth Sample</option>
        <option value="custom">Custom</option>
      </select>
      <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" style={{ width: 160 }} />
      <select className="select" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
        <option value="ft">ft</option>
        <option value="in">in</option>
        <option value="yd">yd</option>
        <option value="m">m</option>
        <option value="cm">cm</option>
      </select>
      <button className="btn" type="submit">Add</button>
    </form>
  )
}
