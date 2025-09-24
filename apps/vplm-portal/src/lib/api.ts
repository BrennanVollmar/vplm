const RAW_API = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL) : ''
export const API_BASE = RAW_API.replace(/\/$/, '')
export const hasRemoteApi = Boolean(API_BASE)

function getToken(): string | null {
  try { return localStorage.getItem('auth_token') } catch { return null }
}

export async function apiFetch(path: string, opts: RequestInit = {}) {
  if (!hasRemoteApi) throw new Error('Remote API is not configured')
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any) }
  const t = getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers })
  if (!res.ok) {
    let msg = res.statusText
    try { const j = await res.json(); msg = j.error || msg } catch {}
    throw new Error(msg)
  }
  const ct = res.headers.get('Content-Type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text()
}
