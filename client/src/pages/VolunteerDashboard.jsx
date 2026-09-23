import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getShortUserName } from '../utils/userDisplay.js'
import { getDemoStore, updateDemoRequests } from '../services/demoStore.js'

function labelForType(type) {
  const value = String(type || 'GENERAL').toLowerCase()
  if (value === 'food') return 'Food Delivery'
  if (value === 'medical') return 'Medical Transport'
  if (value === 'shelter') return 'Shelter Setup'
  if (value === 'water') return 'Water Supply'
  if (value === 'rescue') return 'Rescue Operation'
  return 'Relief Support'
}

function iconForType(type) {
  const value = String(type || 'GENERAL').toLowerCase()
  if (value === 'food') return 'restaurant'
  if (value === 'medical') return 'medical_services'
  if (value === 'shelter') return 'home_repair_service'
  if (value === 'water') return 'water_drop'
  if (value === 'rescue') return 'handshake'
  return 'volunteer_activism'
}

function urgencyConfig(urgency) {
  const value = String(urgency || 'MEDIUM').toLowerCase()
  if (value === 'critical') {
    return { card: 'border-2 border-red-200', badge: 'bg-red-100 text-red-700', meter: 'bg-red-500 w-[85%]', tone: 'Critical' }
  }
  if (value === 'high' || value === 'urgent') {
    return { card: 'border border-amber-200', badge: 'bg-amber-100 text-amber-700', meter: 'bg-amber-500 w-[60%]', tone: 'High' }
  }
  return { card: 'border border-slate-200', badge: 'bg-slate-100 text-slate-600', meter: 'bg-blue-400 w-[40%]', tone: 'Medium' }
}

