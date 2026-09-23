/**
 * ProtectedRoute.jsx
 * Wraps pages that need login.
 * Usage: <ProtectedRoute role="ngo"><NGODashboard /></ProtectedRoute>
 */
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children, role, navigate }) {
  const { user, loading } = useAuth()

  // Still checking localStorage
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 64px)', flexDirection: 'column', gap: '16px'
      }}>
        <div style={{
          width: '40px', height: '40px', border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Checking your login...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Not logged in at all
  if (!user) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 64px)', padding: '24px'
      }}>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: '1.5rem',
            fontWeight: 800, margin: '0 0 8px'
          }}>Login Required</h2>
          <p style={{ color: 'var(--muted)', margin: '0 0 24px', lineHeight: '1.7' }}>
            You need to log in to access this page.
          </p>
          <button onClick={() => navigate('auth')}
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none',
              borderRadius: '10px', padding: '12px 28px',
              fontFamily: 'var(--font-heading)', fontWeight: 700,
              fontSize: '0.9rem', cursor: 'pointer'
            }}>
            Log In / Sign Up
          </button>
        </div>
      </div>
    )
  }

  // Wrong role
  if (role && user.role !== role) {
    const roleNames = { user: 'Citizen/User', volunteer: 'Volunteer', ngo: 'NGO Admin' }
    const rolePages = {
      user: 'request',
      volunteer: 'volunteer',
      ngo: 'ngo',
    }

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100vh - 64px)', padding: '24px'
      }}>
        <div style={{ maxWidth: '440px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⛔</div>
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: '1.5rem',
            fontWeight: 800, margin: '0 0 8px'
          }}>
            Wrong Role
          </h2>
          <p style={{ color: 'var(--muted)', margin: '0 0 8px', lineHeight: '1.7' }}>
            This page is for <strong>{roleNames[role]}</strong> accounts.
          </p>
          <p style={{ color: 'var(--muted)', margin: '0 0 24px' }}>
            You're logged in as <strong>{roleNames[user.role]}</strong>.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={() => navigate(rolePages[user.role])}
              style={{
                background: 'var(--primary)', color: '#fff', border: 'none',
                borderRadius: '10px', padding: '12px 24px',
                fontFamily: 'var(--font-heading)', fontWeight: 700,
                cursor: 'pointer'
              }}>
              Go to My Dashboard
            </button>
            <button onClick={() => navigate('auth')}
              style={{
                background: 'transparent', color: 'var(--muted)',
                border: '1px solid var(--border)', borderRadius: '10px',
                padding: '12px 24px', cursor: 'pointer'
              }}>
              Switch Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // All good — show the page
  return children
}