import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getDemoStore } from '../services/demoStore.js'

const EMPTY_DATA = {
  stats: { requestsToday: 0, pendingCount: 0, criticalCount: 0, avgResponseMin: 0, ngosActive: 0 },
  byType: {},
  byStatus: {},
  topAreas: [],
  ngoPerformance: [],
}

let chartPromise = null

async function loadChart() {
  if (!chartPromise) {
    chartPromise = import('chart.js')
      .then(({ Chart, registerables }) => {
        Chart.register(...registerables)
        Chart.defaults.color = '#475569'
        Chart.defaults.borderColor = 'rgba(148,163,184,0.25)'
        return Chart
      })
      .catch(() => null)
  }
  return chartPromise
}

function useChart(canvasRef, config) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !config) return undefined
    let cancelled = false

    loadChart().then((Chart) => {
      if (!Chart || cancelled || !canvasRef.current) return
      if (chartRef.current) chartRef.current.destroy()
      chartRef.current = new Chart(canvasRef.current, config)
    })

    return () => {
      cancelled = true
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [canvasRef, config])
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
      <h3 className="font-headline text-lg font-extrabold text-on-surface">{title}</h3>
      {subtitle ? <p className="text-sm text-slate-500 mt-1 mb-4">{subtitle}</p> : null}
      {children}
    </section>
  )
}

function buildDemoAnalytics(store) {
  const requests = store?.requests || []
  const byType = {}
  const byUrgency = {}
  const byStatus = {}
  const byArea = {}
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let todayCount = 0
  let todayFulfilled = 0
  let totalFulfilled = 0

  requests.forEach((r) => {
    const type = String(r.type || r.selectedNeed || r.aiCategory || 'other').toUpperCase()
    const urgency = String(r.urgency || r.urgencyLevel || 'medium').toUpperCase()
    const status = String(r.status || 'pending').toUpperCase()
    const area = r.area || 'Unknown'
    const createdAt = r.createdAt ? new Date(r.createdAt) : null

    byType[type] = (byType[type] || 0) + 1
    byUrgency[urgency] = (byUrgency[urgency] || 0) + 1
    byStatus[status] = (byStatus[status] || 0) + 1
    byArea[area] = (byArea[area] || 0) + 1

    if (createdAt && createdAt >= todayStart) {
      todayCount += 1
      if (status === 'FULFILLED') todayFulfilled += 1
    }
    if (status === 'FULFILLED') totalFulfilled += 1
  })

  const topAreas = Object.entries(byArea)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([area, count]) => ({ area, count }))

  const ngoPerformanceMap = new Map()
  requests.forEach((r) => {
    const ngoName = r.assignedNgoName || r.matchedNgo || null
    if (!ngoName) return
    const status = String(r.status || 'pending').toUpperCase()
    const entry = ngoPerformanceMap.get(ngoName) || {
      name: ngoName,
      fulfilled: 0,
      matched: 0,
      capacity: 10,
      rating: 4.5,
    }
    entry.matched += 1
    if (status === 'FULFILLED') entry.fulfilled += 1
    ngoPerformanceMap.set(ngoName, entry)
  })

  const ngoPerformance = Array.from(ngoPerformanceMap.values()).sort((a, b) => b.fulfilled - a.fulfilled)
  const pendingCount = byStatus.PENDING || 0
  const criticalCount = requests.filter(
    (r) => String(r.urgency || r.urgencyLevel || '').toLowerCase() === 'critical' && String(r.status || '').toLowerCase() === 'pending',
  ).length
  const totalRequests = requests.length

  return {
    byType,
    byUrgency,
    byStatus,
    topAreas,
    ngoPerformance,
    stats: {
      requestsToday: todayCount,
      fulfilledToday: todayFulfilled,
      pendingCount,
      criticalCount,
      totalFulfilled,
      avgResponseMin: 23,
      totalRequests,
      ngosActive: ngoPerformance.length || 1,
    },
  }
}

