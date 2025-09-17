import { useEffect, useState } from 'react'
import { getOutboxCount, trySync } from '../features/offline/sync'

export default function SyncBadge() {
  const [online, setOnline] = useState<boolean>(navigator.onLine)
  const [outbox, setOutbox] = useState<number>(0)
  const [syncing, setSyncing] = useState<boolean>(false)

  useEffect(() => {
    const update = async () => setOutbox(await getOutboxCount())
    update()
    const handleOnline = () => { setOnline(true); update() }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const id = setInterval(update, 3000)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); clearInterval(id) }
  }, [])

  const label = online ? (syncing ? `Syncing (${outbox})` : `Online (${outbox})`) : 'Offline'
  const bg = online ? (syncing ? 'var(--warn)' : 'var(--brand-50)') : '#fee2e2'
  const color = online ? 'var(--brand-600)' : '#991b1b'

  async function onSyncNow() {
    setSyncing(true)
    try {
      await trySync()
      setOutbox(await getOutboxCount())
    } finally {
      setSyncing(false)
    }
  }

  return (
    <span className="badge" style={{ background: bg, color }}>
      {label}
      {online && outbox > 0 && (
        <button className="btn secondary" onClick={onSyncNow} style={{ padding: '2px 8px', fontSize: 12 }}>Sync now</button>
      )}
    </span>
  )
}
