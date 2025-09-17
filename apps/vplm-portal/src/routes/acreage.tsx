import { useEffect, useRef, useState } from 'react'
import { listAcreageTraces, saveAcreageTrace, type AcreageTrace, getAcreageTrace, logJob, getActor } from '../features/offline/db'

type Pt = { x: number; y: number }

export default function AcreageTools() {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'none'|'scale'|'poly'>('none')
  const [scalePts, setScalePts] = useState<Pt[]>([])
  const [scaleFeet, setScaleFeet] = useState('100')
  const [poly, setPoly] = useState<Pt[]>([])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [saved, setSaved] = useState<AcreageTrace[]>([])

  useEffect(() => { draw() })
  useEffect(() => { (async () => setSaved(await listAcreageTraces()))() }, [])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    setImgUrl(url)
    setScalePts([]); setPoly([]); setMode('none')
  }

  function onClickCanvas(e: React.MouseEvent) {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const p = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
    if (mode === 'scale') {
      setScalePts((arr) => arr.length >= 2 ? [p] : [...arr, p])
    } else if (mode === 'poly') {
      setPoly((arr) => [...arr, p])
    }
  }

  const feetPerPixel = computeFeetPerPixel(scalePts, Number(scaleFeet))
  const acres = computeAcres(poly, feetPerPixel)

  function draw() {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.clearRect(0,0,canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    // draw scale line
    if (scalePts.length >= 1) {
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(scalePts[0].x, scalePts[0].y)
      if (scalePts[1]) { ctx.lineTo(scalePts[1].x, scalePts[1].y) }
      ctx.stroke()
    }
    // draw polygon
    if (poly.length > 0) {
      ctx.strokeStyle = '#0ea5e9'; ctx.fillStyle = 'rgba(14,165,233,0.2)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y)
      for (let i=1;i<poly.length;i++) ctx.lineTo(poly[i].x, poly[i].y)
      ctx.closePath(); ctx.fill(); ctx.stroke()
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Acreage Tools (Image)</h2>
        <div className="row">
          <input className="input" type="file" accept="image/*" onChange={onFile} />
          <button className="btn" onClick={() => setMode('scale')}>Set Scale</button>
          <button className="btn secondary" onClick={() => setMode('poly')}>Draw Polygon</button>
          <button className="btn secondary" onClick={() => { setPoly([]) }}>Clear Polygon</button>
          <button className="btn" onClick={async () => {
            if (!canvasRef.current) return
            const name = prompt('Name this trace (optional)') || undefined
            let blob: Blob | undefined
            try { blob = await new Promise<Blob | undefined>(res => canvasRef.current!.toBlob(b => res(b || undefined))) } catch {}
            const rec: AcreageTrace = {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              name,
              image: blob,
              imageType: blob?.type,
              scaleFeet: Number(scaleFeet) || undefined,
              scalePts: scalePts.map(p => [p.x, p.y]) as any,
              polygon: poly.map(p => [p.x, p.y]) as any,
            }
            await saveAcreageTrace(rec)
            setSaved(await listAcreageTraces())
            await logJob('tools:acreage', 'acreage_save', `Saved acreage trace ${name || rec.id}`, getActor())
          }}>Save Trace</button>
          <button className="btn secondary" onClick={async () => {
            const list = await listAcreageTraces()
            if (list.length === 0) return
            const full = await getAcreageTrace(list[0].id)
            if (!full) return
            setScaleFeet(String(full.scaleFeet || ''))
            setScalePts((full.scalePts || []).map(([x,y]) => ({ x, y })))
            setPoly((full.polygon || []).map(([x,y]) => ({ x, y })))
            if (full.image) {
              const url = URL.createObjectURL(full.image)
              setImgUrl(url)
            }
            await logJob('tools:acreage', 'acreage_load', `Loaded acreage trace ${full.name || full.id}`, getActor())
          }}>Load Latest</button>
        </div>
        <div className="row">
          <label className="label">Scale distance (ft)
            <input className="input" value={scaleFeet} onChange={(e) => setScaleFeet(e.target.value)} />
          </label>
          <div className="label">Feet per pixel
            <input className="input" readOnly value={Number.isFinite(feetPerPixel) ? feetPerPixel.toFixed(4) : ''} />
          </div>
          <div className="label">Polygon acres
            <input className="input" readOnly value={Number.isFinite(acres) ? acres.toFixed(4) : ''} />
          </div>
        </div>
      </section>
      {imgUrl && (
        <section className="card">
          <img ref={imgRef} src={imgUrl} alt="map" onLoad={() => draw()} style={{ display: 'none' }} />
          <canvas ref={canvasRef} onClick={onClickCanvas} style={{ width: '100%', maxWidth: 900, border: '1px solid var(--border)', borderRadius: 8 }} />
          <small className="muted">Click two points to set scale, enter real-world feet, then draw polygon to compute acres.</small>
        </section>
      )}
      <section className="card">
        <h3>Saved Traces</h3>
        {saved.length === 0 ? <div className="muted">No saved traces yet</div> : (
          <ul className="list">
            {saved.map(tr => (
              <li key={tr.id}>
                <button className="btn secondary" onClick={async () => {
                  const full = await getAcreageTrace(tr.id)
                  if (!full) return
                  setScaleFeet(String(full.scaleFeet || ''))
                  setScalePts((full.scalePts || []).map(([x,y]) => ({ x, y })))
                  setPoly((full.polygon || []).map(([x,y]) => ({ x, y })))
                  if (full.image) {
                    const url = URL.createObjectURL(full.image)
                    setImgUrl(url)
                  }
                  await logJob('tools:acreage', 'acreage_load', `Loaded acreage trace ${full.name || full.id}`, getActor())
                }}>Load</button>
                <span style={{ marginLeft: 8 }}>
                  {tr.name || '(unnamed)'} — saved {new Date(tr.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function computeFeetPerPixel(pts: Pt[], feet: number) {
  if (pts.length < 2 || !feet) return NaN
  const dx = pts[1].x - pts[0].x
  const dy = pts[1].y - pts[0].y
  const pixels = Math.hypot(dx, dy)
  return feet / pixels
}

function computeAcres(poly: Pt[], fpp: number) {
  if (poly.length < 3 || !Number.isFinite(fpp)) return NaN
  let areaPx = 0
  for (let i=0;i<poly.length;i++) {
    const a = poly[i], b = poly[(i+1)%poly.length]
    areaPx += a.x*b.y - b.x*a.y
  }
  areaPx = Math.abs(areaPx)/2
  const areaFt2 = areaPx * fpp * fpp
  return areaFt2 / 43560
}