function formatTime(value) {
  if (!value) return 'Recently'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const delta = Date.now() - d.getTime()
  const mins = Math.round(delta / 60000)
  if (mins < 60) return `Reported ${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `Reported ${hrs}h ago`
  return `Reported ${Math.round(hrs / 24)}d ago`
}

export default function VolunteerDashboard({ navigate, socketData }) {
  const { user, getToken, updateUser } = useAuth()
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState({})
  const isDemo = String(user?.id || '').startsWith('DEMO-')

  const loadMissions = useCallback(async () => {
    setError('')
    if (isDemo) {
      const store = getDemoStore()
      const assigned = (store.requests || []).filter((req) => req.assignedVolunteerId === user?.id)
      setMissions(assigned)
      setLoading(false)
      return
    }

    const { data, error: apiError } = await api.getVolunteerMissions(getToken())

    if (apiError) {
      setError('Could not load your assignments. Make sure you are linked to an NGO.')
      setMissions([])
    } else {
      const incoming = Array.isArray(data?.missions) ? data.missions : []
      setMissions(incoming)
    }
    setLoading(false)
  }, [getToken, isDemo, user?.id])

  useEffect(() => {
    loadMissions()
    const interval = setInterval(loadMissions, 20000)
    return () => clearInterval(interval)
  }, [loadMissions])

  async function handleFulfill(missionId) {
    setActionLoading((prev) => ({ ...prev, [missionId]: true }))
    if (isDemo) {
      const pointsAwarded = Math.floor(100 + Math.random() * 101)
      const nextStore = updateDemoRequests((current) =>
        current.map((req) =>
          (req.id === missionId || req._id === missionId)
            ? { ...req, status: 'fulfilled', fulfilledAt: new Date().toISOString() }
            : req,
        ),
      )
      const assigned = (nextStore.requests || []).filter((req) => req.assignedVolunteerId === user?.id)
      setMissions(assigned)
      updateUser({
        points: (user?.points || 0) + pointsAwarded,
        deliveries: (user?.deliveries || 0) + 1,
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sahayak_demo_update'))
      }
      setActionLoading((prev) => ({ ...prev, [missionId]: false }))
      return
    }

    const { data, error: err } = await api.fulfillRequest(getToken(), missionId)
    if (err) setError(err)
    else {
      if (data?.pointsAwarded) {
        updateUser({
          points: (user?.points || 0) + Number(data.pointsAwarded || 0),
          deliveries: (user?.deliveries || 0) + 1,
        })
      }
      await loadMissions()
    }
    setActionLoading((prev) => ({ ...prev, [missionId]: false }))
  }

  const activeMissions = missions.filter((m) => m.status !== 'fulfilled' && m.status !== 'cancelled')
  const completedMissions = missions.filter((m) => m.status === 'fulfilled')

  const volunteerName = user ? getShortUserName(user, 12) : 'Volunteer'
  const volunteerArea = user?.area || 'Assigned Area'
  const volunteerPoints = user?.points ?? 0
  const volunteerDeliveries = user?.deliveries ?? 0
  const volunteerBadge = user?.badge || 'starter'

  const badgeLabel = { gold: 'Gold Volunteer', silver: 'Silver Volunteer', bronze: 'Bronze Volunteer', starter: 'Starter' }

  return (
    <section className="bg-background text-on-surface min-h-screen pt-24 pb-10">
      <div className="max-w-screen-2xl mx-auto px-6 xl:px-10 space-y-8">

        {/* Profile Card */}
        <section className="glass-card rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full ring-4 ring-primary-container/40 bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                {(volunteerName || '??').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-3xl font-extrabold font-headline text-on-surface">{volunteerName}</h2>
                <p className="text-slate-500 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  {volunteerArea}
                </p>
              </div>
            </div>

            <div className="bg-secondary-container/20 text-on-secondary-container px-5 py-2.5 rounded-full font-extrabold tracking-tight flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined fill-icon">military_tech</span>
              {badgeLabel[volunteerBadge] || 'Volunteer'}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Points</p>
              <p className="font-mono text-2xl font-bold text-primary">{volunteerPoints}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Deliveries</p>
              <p className="font-mono text-2xl font-bold text-primary">{volunteerDeliveries}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Active</p>
              <p className="font-mono text-2xl font-bold text-primary">{activeMissions.length}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl border border-primary-container/40">
              <p className="text-[10px] font-bold uppercase text-primary tracking-widest">Completed</p>
              <p className="font-mono text-2xl font-bold text-primary">{completedMissions.length}</p>
            </div>
          </div>
        </section>

        {/* Error */}
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 px-5 py-3 text-sm font-semibold">
            {error}
          </div>
        ) : null}

        {/* Active Missions */}
        <div className="flex flex-col lg:flex-row gap-8">
          <section className="lg:w-[65%] space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary p-2 bg-primary/10 rounded-lg">near_me</span>
                <h3 className="text-2xl font-extrabold font-headline">My Missions</h3>
              </div>
              <button onClick={() => navigate('map')} className="text-sm font-bold text-primary hover:underline">
                View Map
              </button>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
                <div className="mx-auto h-10 w-10 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
                <p className="mt-3 text-sm text-on-surface-variant">Loading missions...</p>
              </div>
            ) : activeMissions.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3">
                <span className="material-symbols-outlined text-5xl text-slate-300">assignment</span>
                <h4 className="text-lg font-bold text-slate-600">No missions assigned</h4>
                <p className="text-sm text-slate-500">Your NGO will assign missions to you when help is needed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeMissions.map((mission) => {
                  const urgency = urgencyConfig(mission.urgencyLevel || mission.urgency)
                  const mId = mission._id || mission.id
                  return (
                    <article
                      key={mId}
                      className={`bg-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden hover-lift ${urgency.card}`}
                    >
                      <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-3xl">{iconForType(mission.selectedNeed || mission.type)}</span>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xl font-bold font-headline">
                            {labelForType(mission.selectedNeed || mission.type)} — {mission.area || 'Unknown'}
                          </h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${urgency.badge}`}>
                            {urgency.tone}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600">{mission.description || mission.notes || ''}</p>

                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">schedule</span>
                          {formatTime(mission.createdAt)}
                        </p>

                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">groups</span>{mission.people || 1} people
                          </span>
                          {mission.assignedNgoName ? (
                            <span className="flex items-center gap-1 text-blue-600 font-semibold">
                              <span className="material-symbols-outlined text-sm">business</span>{mission.assignedNgoName}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleFulfill(mId)}
                            disabled={actionLoading[mId]}
                            className="active-scale flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                          >
                            {actionLoading[mId] ? 'Completing...' : '✓ Mark as Fulfilled'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Sidebar: Completed */}
          <section className="lg:w-[35%] space-y-6">
            <div className="bg-surface-container-low rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-500">task_alt</span>
                <h3 className="text-xl font-extrabold font-headline">Completed Missions</h3>
              </div>

              {completedMissions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No completed missions yet.</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {completedMissions.slice(0, 10).map((m) => (
                    <article key={m._id || m.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{labelForType(m.selectedNeed || m.type)}</p>
                        <p className="text-[10px] text-slate-500">{m.area || 'Unknown'}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="bg-surface-container-low rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold font-headline">My Badges</h3>
                <span className="material-symbols-outlined text-secondary fill-icon">stars</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className={`flex items-center justify-center p-4 rounded-2xl border ${volunteerBadge === 'gold' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`material-symbols-outlined text-3xl fill-icon ${volunteerBadge === 'gold' ? 'text-amber-500' : 'text-slate-300'}`}>workspace_premium</span>
                </div>
                <div className={`flex items-center justify-center p-4 rounded-2xl border ${['gold', 'silver'].includes(volunteerBadge) ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`material-symbols-outlined text-3xl fill-icon ${['gold', 'silver'].includes(volunteerBadge) ? 'text-slate-400' : 'text-slate-200'}`}>military_tech</span>
                </div>
                <div className="flex items-center justify-center p-4 bg-white rounded-2xl border border-primary/20">
                  <span className="material-symbols-outlined text-primary text-3xl fill-icon">emergency_share</span>
                </div>
              </div>
            </div>
          </section>
        </div>

      </div>
    </section>
  )
}