export default function Analytics({ socketData }) {
  const { user, getToken } = useAuth()
  const demoUserId = String(user?.id || '').toUpperCase()
  const isDemoUser = demoUserId.startsWith('DEMO-')
  const demoToken = typeof getToken === 'function' ? getToken() : null
  const isDemoToken = typeof demoToken === 'string' && demoToken.startsWith('demo-')
  const isDemo = isDemoUser || isDemoToken
  const [data, setData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const donutRef = useRef(null)
  const responseRef = useRef(null)
  const typeRef = useRef(null)
  const refreshTimerRef = useRef(null)

  const refreshAnalytics = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setSyncing(true)
      }
      if (isDemo) {
        const store = getDemoStore()
        setData(buildDemoAnalytics(store))
        setError('')
        if (!silent) setSyncing(false)
        return
      }

      const { data: next, error: err } = await api.getAnalytics()
      if (next) {
        setData(next)
        setError('')
      }
      if (err) {
        setError('Unable to load analytics data.')
      }
      if (!silent) {
        setSyncing(false)
      }
    },
    [isDemo],
  )

  useEffect(() => {
    let active = true
    if (isDemo) {
      const store = getDemoStore()
      if (active) {
        setData(buildDemoAnalytics(store))
        setLoading(false)
      }
      return () => {
        active = false
      }
    }

    api.getAnalytics()
      .then(({ data: next, error: err }) => {
        if (!active) return
        if (next) setData(next)
        if (err) setError('Unable to load analytics data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [isDemo])

  useEffect(() => {
    if (isDemo) return undefined
    const total = socketData?.stats?.totalRequests ?? socketData?.stats?.requestsToday ?? null
    const fulfilled = socketData?.stats?.totalFulfilled ?? null
    const pending = socketData?.stats?.pendingCount ?? null

    if (total == null && fulfilled == null && pending == null) {
      return undefined
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshAnalytics({ silent: false })
    }, 500)

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [isDemo, socketData?.stats?.totalRequests, socketData?.stats?.requestsToday, socketData?.stats?.totalFulfilled, socketData?.stats?.pendingCount, refreshAnalytics])

  useEffect(() => {
    if (isDemo) return undefined
    const interval = setInterval(() => {
      refreshAnalytics({ silent: true })
    }, 30000)
    return () => clearInterval(interval)
  }, [isDemo, refreshAnalytics])

  useEffect(() => {
    if (!isDemo) return undefined
    const refreshDemo = () => refreshAnalytics({ silent: true })
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
  }, [isDemo, refreshAnalytics])

  const fulfilled = data.byStatus?.FULFILLED || 0
  const total = Object.values(data.byStatus || {}).reduce((sum, value) => sum + value, 0) || 1
  const rate = Math.round((fulfilled / total) * 100)

  useChart(donutRef, {
    type: 'doughnut',
    data: {
      labels: ['Fulfilled', 'In Progress', 'Pending', 'Matched'],
      datasets: [
        {
          data: [
            data.byStatus?.FULFILLED || 0,
            data.byStatus?.IN_PROGRESS || 0,
            data.byStatus?.PENDING || 0,
            data.byStatus?.MATCHED || 0,
          ],
          backgroundColor: ['#16A34A', '#7C3AED', '#F59E0B', '#0D9488'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#475569', padding: 14 },
        },
      },
    },
  })

  useChart(responseRef, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
      datasets: [
        {
          data: [31, 28, 24, 22, 19, 25, data.stats?.avgResponseMin || 23],
          backgroundColor: 'rgba(13,148,136,0.78)',
          hoverBackgroundColor: '#0D9488',
          borderRadius: 8,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#475569' } },
        y: { grid: { color: 'rgba(148,163,184,0.22)' }, ticks: { color: '#475569' } },
      },
    },
  })

  useChart(typeRef, {
    type: 'doughnut',
    data: {
      labels: Object.keys(data.byType || {}),
      datasets: [
        {
          data: Object.values(data.byType || {}),
          backgroundColor: ['#F59E0B', '#DC2626', '#0D9488', '#7C3AED', '#22C55E', '#64748B'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#475569', padding: 12 },
        },
      },
    },
  })

  return (
    <section className="bg-background min-h-screen pt-24 pb-8 text-on-background">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
        <header className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-5 flex flex-wrap justify-between items-center gap-4 shadow-sm">
          <div>
            <p className="text-primary text-xs tracking-[0.22em] font-extrabold uppercase">Impact Analytics</p>
            <h1 className="text-3xl font-headline font-extrabold">Relief Performance Pulse</h1>
          </div>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest ${
              loading || syncing ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${loading || syncing ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {loading ? 'Loading Data' : syncing ? 'Syncing' : 'Live Data'}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <article className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Requests Today</p>
            <p className="font-headline text-3xl font-extrabold text-primary">{data.stats?.requestsToday || 0}</p>
          </article>
          <article className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Fulfillment</p>
            <p className="font-headline text-3xl font-extrabold text-emerald-600">{rate}%</p>
          </article>
          <article className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Avg Response</p>
            <p className="font-headline text-3xl font-extrabold text-amber-600">{data.stats?.avgResponseMin || 0}m</p>
          </article>
          <article className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Critical Pending</p>
            <p className="font-headline text-3xl font-extrabold text-red-600">{data.stats?.criticalCount || 0}</p>
          </article>
          <article className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">NGOs Active</p>
            <p className="font-headline text-3xl font-extrabold text-primary">{data.stats?.ngosActive || 0}</p>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <Panel title="Fulfillment Status" subtitle={`${rate}% of all requests fulfilled`}>
            <canvas ref={donutRef} />
          </Panel>
          <Panel title="Average Response Time" subtitle="Target under 30 minutes">
            <canvas ref={responseRef} />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel title="Top Request Areas" subtitle="By request volume">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="text-left py-2">Area</th>
                  <th className="text-right py-2">Requests</th>
                </tr>
              </thead>
              <tbody>
                {(data.topAreas || []).map((item) => (
                  <tr key={item.area} className="border-b border-slate-100">
                    <td className="py-3">{item.area}</td>
                    <td className="py-3 text-right text-primary font-bold">{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Need Type Breakdown" subtitle="All requests">
            <canvas ref={typeRef} />
          </Panel>
        </div>

        <Panel title="NGO Performance Leaderboard" subtitle="Ranked by fulfilled requests">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500">
                  {['#', 'NGO', 'Fulfilled', 'Matched', 'Capacity', 'Rating'].map((title) => (
                    <th key={title} className="text-left px-2 py-2">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.ngoPerformance || []).map((ngo, index) => (
                  <tr key={ngo.name} className="border-b border-slate-100">
                    <td className="px-2 py-3 text-amber-600 font-extrabold">{index + 1}</td>
                    <td className="px-2 py-3 font-bold">{ngo.name}</td>
                    <td className="px-2 py-3 text-emerald-600 font-bold">{ngo.fulfilled}</td>
                    <td className="px-2 py-3 text-slate-600">{ngo.matched}</td>
                    <td className="px-2 py-3 text-slate-600">{ngo.capacity}</td>
                    <td className="px-2 py-3 text-amber-600 font-bold">? {ngo.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </section>
  )
}

