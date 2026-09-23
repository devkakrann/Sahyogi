import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import MapView from './MapView.jsx'
import { mockNGOs, predictedHotspots } from '../data/mockData.js'

function toneForUrgency(urgency) {
  const value = String(urgency || '').toLowerCase()
  if (value === 'critical') return 'bg-tertiary-container text-on-tertiary-container'
  if (value === 'high' || value === 'urgent') return 'bg-secondary-container text-on-secondary-fixed'
  return 'bg-slate-100 text-slate-600'
}

export default function MapDashboard({ navigate, socketData }) {
  const { user } = useAuth()
  const [dbRequests, setDbRequests] = useState([])
  const [ngoList, setNgoList] = useState([])
  const [viewMode, setViewMode] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [statusDraft, setStatusDraft] = useState('pending')
  const [savingId, setSavingId] = useState(null)
  const [localEdits, setLocalEdits] = useState({})

  useEffect(() => {
    api.getRequests({ limit: 20 }).then(({ data }) => {
      if (data) setDbRequests(data)
    })
  }, [])

  useEffect(() => {
    let mounted = true
    api.getNGOs().then(({ data, error }) => {
      if (!mounted) return
      if (data && data.length) setNgoList(data)
      else if (error) setNgoList(mockNGOs)
    })
    return () => {
      mounted = false
    }
  }, [])

  const liveCount = socketData?.heatmapPoints?.length || 0
  const requestsToday = socketData?.stats?.requestsToday || 0
  const criticalPending = socketData?.stats?.criticalCount || 0
  const requests = socketData?.requests?.length ? socketData.requests : dbRequests
  const role = String(user?.role || '').toLowerCase()
  const isNgo = role === 'ngo'

  const heatmapFallback = useMemo(() => {
    return requests
      .filter((req) => Number(req.lat) && Number(req.lng))
      .map((req) => ({
        lat: Number(req.lat),
        lng: Number(req.lng),
        intensity: Math.min(1, Math.max(0.2, (req.priorityScore || req.aiScore || 35) / 100)),
        label: req.area,
        type: req.type,
      }))
  }, [requests])

  const heatmapFeed = (socketData?.heatmapPoints?.length ? socketData.heatmapPoints : heatmapFallback) || []
  const topHeatmap = [...heatmapFeed].sort((a, b) => (b.intensity || 0) - (a.intensity || 0)).slice(0, 6)

  const tabMeta = {
    heatmap: { title: 'Heatmap Signals', subtitle: 'Live intensity points' },
    ngos: { title: 'Active NGOs', subtitle: 'Nearby responder capacity' },
    predict: { title: 'Predicted Hotspots', subtitle: 'Next 24h risk outlook' },
    all: { title: 'Incoming Requests', subtitle: 'AI-prioritized queue' },
  }
  const mergedRequests = useMemo(
    () =>
      requests.map((request) =>
        localEdits[request.id]
          ? { ...request, ...localEdits[request.id] }
          : request,
      ),
    [requests, localEdits],
  )

  const statusOptions = ['pending', 'matched', 'assigned', 'in_progress', 'fulfilled', 'cancelled']
  const tabItems = [
    { key: 'heatmap', label: 'Heatmap' },
    { key: 'ngos', label: 'NGOs' },
    { key: 'predict', label: 'Predict' },
    { key: 'all', label: 'All' },
  ]

  return (
    <section className="bg-background text-on-background min-h-screen pt-24 pb-8">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
        <header className="bg-white/80 backdrop-blur-xl border border-slate-200 shadow-sm rounded-3xl px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-headline font-extrabold">Live Need Map</h1>
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-tertiary/10 text-tertiary rounded-full text-[10px] font-bold tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">
              {requestsToday} requests today, {liveCount} active heat points, {criticalPending} critical pending.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => navigate('request')} className="btn-primary">
              Submit Emergency Request
            </button>
            <button onClick={() => navigate('ngo')} className="btn-ghost">
              NGO Dashboard
            </button>
            <button onClick={() => navigate('home')} className="btn-ghost">
              Home
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-5 max-h-[820px] overflow-y-auto">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold font-headline text-primary">{tabMeta[viewMode]?.title || 'Incoming Requests'}</h2>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Real-time</span>
              </div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wider">
                {tabMeta[viewMode]?.subtitle || 'AI-prioritized queue'}
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Incoming request views">
              {tabItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === item.key}
                  aria-controls={`incoming-panel-${item.key}`}
                  onClick={() => setViewMode(item.key)}
                  className={`p-3 rounded-xl text-[10px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                    viewMode === item.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white border border-teal-500/10 text-on-surface hover:-translate-y-0.5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {viewMode === 'heatmap' ? (
              <div id="incoming-panel-heatmap" role="tabpanel" className="space-y-3" aria-live="polite">
                {topHeatmap.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center text-sm text-slate-500">
                    No heatmap points yet. Live signals will appear here.
                  </div>
                ) : (
                  topHeatmap.map((point, index) => (
                    <article key={`${point.lat}-${point.lng}-${index}`} className="bg-white rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="font-bold text-sm text-on-surface">{point.label || `Point ${index + 1}`}</p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-400">
                            {point.type || 'general'} · {Number(point.lat).toFixed(3)}, {Number(point.lng).toFixed(3)}
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-primary/10 text-primary">
                          Intensity {Math.round((point.intensity || 0.2) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(100, Math.max(10, (point.intensity || 0.2) * 100))}%` }}
                        />
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {viewMode === 'ngos' ? (
              <div id="incoming-panel-ngos" role="tabpanel" className="space-y-3" aria-live="polite">
                {(ngoList.length ? ngoList : mockNGOs).slice(0, 6).map((ngo) => (
                  <article key={ngo.id || ngo.name} className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="font-bold text-on-surface">{ngo.name}</h3>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400">{ngo.area || 'Local network'}</p>
                      </div>
                      {ngo.verified ? (
                        <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-emerald-100 text-emerald-700">Verified</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 mb-2">
                      {(ngo.focus || []).slice(0, 3).map((focus) => (
                        <span key={focus} className="px-2 py-1 rounded-full bg-slate-100">
                          {focus}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Capacity: {ngo.available ?? ngo.capacity ?? 0} available</p>
                  </article>
                ))}
              </div>
            ) : null}

            {viewMode === 'predict' ? (
              <div id="incoming-panel-predict" role="tabpanel" className="space-y-3" aria-live="polite">
                {predictedHotspots.map((spot) => (
                  <article key={spot.label} className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="font-bold text-on-surface">{spot.label}</h3>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400">
                          {spot.lat.toFixed(3)}, {spot.lng.toFixed(3)}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                        spot.risk === 'very high' ? 'bg-red-100 text-red-700' :
                        spot.risk === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {spot.risk.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Forecast delta: {spot.delta}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {viewMode === 'all' ? (
              <div id="incoming-panel-all" role="tabpanel" className="space-y-3" aria-live="polite">
                {mergedRequests.slice(0, 6).map((request) => {
                  const selected = selectedId === request.id
                  const currentStatus = String(request.status || 'pending').toLowerCase()
                  return (
                  <article
                    key={request.id}
                    onClick={() => {
                      if (!isNgo) return
                      setSelectedId(request.id)
                      setStatusDraft(currentStatus)
                    }}
                    className={`bg-surface-container-lowest p-4 rounded-2xl shadow-sm border transition-all ${
                      isNgo ? 'cursor-pointer hover:border-primary/30 hover:-translate-y-0.5' : 'cursor-default border-transparent'
                    } ${selected ? 'border-primary/40 ring-2 ring-primary/10' : 'border-transparent'}`}
                  >
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div>
                        <h3 className="font-bold text-on-surface">{request.name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {request.submittedAt} - {request.area}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${toneForUrgency(request.urgency)}`}>
                        {request.urgency}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3 leading-relaxed font-medium">{request.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">{request.type === 'medical' ? 'medical_services' : request.type === 'shelter' ? 'home' : 'restaurant'}</span>
                        {request.type}
                      </span>
                      <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">groups</span>
                        {request.people} people
                      </span>
                    </div>
                    {isNgo ? (
                      <div className={`mt-3 rounded-xl border border-primary/10 bg-white/80 p-3 ${selected ? '' : 'opacity-70'}`}>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">NGO Actions</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={selected ? statusDraft : currentStatus}
                            onChange={(event) => setStatusDraft(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600"
                          >
                            {statusOptions.map((option) => (
                              <option key={option} value={option}>
                                {option.replace('_', ' ').toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!selected || savingId === request.id}
                            onClick={async (event) => {
                              event.stopPropagation()
                              if (!selected) return
                              setSavingId(request.id)
                              const { data, error } = await api.updateStatus(request.id, statusDraft)
                              if (!error && data?.request) {
                                setLocalEdits((prev) => ({
                                  ...prev,
                                  [request.id]: { status: data.request.status.toUpperCase() },
                                }))
                              }
                              setSavingId(null)
                            }}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                              selected ? 'bg-primary text-white hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {savingId === request.id ? 'Saving...' : 'Save Status'}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedId(null)
                            }}
                            className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                  )
                })}
              </div>
            ) : null}

            <button onClick={() => navigate('request')} className="w-full py-4 bg-tertiary hover:bg-on-tertiary-fixed-variant text-white font-headline font-extrabold rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98]">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                sos
              </span>
              Submit Emergency Request
            </button>
          </aside>

          <MapView socketData={socketData} />
        </div>
      </div>
    </section>
  )
}

