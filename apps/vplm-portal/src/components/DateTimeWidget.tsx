import { useEffect, useState } from 'react'

export default function DateTimeWidget() {
  const [now, setNow] = useState<Date>(new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  return (
    <span className="badge" style={{ background: 'var(--brand-50)', color: 'var(--brand-600)' }}>
      {now.toLocaleDateString()} {now.toLocaleTimeString()}
    </span>
  )
}

