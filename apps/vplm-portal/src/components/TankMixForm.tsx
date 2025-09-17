import { useState } from 'react'
import { calcTankMix } from '../features/calculators/mix'

export default function TankMixForm() {
  const [tankVolumeGal, setTankVolumeGal] = useState('100')
  const [targetConcentrationPct, setTargetConcentrationPct] = useState('1')
  const [productStrengthPct, setProductStrengthPct] = useState('37.5')

  const v = Number(tankVolumeGal) || 0
  const t = Number(targetConcentrationPct) || 0
  const s = Number(productStrengthPct) || 0.0001

  const res = calcTankMix({ tankVolumeGal: v, targetConcentrationPct: t, productStrengthPct: s })

  return (
    <div className="grid">
      <div className="row">
        <label className="label">Tank Volume (gal)
          <input className="input" value={tankVolumeGal} onChange={(e) => setTankVolumeGal(e.target.value)} />
        </label>
        <label className="label">Target Conc. (%)
          <input className="input" value={targetConcentrationPct} onChange={(e) => setTargetConcentrationPct(e.target.value)} />
        </label>
        <label className="label">Product Strength (%)
          <input className="input" value={productStrengthPct} onChange={(e) => setProductStrengthPct(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <div className="card">
          Product needed: <strong>{res.productNeededGal.toFixed(2)} gal</strong>
        </div>
        <div className="card">
          Carrier (water): <strong>{res.carrierNeededGal.toFixed(2)} gal</strong>
        </div>
      </div>
      <small className="muted">Note: Simplified volume-based calculation. Confirm label mixing instructions.</small>
    </div>
  )
}

