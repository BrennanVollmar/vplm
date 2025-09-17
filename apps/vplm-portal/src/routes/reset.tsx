import { useEffect, useState } from 'react'

export default function ResetPage() {
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    (async () => {
      const msgs: string[] = []
      function push(m: string) { msgs.push(m); setLog([...msgs]) }

      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          if (regs.length === 0) push('No service workers registered')
          for (const r of regs) {
            try { await r.unregister(); push('Unregistered a service worker') } catch (e) { push('Failed to unregister a service worker') }
          }
        } else {
          push('Service workers not supported')
        }
      } catch (e) {
        push('Error while removing service workers')
      }

      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          for (const k of keys) {
            try { await caches.delete(k); push(`Deleted cache ${k}`) } catch { push(`Failed to delete cache ${k}`) }
          }
        }
      } catch (e) {
        push('Error while clearing caches')
      }

      try {
        // Small delay to let unregister settle, then reload to fresh app
        setTimeout(() => { location.replace('/') }, 500)
      } catch {}
    })()
  }, [])

  return (
    <div className="grid">
      <section className="card">
        <h2>Resetting App Cache</h2>
        <p className="muted">Clearing service workers and caches… this page will reload automatically.</p>
        {log.length > 0 && (
          <ul className="list">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => location.replace('/')}>Reload now</button>
        </div>
      </section>
    </div>
  )
}

