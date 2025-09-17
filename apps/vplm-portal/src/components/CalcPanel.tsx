import { useMemo, useState } from 'react'
import { acresFromRect, acresFromCircleRadius, acresFromCircumference, avgDepthFt, acreFeet, acreFeetToGallons } from '../features/calculators/geom'

export default function CalcPanel() {
  const [lengthFt, setLengthFt] = useState('150')
  const [widthFt, setWidthFt] = useState('100')
  const [radiusFt, setRadiusFt] = useState('')
  const [circumferenceFt, setCircumferenceFt] = useState('')
  const [depthSamples, setDepthSamples] = useState('3,4,5,4')
  const [pumpGpm, setPumpGpm] = useState('60')
  const [convIn, setConvIn] = useState('1')
  const [convInGal, setConvInGal] = useState('10')
  const [convInAc, setConvInAc] = useState('1')
  const [mixTank, setMixTank] = useState('100')
  const [mixPct, setMixPct] = useState('1.0')

  const surfaceAcres = useMemo(() => {
    if (radiusFt) return acresFromCircleRadius(Number(radiusFt))
    if (circumferenceFt) return acresFromCircumference(Number(circumferenceFt))
    return acresFromRect(Number(lengthFt), Number(widthFt))
  }, [lengthFt, widthFt, radiusFt, circumferenceFt])

  const avgDepth = useMemo(() => {
    const samples = depthSamples.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
    return avgDepthFt(samples)
  }, [depthSamples])

  const volAf = useMemo(() => acreFeet(surfaceAcres || 0, avgDepth || 0), [surfaceAcres, avgDepth])
  const gallons = useMemo(() => acreFeetToGallons(volAf || 0), [volAf])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section>
        <h3>Geometry</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <label>Length ft <input value={lengthFt} onChange={(e) => setLengthFt(e.target.value)} style={{ width: 100 }} /></label>
          <label>Width ft <input value={widthFt} onChange={(e) => setWidthFt(e.target.value)} style={{ width: 100 }} /></label>
          <span>or</span>
          <label>Radius ft <input value={radiusFt} onChange={(e) => setRadiusFt(e.target.value)} style={{ width: 100 }} /></label>
          <span>or</span>
          <label>Shoreline ft <input value={circumferenceFt} onChange={(e) => setCircumferenceFt(e.target.value)} style={{ width: 120 }} /></label>
        </div>
        <div style={{ marginTop: 8 }}>Surface acres: <strong>{surfaceAcres.toFixed(3)}</strong></div>
      </section>

      <section>
        <h3>Depth & Volume</h3>
        <label>Depth samples (ft, comma-separated)
          <input value={depthSamples} onChange={(e) => setDepthSamples(e.target.value)} style={{ width: 240, marginLeft: 8 }} />
        </label>
        <div>Average depth: <strong>{avgDepth.toFixed(2)} ft</strong></div>
        <div>Volume: <strong>{volAf.toFixed(3)} ac-ft</strong> (~{Math.round(gallons).toLocaleString()} gal)</div>
      </section>

      <section>
        <h3>Pump Time</h3>
        <div className="row">
          <label className="label">Flow rate (gpm)
            <input className="input" value={pumpGpm} onChange={(e) => setPumpGpm(e.target.value)} style={{ width: 120 }} />
          </label>
        </div>
        {Number(pumpGpm) > 0 && (
          <div style={{ marginTop: 8 }}>
            At <strong>{Number(pumpGpm)} gpm</strong>, time to move ~{Math.round(gallons).toLocaleString()} gal is
            <strong> {(gallons / 60 / Number(pumpGpm)).toFixed(2)} hours</strong> (~{Math.round(gallons / Number(pumpGpm)).toLocaleString()} minutes)
          </div>
        )}
      </section>

      <section>
        <h3>Unit Conversions</h3>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="label">Feet → Meters
            <input className="input" value={convIn} onChange={(e) => setConvIn(e.target.value)} style={{ width: 120 }} />
          </label>
          <div style={{ alignSelf: 'end' }}>= <strong>{safeNum(convIn) ? (Number(convIn) * 0.3048).toFixed(3) : ''} m</strong></div>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
          <label className="label">Gallons → Liters
            <input className="input" value={convInGal} onChange={(e) => setConvInGal(e.target.value)} style={{ width: 120 }} />
          </label>
          <div style={{ alignSelf: 'end' }}>= <strong>{safeNum(convInGal) ? (Number(convInGal) * 3.78541).toFixed(1) : ''} L</strong></div>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
          <label className="label">Acres → Square feet
            <input className="input" value={convInAc} onChange={(e) => setConvInAc(e.target.value)} style={{ width: 120 }} />
          </label>
          <div style={{ alignSelf: 'end' }}>= <strong>{safeNum(convInAc) ? Math.round(Number(convInAc) * 43560).toLocaleString() : ''} ft²</strong></div>
        </div>
      </section>

      <section>
        <h3>Percent Mix</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label className="label">Tank volume (gal)
            <input className="input" value={mixTank} onChange={(e) => setMixTank(e.target.value)} style={{ width: 140 }} />
          </label>
          <label className="label">Target %
            <input className="input" value={mixPct} onChange={(e) => setMixPct(e.target.value)} style={{ width: 100 }} />
          </label>
        </div>
        {safeNum(mixTank) && safeNum(mixPct) && (
          <div style={{ marginTop: 8 }}>
            Product needed: <strong>{((Number(mixTank) * (Number(mixPct)/100))).toFixed(2)} gal</strong>
            {' '}(~{(Number(mixTank) * (Number(mixPct)/100) * 128).toFixed(0)} fl oz)
          </div>
        )}
      </section>
    </div>
  )
}

function safeNum(s: string) {
  const n = Number(s)
  return Number.isFinite(n)
}
