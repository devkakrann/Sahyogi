import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getDemoStore, updateDemoRequests } from '../services/demoStore.js'

function urgencyBadge(urgency) {
  const u = String(urgency || '').toLowerCase()
  if (u === 'critical') return 'bg-red-100 text-red-700'
  if (u === 'high' || u === 'urgent') return 'bg-amber-100 text-amber-700'
  if (u === 'medium') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'pending') return 'bg-amber-100 text-amber-700'
  if (s === 'matched') return 'bg-blue-100 text-blue-700'
  if (s === 'assigned') return 'bg-indigo-100 text-indigo-700'
  if (s === 'in_progress') return 'bg-purple-100 text-purple-700'
  if (s === 'fulfilled') return 'bg-emerald-100 text-emerald-700'
  return 'bg-slate-100 text-slate-600'
}

function needIcon(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'food') return 'restaurant'
  if (t === 'medical') return 'medical_services'
  if (t === 'shelter') return 'home'
  if (t === 'water') return 'water_drop'
  if (t === 'rescue') return 'handshake'
  return 'volunteer_activism'
}

function formatTime(value) {
  if (!value) return 'Recently'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const delta = Date.now() - d.getTime()
  const mins = Math.round(delta / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function NGODashboard({ navigate, socketData }) {
  const { user, getToken, logout } = useAuth()
  const [requests, setRequests] = useState([])
  const [volunteers, setVolunteers] = useState([])
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active') // active | history | volunteers
  const [actionLoading, setActionLoading] = useState({})
  const isDemo = String(user?.id || '').startsWith('DEMO-')
  const ngoDomains = (user?.domains || []).map((d) => String(d || '').toLowerCase()).filter(Boolean)

  const loadData = useCallback(async () => {
    if (isDemo) {
      const demo = getDemoStore()
      setRequests(demo.requests || [])
      setVolunteers(demo.volunteers || [])
      setInviteCode(demo.inviteCode || 'DEMO-NGO')
      setLoading(false)
      setError('')
      return
    }

    const token = getToken()
    setError('')

    const [boardRes, volRes, codeRes] = await Promise.all([
      api.getNgoBoard(token),
      api.getNgoVolunteers(token),
      api.getNgoInviteCode(token),
    ])

    if (boardRes.data) {
      setRequests(boardRes.data.requests || [])
      if (boardRes.data.inviteCode) setInviteCode(boardRes.data.inviteCode)
      if (boardRes.data.volunteers) setVolunteers(boardRes.data.volunteers || [])
    } else if (boardRes.error) {
      // Fallback to public requests
      const fallback = await api.getNgoRequests(token)
      setRequests(fallback.data?.requests || [])
      if (boardRes.error.includes('Invalid token') || boardRes.error.includes('No token')) {
        setError('Session expired. Please log in again.')
        logout()
        if (navigate) navigate('auth')
        setLoading(false)
        return
      }
      if (boardRes.error.includes('403') || boardRes.error.includes('role')) {
        setError('NGO board requires NGO role authentication.')
      }
    }

    if (volRes.data) setVolunteers(volRes.data.volunteers || [])
    if (codeRes.data) setInviteCode(codeRes.data.inviteCode || '')

    setLoading(false)
  }, [getToken, logout, navigate, isDemo])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 20000)
    return () => clearInterval(interval)
  }, [loadData])

  useEffect(() => {
    if (!isDemo) return undefined

    const refreshDemo = () => {
      const demo = getDemoStore()
      setRequests(demo.requests || [])
      setVolunteers(demo.volunteers || [])
      setInviteCode(demo.inviteCode || 'DEMO-NGO')
      setLoading(false)
      setError('')
    }

    const handleStorage = (event) => {
      if (event.key === 'sahayak_demo_store_v2') {
        refreshDemo()
      }
    }

    window.addEventListener('sahayak_demo_update', refreshDemo)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('sahayak_demo_update', refreshDemo)
      window.removeEventListener('storage', handleStorage)
    }
  }, [isDemo])

  useEffect(() => {
    if (isDemo) return
    if (!socketData?.requests?.length) return
    const incoming = socketData.requests
    const filtered = ngoDomains.length
      ? incoming.filter((req) => ngoDomains.includes(String(req.type || '').toLowerCase()))
      : incoming
    if (filtered.length) {
      setRequests(filtered)
    }
  }, [socketData?.requests, ngoDomains, isDemo])

  const availableVolunteers = volunteers.filter((v) => v.availableNow !== false)
  const normalizedRequests = requests.map((req) => ({
    ...req,
    status: String(req.status || '').toLowerCase(),
  }))
  const activeRequests = normalizedRequests.filter((r) => r.status !== 'fulfilled' && r.status !== 'cancelled')
  const historyRequests = normalizedRequests.filter((r) => r.status === 'fulfilled' || r.status === 'cancelled')

  const stats = {
    pending: activeRequests.filter((r) => r.status === 'pending').length,
    matched: activeRequests.filter((r) => r.status === 'matched' || r.status === 'assigned').length,
    inProgress: activeRequests.filter((r) => r.status === 'in_progress').length,
    fulfilled: historyRequests.filter((r) => r.status === 'fulfilled').length,
    critical: activeRequests.filter((r) => String(r.urgency || '').toLowerCase() === 'critical').length,
  }

  async function handleClaim(requestId) {
    setActionLoading((prev) => ({ ...prev, [requestId]: 'claiming' }))
    if (isDemo) {
      const nextStore = updateDemoRequests((current) =>
        current.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: 'matched',
                assignedNgoId: user?.id || req.assignedNgoId,
                assignedNgoName: user?.orgName || user?.fullName || req.assignedNgoName,
                claimedAt: new Date().toISOString(),
              }
            : req,
        ),
      )
      setRequests(nextStore.requests || [])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sahayak_demo_update'))
      }
      setActionLoading((prev) => ({ ...prev, [requestId]: null }))
      return
    }

    const { error: err } = await api.claimRequest(getToken(), requestId)
    if (err) setError(err)
    else await loadData()
    setActionLoading((prev) => ({ ...prev, [requestId]: null }))
  }

  async function handleAssign(requestId, volunteerId) {
    setActionLoading((prev) => ({ ...prev, [requestId]: 'assigning' }))
    if (isDemo) {
      const volunteer = availableVolunteers.find((v) => v.id === volunteerId)
      const nextStore = updateDemoRequests((current) =>
        current.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: 'assigned',
                assignedNgoId: user?.id || req.assignedNgoId,
                assignedNgoName: user?.orgName || user?.fullName || req.assignedNgoName,
                assignedVolunteerId: volunteer?.id,
                assignedVolunteerName: volunteer?.fullName,
                assignedAt: new Date().toISOString(),
              }
            : req,
        ),
      )
      setRequests(nextStore.requests || [])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sahayak_demo_update'))
      }
      setActionLoading((prev) => ({ ...prev, [requestId]: null }))
      return
    }

    const { error: err } = await api.assignVolunteer(getToken(), requestId, volunteerId)
    if (err) setError(err)
    else await loadData()
    setActionLoading((prev) => ({ ...prev, [requestId]: null }))
  }

  async function handleFulfill(requestId) {
    setActionLoading((prev) => ({ ...prev, [requestId]: 'fulfilling' }))
    if (isDemo) {
      const nextStore = updateDemoRequests((current) =>
        current.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: 'fulfilled',
                fulfilledAt: new Date().toISOString(),
              }
            : req,
        ),
      )
      setRequests(nextStore.requests || [])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sahayak_demo_update'))
      }
      setActionLoading((prev) => ({ ...prev, [requestId]: null }))
      return
    }

    const { error: err } = await api.fulfillRequest(getToken(), requestId)
    if (err) {
      setError(err)
    } else {
      setRequests((current) =>
        current.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: 'fulfilled',
                fulfilledAt: new Date().toISOString(),
              }
            : req,
        ),
      )
      await loadData()
    }
    setActionLoading((prev) => ({ ...prev, [requestId]: null }))
  }

  return (
    <section className="bg-background text-on-surface min-h-screen pt-24 pb-10">
      <div className="max-w-screen-2xl mx-auto px-6 xl:px-10 space-y-6">

        {/* Header */}
        <header className="glass-card rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-primary text-xs tracking-[0.22em] font-extrabold uppercase">NGO Command Center</p>
              <h1 className="text-3xl font-headline font-extrabold">{user?.orgName || user?.fullName || 'NGO Dashboard'}</h1>
              <p className="text-on-surface-variant mt-1">Manage requests, assign volunteers, track fulfillment.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('analytics')} className="btn-ghost">Analytics</button>
              <button onClick={() => navigate('map')} className="btn-ghost">Live Map</button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Pending</p>
              <p className="font-mono text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Matched</p>
              <p className="font-mono text-2xl font-bold text-blue-600">{stats.matched}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Critical</p>
              <p className="font-mono text-2xl font-bold text-red-600">{stats.critical}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Fulfilled</p>
              <p className="font-mono text-2xl font-bold text-emerald-600">{stats.fulfilled}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl border border-primary-container/40">
              <p className="text-[10px] font-bold uppercase text-primary tracking-widest">Volunteers</p>
              <p className="font-mono text-2xl font-bold text-primary">{volunteers.length}</p>
            </div>
          </div>

        {/* Invite Code */}
        {inviteCode ? (
          <div className="mt-4 flex items-center gap-3 bg-primary/5 rounded-xl px-4 py-2.5">
            <span className="material-symbols-outlined text-primary text-sm">vpn_key</span>
            <span className="text-sm text-on-surface-variant">Volunteer Invite Code:</span>
            <code className="font-mono font-bold text-primary tracking-widest text-lg">{inviteCode}</code>
            <button
              onClick={() => navigator.clipboard?.writeText(inviteCode)}
              className="text-xs text-primary font-bold hover:underline ml-auto"
            >
              Copy
            </button>
          </div>
        ) : null}

        {/* Volunteer Snapshot */}
        {volunteers.length ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Volunteer Snapshot</p>
                <h3 className="text-lg font-bold font-headline text-on-surface">Available Volunteers</h3>
              </div>
              <button onClick={() => setTab('volunteers')} className="btn-ghost text-sm">
                View All
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {volunteers.slice(0, 3).map((vol) => (
                <article key={vol.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {(vol.fullName || '??').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{vol.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{vol.phone}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${vol.availableNow ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {vol.availableNow ? 'Available' : 'Offline'}
                  </span>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </header>

        {/* Error */}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-5 py-3 text-sm font-semibold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 font-bold">✕</button>
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'active', label: `Active (${activeRequests.length})`, icon: 'pending_actions' },
            { key: 'history', label: `History (${historyRequests.length})`, icon: 'history' },
            { key: 'volunteers', label: `Volunteers (${volunteers.length})`, icon: 'group' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                tab === t.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto h-10 w-10 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
            <p className="mt-3 text-sm text-on-surface-variant">Loading requests...</p>
          </div>
        ) : null}

        {/* Active Requests Tab */}
        {!loading && tab === 'active' ? (
          <div className="space-y-4">
            {activeRequests.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300">inbox</span>
                <p className="text-slate-500 mt-2">No active requests matching your services.</p>
              </div>
            ) : null}

            {activeRequests
              .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
              .map((req) => {
                const reqStatus = req.status
                const isClaimable = reqStatus === 'pending' || reqStatus === 'open'
                const isAssignable = reqStatus === 'matched' && availableVolunteers.length > 0
                const isFulfillable = false
                const actionState = actionLoading[req.id]

                return (
                  <article key={req.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 hover-lift">
                    <div className="flex flex-col lg:flex-row gap-4">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-2xl">{needIcon(req.type)}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold font-headline text-lg">{req.name || 'Anonymous'}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${urgencyBadge(req.urgency)}`}>
                            {String(req.urgency || 'medium').toUpperCase()}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusBadge(req.status)}`}>
                            {String(req.status || 'pending').toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400">{formatTime(req.createdAt)}</span>
                        </div>

                        <p className="text-sm text-slate-600">{req.description || req.notes || ''}</p>

                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">location_on</span>{req.area || 'Unknown'}</span>
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">groups</span>{req.people || 1} people</span>
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">trending_up</span>Score: {req.priorityScore || req.aiScore || 0}</span>
                          {req.assignedVolunteerName ? (
                            <span className="flex items-center gap-1 text-indigo-600 font-semibold">
                              <span className="material-symbols-outlined text-sm">person</span>{req.assignedVolunteerName}
                            </span>
                          ) : null}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {isClaimable ? (
                            <button
                              onClick={() => handleClaim(req.id)}
                              disabled={!!actionState}
                              className="active-scale bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
                            >
                              {actionState === 'claiming' ? 'Claiming...' : '⚡ Claim Request'}
                            </button>
                          ) : null}

                          {isAssignable ? (
                            <select
                              onChange={(e) => { if (e.target.value) handleAssign(req.id, e.target.value) }}
                              disabled={!!actionState}
                              className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl font-bold text-sm border border-indigo-200 cursor-pointer"
                              defaultValue=""
                            >
                              <option value="" disabled>Assign Volunteer...</option>
                              {availableVolunteers.map((v) => (
                                <option key={v.id} value={v.id}>{v.fullName} ({v.skills?.join(', ') || 'General'})</option>
                              ))}
                            </select>
                          ) : null}

                          {isFulfillable ? (
                            <button
                              onClick={() => handleFulfill(req.id)}
                              disabled={!!actionState}
                              className="active-scale bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
                            >
                              {actionState === 'fulfilling' ? 'Completing...' : '✓ Mark Fulfilled'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
          </div>
        ) : null}

        {/* History Tab */}
        {!loading && tab === 'history' ? (
          <div className="space-y-3">
            {historyRequests.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
                <p className="text-slate-500">No history yet.</p>
              </div>
            ) : null}

            {historyRequests.map((req) => (
              <article key={req.id} className="bg-white/70 rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{req.name || 'Anonymous'} — {String(req.type || '').charAt(0).toUpperCase() + String(req.type || '').slice(1)}</p>
                  <p className="text-xs text-slate-500">{req.area || ''} · {formatTime(req.fulfilledAt || req.createdAt)}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">
                  FULFILLED
                </span>
              </article>
            ))}
          </div>
        ) : null}

        {/* Volunteers Tab */}
        {!loading && tab === 'volunteers' ? (
          <div className="space-y-4">
            {inviteCode ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
                <h3 className="font-bold font-headline">Share Invite Code</h3>
                <p className="text-sm text-slate-500">Volunteers can use this code during signup to join your NGO.</p>
                <div className="flex items-center gap-3 bg-primary/5 rounded-xl px-4 py-3">
                  <code className="font-mono font-bold text-2xl text-primary tracking-widest">{inviteCode}</code>
                  <button onClick={() => navigator.clipboard?.writeText(inviteCode)} className="btn-ghost text-sm">Copy</button>
                </div>
              </div>
            ) : null}

            {volunteers.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300">group_off</span>
                <p className="text-slate-500 mt-2">No volunteers linked yet. Share your invite code!</p>
              </div>
            ) : null}

            {volunteers.map((vol) => (
              <article key={vol.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {(vol.fullName || '??').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-bold">{vol.fullName}</p>
                  <p className="text-xs text-slate-500">{vol.phone} · {(vol.skills || []).join(', ') || 'General'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${vol.availableNow ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {vol.availableNow ? 'Available' : 'Offline'}
                </span>
              </article>
            ))}
          </div>
        ) : null}

      </div>
    </section>
  )
}
