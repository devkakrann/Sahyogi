/**
 * AuthContext.jsx
 * Global auth state — wrap App with this.
 * Gives every component access to: user, role, login, logout, getToken, canAccess
 */
import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Revalidate token on mount
  useEffect(() => {
    const token = localStorage.getItem('sahayak_token')
    const savedUser = localStorage.getItem('sahayak_user')

    if (!token || !savedUser) {
      setLoading(false)
      return
    }

    // Optimistically load saved user while we re-verify
    try {
      setUser(JSON.parse(savedUser))
    } catch {
      // malformed JSON — clear
      localStorage.removeItem('sahayak_user')
    }

    // Verify token with backend
    api.getMe(token).then(({ data, error }) => {
      if (data?.user) {
        setUser(data.user)
        localStorage.setItem('sahayak_user', JSON.stringify(data.user))
      } else if (error) {
        // Token expired or invalid — clear stale session
        console.warn('Token validation failed:', error)
        localStorage.removeItem('sahayak_token')
        localStorage.removeItem('sahayak_user')
        setUser(null)
      }
      setLoading(false)
    })
  }, [])

  const login = (userData, token) => {
    localStorage.setItem('sahayak_token', token)
    localStorage.setItem('sahayak_user', JSON.stringify(userData))
    setUser(userData)
  }

  const updateUser = (updates = {}) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem('sahayak_user', JSON.stringify(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }

  const logout = () => {
    const token = localStorage.getItem('sahayak_token')
    if (token) api.logout(token).catch(() => {})
    localStorage.removeItem('sahayak_token')
    localStorage.removeItem('sahayak_user')
    setUser(null)
  }

  const getToken = () => localStorage.getItem('sahayak_token')

  const role = user?.role || null

  const canAccess = (requiredRole) => {
    if (!user) return false
    if (!requiredRole) return true
    if (Array.isArray(requiredRole)) return requiredRole.includes(user.role)
    return user.role === requiredRole
  }

  const isNgo = role === 'ngo'
  const isVolunteer = role === 'volunteer'
  const isUser = role === 'user' || role === 'citizen'
  const isAdmin = role === 'admin'

  return (
    <AuthContext.Provider value={{ user, loading, login, updateUser, logout, getToken, canAccess, role, isNgo, isVolunteer, isUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
