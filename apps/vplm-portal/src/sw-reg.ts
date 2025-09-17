import { trySync } from './features/offline/sync'

export function registerSW() {
  // In development, do not use a service worker. Also, proactively
  // unregister any existing SWs that might have been installed earlier.
  if (import.meta.env.DEV) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => { regs.forEach((r) => r.unregister()) })
        .catch(() => {})
    }
    return
  }

  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')

      // Listen for SW messages to trigger app-level sync
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        if (event.data && event.data.type === 'tpm-sync') {
          trySync().catch(() => {})
        }
      })

      // Register one-off background sync if supported
      if ('sync' in reg) {
        try { await (reg as any).sync.register('tpm-sync') } catch {}
      }

      // Attempt periodic background sync
      const ps = (reg as any).periodicSync
      if (ps && 'requestPermission' in (navigator as any)) {
        try {
          const status = await (navigator as any).permissions.query({ name: 'periodic-background-sync' as any })
          if ((status.state === 'granted' || status.state === 'prompt')) {
            try { await ps.register('tpm-periodic', { minInterval: 15 * 60 * 1000 }) } catch {}
          }
        } catch {}
      }

      // Also trigger sync when connection is restored
      window.addEventListener('online', () => { trySync().catch(() => {}) })
    } catch (err) {
      console.warn('SW registration failed', err)
    }
  })
}
