import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => (localStorage.getItem('theme') || 'light') === 'dark')
  useEffect(() => {
    const cls = 'theme-dark'
    if (dark) document.documentElement.classList.add(cls)
    else document.documentElement.classList.remove(cls)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  return (
    <label className="row" style={{ gap: 6, fontSize: 12, color: 'var(--muted)' }}>
      <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark
    </label>
  )
}

