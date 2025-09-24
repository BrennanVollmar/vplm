import React, { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch, hasRemoteApi } from './api'
import { authenticateLocal, findUserByPhone } from '../features/users/local'

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
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')
    if (storedToken === 'DEV') {
      setToken('DEV')
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)) } catch { /* ignore */ }
      } else {
        const lastPhone = localStorage.getItem('auth_last_phone')
        if (lastPhone) {
          const local = findUserByPhone(lastPhone)
          if (local) {
            const mapped = { id: local.id, phone: local.phone, name: local.name, role: local.role }
            localStorage.setItem('auth_user', JSON.stringify(mapped))
            setUser(mapped)
          }
        }
      }
      return
    }
    if (storedToken && hasRemoteApi) {
      setToken(storedToken)
      apiFetch('/auth/me')
        .then((j) => {
          setUser(j.user)
          localStorage.setItem('auth_user', JSON.stringify(j.user))
        })
        .catch(() => {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          setToken(null)
        })
    }
  }, [])

  async function login(phone: string, password: string) {
    // Try local auth first (no API dependency)
    const local = authenticateLocal(phone, password)
    if (local) {
      const mapped = { id: local.id, phone: local.phone, name: local.name, role: local.role }
      localStorage.setItem('auth_token', 'DEV')
      localStorage.setItem('auth_user', JSON.stringify(mapped))
      localStorage.setItem('auth_last_phone', local.phone)
      setToken('DEV')
      setUser(mapped)
      return
    }
    // If not found locally, try API (optional)
    if (!hasRemoteApi) throw new Error('No remote API configured for login. Use a developer account.')
    const j = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })
    localStorage.setItem('auth_token', j.token)
    localStorage.setItem('auth_user', JSON.stringify(j.user))
    setToken(j.token)
    setUser(j.user)
  }
  function logout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_last_phone')
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
