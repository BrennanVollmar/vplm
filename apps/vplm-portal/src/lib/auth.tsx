import React, { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch } from './api'
import { authenticateLocal } from '../features/users/local'

type User = { id: string; phone: string; name?: string; role: 'user'|'developer' }

type AuthCtx = {
  user: User | null
  token: string | null
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('auth_token')
    if (t) {
      setToken(t)
      apiFetch('/auth/me').then((j) => setUser(j.user)).catch(() => { localStorage.removeItem('auth_token'); setToken(null) })
    }
  }, [])

  async function login(phone: string, password: string) {
    // Try local auth first (no API dependency)
    const local = authenticateLocal(phone, password)
    if (local) {
      localStorage.setItem('auth_token', 'DEV')
      setToken('DEV')
      setUser({ id: local.id, phone: local.phone, name: local.name, role: local.role })
      return
    }
    // If not found locally, try API (optional)
    const j = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })
    localStorage.setItem('auth_token', j.token)
    setToken(j.token)
    setUser(j.user)
  }
  function logout() {
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
  }

  return <Ctx.Provider value={{ user, token, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
