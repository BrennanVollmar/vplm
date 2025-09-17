import { useEffect, useState } from 'react'

export default function FieldModeToggle() {
  const [on, setOn] = useState<boolean>(() => localStorage.getItem('fieldMode') === '1')
  useEffect(() => {
    const cls = 'field-mode'
    if (on) document.documentElement.classList.add(cls)
    else document.documentElement.classList.remove(cls)
    localStorage.setItem('fieldMode', on ? '1' : '0')
  }, [on])
  return (
    <label className="row" style={{ gap: 6, fontSize: 12, color: 'var(--muted)' }}>
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Field Mode
    </label>
  )
}

