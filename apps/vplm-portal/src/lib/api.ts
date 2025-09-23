export const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

function getToken(): string | null {
  try { return localStorage.getItem('auth_token') } catch { return null }
}

export async function apiFetch(path: string, opts: RequestInit = {}) {
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

