export type LocalUser = { id: string; phone: string; name?: string; role: 'user'|'developer'; password?: string }

const KEY = 'users_local'

function read(): LocalUser[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  // Seed with known developers if empty
  const seed: LocalUser[] = [
    { id: 'dev-local-8303072466', phone: '8303072466', name: 'Developer 1', role: 'developer', password: 'Bman200four!' },
    { id: 'dev-local-8303078689', phone: '8303078689', name: 'Developer 2', role: 'developer', password: 'BR@DTH@30$$' },
  ]
  try { localStorage.setItem(KEY, JSON.stringify(seed)) } catch {}
  return seed
}

function write(users: LocalUser[]) {
  try { localStorage.setItem(KEY, JSON.stringify(users)) } catch {}
}

export function listUsersLocal(): LocalUser[] {
  return read()
}

export function upsertUserLocal(u: { phone: string; name?: string; role?: 'user'|'developer'; password: string }): LocalUser {
  const users = read()
  let existing = users.find(x => x.phone === u.phone)
  if (existing) {
    existing.name = u.name ?? existing.name
    existing.role = (u.role || existing.role) as any
    existing.password = u.password || existing.password
  } else {
    existing = { id: crypto.randomUUID(), phone: u.phone, name: u.name, role: (u.role || 'user') as any, password: u.password }
    users.push(existing)
  }
  write(users)
  return existing
}

export function deleteUserLocal(id: string) {
  const users = read().filter(u => u.id !== id)
  write(users)
}

export function authenticateLocal(phone: string, password: string): LocalUser | null {
  const users = read()
  const hit = users.find(u => String(u.phone) === String(phone) && String(u.password || '') === String(password))
  return hit || null
}

