import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const STATUS_STEPS = [
  { key: 'pending', label: 'Submitted', icon: 'upload', color: 'text-amber-500' },
  { key: 'matched', label: 'NGO Matched', icon: 'handshake', color: 'text-blue-500' },
  { key: 'assigned', label: 'Volunteer Assigned', icon: 'person_pin', color: 'text-indigo-500' },
  { key: 'in_progress', label: 'In Progress', icon: 'local_shipping', color: 'text-purple-500' },
  { key: 'fulfilled', label: 'Fulfilled', icon: 'check_circle', color: 'text-emerald-500' },
]

function statusIndex(status) {
  const s = String(status || '').toLowerCase().replace(/ /g, '_')
  const idx = STATUS_STEPS.findIndex((step) => step.key === s)
  return idx >= 0 ? idx : 0
}

function urgencyBadge(urgency) {
  const u = String(urgency || '').toLowerCase()
  if (u === 'critical') return 'bg-red-100 text-red-700 border-red-200'
  if (u === 'high' || u === 'urgent') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (u === 'medium') return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function needIcon(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'food') return 'restaurant'
  if (t === 'medical') return 'medical_services'
  if (t === 'shelter') return 'home'
  if (t === 'water') return 'water_drop'
  if (t === 'rescue') return 'handshake'
  if (t === 'education') return 'school'
  return 'volunteer_activism'
}

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function UserDashboard({ navigate }) {
  const { user, getToken } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const { data, error: apiError } = await api.getMyRequests(getToken())
      if (cancelled) return

      if (apiError) {
        setError('Could not load your requests. Please try again.')
        setRequests([])
      } else {
        setRequests(data?.requests || [])
      }
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 30000) // Refresh every 30s

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [getToken])

  const activeRequests = requests.filter((r) => r.status !== 'fulfilled' && r.status !== 'cancelled')
  const historyRequests = requests.filter((r) => r.status === 'fulfilled' || r.status === 'cancelled')

  return (
    <section className="bg-background text-on-surface min-h-screen pt-24 pb-10">
      <div className="max-w-screen-xl mx-auto px-6 space-y-8">

        {/* Header */}
        <header className="glass-card rounded-3xl p-6 md:p-8 border border-white/30 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-primary text-xs tracking-[0.22em] font-extrabold uppercase">My Dashboard</p>
              <h1 className="text-3xl font-headline font-extrabold text-on-surface">
                Welcome, {user?.fullName || user?.name || 'User'}
              </h1>
              <p className="text-on-surface-variant mt-1">Track your help requests in real-time.</p>
            </div>
            <button
              onClick={() => navigate('request')}
              className="btn-primary flex items-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sos</span>
              Request Help
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Active</p>
              <p className="font-mono text-2xl font-bold text-primary">{activeRequests.length}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Fulfilled</p>
              <p className="font-mono text-2xl font-bold text-emerald-600">{historyRequests.filter((r) => r.status === 'fulfilled').length}</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Total</p>
              <p className="font-mono text-2xl font-bold text-slate-700">{requests.length}</p>
            </div>
          </div>
        </header>

        {/* Error */}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-5 py-3 text-sm font-semibold">{error}</div>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto h-10 w-10 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
            <p className="mt-3 text-sm text-on-surface-variant">Loading your requests...</p>
          </div>
        ) : null}

        {/* Active Requests */}
        {!loading && activeRequests.length > 0 ? (
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary p-2 bg-primary/10 rounded-lg">track_changes</span>
              <h2 className="text-2xl font-extrabold font-headline">Active Requests</h2>
            </div>

            <div className="space-y-4">
              {activeRequests.map((req) => {
                const currentStep = statusIndex(req.status)
                return (
                  <article key={req.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover-lift">
                    <div className="flex flex-col md:flex-row md:items-start gap-5">
                      {/* Icon */}
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-3xl">{needIcon(req.type)}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold font-headline">{String(req.type || '').charAt(0).toUpperCase() + String(req.type || '').slice(1)} Support</h3>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${urgencyBadge(req.urgency)}`}>
                            {String(req.urgency || 'medium').toUpperCase()}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600">{req.description || req.notes || ''}</p>

                        {/* Status Timeline */}
                        <div className="flex items-center gap-1 overflow-x-auto py-2">
                          {STATUS_STEPS.map((step, i) => {
                            const isComplete = i <= currentStep
                            const isCurrent = i === currentStep
                            return (
                              <div key={step.key} className="flex items-center gap-1">
                                <div className={`flex flex-col items-center gap-1 min-w-[72px] ${isCurrent ? 'scale-110' : ''}`}>
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                                    isComplete
                                      ? isCurrent ? 'bg-primary text-white ring-4 ring-primary/20 shadow-lg' : 'bg-primary/80 text-white'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isComplete ? "'FILL' 1" : "'FILL' 0" }}>
                                      {isComplete && !isCurrent ? 'check' : step.icon}
                                    </span>
                                  </div>
                                  <span className={`text-[9px] font-bold text-center leading-tight ${
                                    isComplete ? 'text-primary' : 'text-slate-400'
                                  }`}>
                                    {step.label}
                                  </span>
                                </div>
                                {i < STATUS_STEPS.length - 1 ? (
                                  <div className={`h-0.5 w-6 rounded-full mt-[-16px] ${isComplete ? 'bg-primary' : 'bg-slate-200'}`} />
                                ) : null}
                              </div>
                            )
                          })}
                        </div>

                        {/* Assignment info */}
                        <div className="flex flex-wrap gap-3 text-sm">
                          {req.matchedNgo || req.assignedNgoName ? (
                            <span className="flex items-center gap-1 text-blue-600 font-semibold">
                              <span className="material-symbols-outlined text-sm">business</span>
                              {req.matchedNgo || req.assignedNgoName}
                            </span>
                          ) : null}
                          {req.assignedVolunteer || req.assignedVolunteerName ? (
                            <span className="flex items-center gap-1 text-indigo-600 font-semibold">
                              <span className="material-symbols-outlined text-sm">person</span>
                              {req.assignedVolunteer || req.assignedVolunteerName}
                            </span>
                          ) : null}
                          <span className="flex items-center gap-1 text-slate-500">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            {req.submittedAt || formatTime(req.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Empty state */}
        {!loading && requests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
            <span className="material-symbols-outlined text-6xl text-slate-300" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
            <h3 className="text-xl font-bold text-slate-600">No requests yet</h3>
            <p className="text-slate-500 max-w-md mx-auto">Submit a help request and track its status here in real-time.</p>
            <button onClick={() => navigate('request')} className="btn-primary mt-4">
              Submit Your First Request
            </button>
          </div>
        ) : null}

        {/* History */}
        {!loading && historyRequests.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-500 p-2 bg-slate-100 rounded-lg">history</span>
              <h2 className="text-xl font-extrabold font-headline text-slate-700">Request History</h2>
            </div>

            <div className="space-y-3">
              {historyRequests.map((req) => (
                <article key={req.id} className="bg-white/70 rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {req.status === 'fulfilled' ? 'check_circle' : 'cancel'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{String(req.type || '').charAt(0).toUpperCase() + String(req.type || '').slice(1)} — {req.area || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{formatTime(req.fulfilledAt || req.createdAt)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${req.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {String(req.status || '').toUpperCase()}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

      </div>
    </section>
  )
}
