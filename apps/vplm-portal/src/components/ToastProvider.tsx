import React, { createContext, useContext, useMemo, useState } from 'react'

export type Toast = { id: string; title?: string; message: string; tone?: 'info' | 'success' | 'warn' | 'error'; timeoutMs?: number }

type Ctx = {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastCtx = createContext<Ctx | null>(null)

export function useToast() {
  const c = useContext(ToastCtx)
  if (!c) throw new Error('useToast must be used within ToastProvider')
  return c
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const api = useMemo<Ctx>(() => ({
    toasts,
    push(t) {
      const id = crypto.randomUUID()
      const toast: Toast = { id, timeoutMs: 4000, ...t }
      setToasts((arr) => [...arr, toast])
      if (toast.timeoutMs) setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), toast.timeoutMs)
    },
    dismiss(id) { setToasts((arr) => arr.filter((x) => x.id !== id)) },
  }), [toasts])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'grid', gap: 8, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} className="card" style={{ minWidth: 260, boxShadow: 'var(--shadow)', borderLeft: `4px solid ${toneColor(t.tone)}` }}>
            {t.title && <div style={{ fontWeight: 800, marginBottom: 4 }}>{t.title}</div>}
            <div>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

function toneColor(t?: Toast['tone']) {
  switch (t) {
    case 'success': return '#16a34a'
    case 'warn': return '#f59e0b'
    case 'error': return '#ef4444'
    default: return 'var(--brand)'
  }
}

