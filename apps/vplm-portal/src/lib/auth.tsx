import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, hasRemoteApi } from './api'
import { authenticateLocal, findUserByPhone } from '../features/users/local'

type User = { id: string; phone: string; name?: string; role: 'user'|'developer' }

type AuthCtx = {
  user: User | null
  token: string | null
  login: (phone: string, password: string, rememberDevice?: boolean) => Promise<void>
  logout: () => void
  hydrated: boolean
  deviceTrusted: boolean
  trustedUntil: number | null
  revokeDeviceTrust: () => void
}

const Ctx = createContext<AuthCtx | undefined>(undefined)

const TRUST_STORAGE_KEY = 'auth_trusted_devices'
const DEVICE_ID_KEY = 'auth_device_id'
const TRUST_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

type TrustedDeviceMap = Record<string, { expiresAt: number; userId?: string }>

type InitialSnapshot = {
  token: string | null
  user: User | null
  deviceId: string | null
  deviceTrusted: boolean
  trustedUntil: number | null
}

function isBrowser() {
  return typeof window !== 'undefined'
}

function ensureDeviceId(): string | null {
  if (!isBrowser()) return null
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    const fallback = Math.random().toString(36).slice(2)
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `dev-${fallback}`
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function loadTrustedDevices(): TrustedDeviceMap {
  if (!isBrowser()) return {}
  const raw = localStorage.getItem(TRUST_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as TrustedDeviceMap
  } catch {
    // ignore parse errors and reset below
  }
  return {}
}

function saveTrustedDevices(map: TrustedDeviceMap) {
  if (!isBrowser()) return
  localStorage.setItem(TRUST_STORAGE_KEY, JSON.stringify(map))
}

function getTrustedEntry(deviceId: string | null) {
  if (!deviceId || !isBrowser()) return null
  const map = loadTrustedDevices()
  const entry = map[deviceId]
  const now = Date.now()
  if (entry && entry.expiresAt > now) {
    return entry
  }
  if (entry) {
    delete map[deviceId]
    saveTrustedDevices(map)
  }
  return null
}

function trustDevice(deviceId: string | null, userId: string): number | null {
  if (!deviceId || !isBrowser()) return null
  const map = loadTrustedDevices()
  const expiresAt = Date.now() + TRUST_DURATION_MS
  map[deviceId] = { expiresAt, userId }
  saveTrustedDevices(map)
  return expiresAt
}

function clearTrustedDevice(deviceId: string | null): boolean {
  if (!deviceId || !isBrowser()) return false
  const map = loadTrustedDevices()
  if (map[deviceId]) {
    delete map[deviceId]
    saveTrustedDevices(map)
    return true
  }
  return false
}

function readStoredUser(): User | null {
  if (!isBrowser()) return null
  const stored = localStorage.getItem('auth_user')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const deviceIdRef = useRef<string | null>(null)
  const initialSnapshot = useMemo<InitialSnapshot>(() => {
    if (!isBrowser()) {
      return { token: null, user: null, deviceId: null, deviceTrusted: false, trustedUntil: null }
    }
    const deviceId = ensureDeviceId()
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = readStoredUser()
    let token: string | null = null
    let hydratedUser: User | null = null
    let deviceTrusted = false
    let trustedUntil: number | null = null
    if (storedToken && storedUser) {
      const trust = getTrustedEntry(deviceId)
      if (trust) {
        token = storedToken
        hydratedUser = storedUser
        deviceTrusted = true
        trustedUntil = trust.expiresAt
      } else if (storedToken === 'DEV') {
        const expiresAt = trustDevice(deviceId, storedUser.id)
        token = storedToken
        hydratedUser = storedUser
        deviceTrusted = Boolean(expiresAt)
        trustedUntil = expiresAt
      } else {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_last_phone')
      }
    }
    return { token, user: hydratedUser, deviceId, deviceTrusted, trustedUntil }
  }, [])

  if (!deviceIdRef.current) deviceIdRef.current = initialSnapshot.deviceId

  const [user, setUser] = useState<User | null>(initialSnapshot.user)
  const [token, setToken] = useState<string | null>(initialSnapshot.token)
  const [hydrated, setHydrated] = useState<boolean>(!initialSnapshot.token)
  const [deviceTrusted, setDeviceTrusted] = useState<boolean>(initialSnapshot.deviceTrusted)
  const [trustedUntil, setTrustedUntil] = useState<number | null>(initialSnapshot.trustedUntil)

  useEffect(() => {
    if (!token) {
      setHydrated(true)
      return
    }
    if (token === 'DEV') {
      if (!user) {
        const lastPhone = isBrowser() ? localStorage.getItem('auth_last_phone') : null
        if (lastPhone) {
          const local = findUserByPhone(lastPhone)
          if (local) {
            const mapped = { id: local.id, phone: local.phone, name: local.name, role: local.role }
            if (isBrowser()) localStorage.setItem('auth_user', JSON.stringify(mapped))
            setUser(mapped)
          }
        }
      }
      setHydrated(true)
      return
    }
    if (!hasRemoteApi) {
      setHydrated(true)
      return
    }
    let cancelled = false
    setHydrated(false)
    apiFetch('/auth/me')
      .then((j) => {
        if (cancelled) return
        setUser(j.user)
        if (isBrowser()) localStorage.setItem('auth_user', JSON.stringify(j.user))
      })
      .catch(() => {
        if (isBrowser()) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
        }
        setToken(null)
        setUser(null)
        setDeviceTrusted(false)
        setTrustedUntil(null)
      })
      .finally(() => { if (!cancelled) setHydrated(true) })
    return () => { cancelled = true }
  }, [token])

  async function login(phone: string, password: string, rememberDevice = true) {
    const deviceId = deviceIdRef.current
    const applyTrust = (shouldTrust: boolean, userId: string) => {
      if (shouldTrust) {
        const expiresAt = trustDevice(deviceId, userId)
        if (expiresAt) {
          setDeviceTrusted(true)
          setTrustedUntil(expiresAt)
        } else {
          setDeviceTrusted(false)
          setTrustedUntil(null)
        }
      } else {
        clearTrustedDevice(deviceId)
        setDeviceTrusted(false)
        setTrustedUntil(null)
      }
    }

    // Try local auth first (no API dependency)
    const local = authenticateLocal(phone, password)
    if (local) {
      const mapped = { id: local.id, phone: local.phone, name: local.name, role: local.role }
      if (isBrowser()) {
        localStorage.setItem('auth_token', 'DEV')
        localStorage.setItem('auth_user', JSON.stringify(mapped))
        localStorage.setItem('auth_last_phone', local.phone)
      }
      applyTrust(rememberDevice, mapped.id)
      setToken('DEV')
      setUser(mapped)
      setHydrated(true)
      return
    }
    // If not found locally, try API (optional)
    if (!hasRemoteApi) throw new Error('No remote API configured for login. Use a developer account.')
    const j = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })
    if (isBrowser()) {
      localStorage.setItem('auth_token', j.token)
      localStorage.setItem('auth_user', JSON.stringify(j.user))
    }
    applyTrust(rememberDevice, j.user.id)
    setToken(j.token)
    setUser(j.user)
    setHydrated(true)
  }

  function logout() {
    if (isBrowser()) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('auth_last_phone')
    }
    clearTrustedDevice(deviceIdRef.current)
    setDeviceTrusted(false)
    setTrustedUntil(null)
    setToken(null)
    setUser(null)
    setHydrated(true)
  }

  function revokeDeviceTrust() {
    clearTrustedDevice(deviceIdRef.current)
    setDeviceTrusted(false)
    setTrustedUntil(null)
  }

  return (
    <Ctx.Provider
      value={{ user, token, login, logout, hydrated, deviceTrusted, trustedUntil, revokeDeviceTrust }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
