import { useEffect, useRef, useState } from 'react'
import {
  normalizeHeatmapPoint,
  normalizeRequest,
  normalizeStats,
} from '../services/api.js'

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

let socketInstance = null

async function getSocket() {
  if (socketInstance) return socketInstance

  try {
    const { io } = await import('socket.io-client')
    socketInstance = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 5000,
    })
    return socketInstance
  } catch (error) {
    console.warn('socket.io-client is not available. Live updates are disabled.', error.message)
    return null
  }
}

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const [backendReachable, setBackendReachable] = useState(false)
  const [requests, setRequests] = useState([])
  const [heatmapPoints, setHeatmapPoints] = useState([])
  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [liveLocations, setLiveLocations] = useState([])
  const socketRef = useRef(null)

  useEffect(() => {
    let mounted = true

    function addActivity(text, type = 'info') {
      const activity = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        type,
        time: 'just now',
      }

      setRecentActivity((current) => [activity, ...current].slice(0, 20))
    }

    getSocket().then((socket) => {
      if (!socket || !mounted) return

      socketRef.current = socket
      if (socket.connected) setConnected(true)

      const handleConnect = () => {
        if (mounted) setConnected(true)
      }

      const handleDisconnect = () => {
        if (mounted) setConnected(false)
      }

      const handleInit = (payload) => {
        if (!mounted) return
        setConnected(true)
        setRequests((payload?.requests || []).map(normalizeRequest).filter(Boolean))
        setHeatmapPoints((payload?.heatmap || []).map(normalizeHeatmapPoint))
        setStats(normalizeStats(payload?.stats))
      }

      const handleNewRequest = (request) => {
        if (!mounted) return
        const normalized = normalizeRequest(request)
        if (!normalized) return

        setRequests((current) => {
          const exists = current.some((item) => item.id === normalized.id)
          return exists ? current : [normalized, ...current].slice(0, 100)
        })

        addActivity(
          normalized.status === 'matched'
            ? `${normalized.name}'s ${normalized.type} request matched to ${normalized.matchedNgo}.`
            : `New ${normalized.urgency} ${normalized.type} request from ${normalized.area}.`,
          normalized.urgency === 'critical' ? 'urgent' : 'info',
        )

        // Optimistic heatmap update (in case heatmap_update is delayed)
        const intensityMap = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2 }
        const lat = Number(normalized.lat)
        const lng = Number(normalized.lng)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const point = {
            lat,
            lng,
            intensity: intensityMap[String(normalized.urgency || '').toLowerCase()] || 0.3,
            type: normalized.type,
          }
          setHeatmapPoints((current) => [point, ...current].slice(0, 200))
        }
      }

      const handleRequestUpdated = (request) => {
        if (!mounted) return
        const normalized = normalizeRequest(request)
        if (!normalized) return

        setRequests((current) => current.map((item) => (item.id === normalized.id ? normalized : item)))

        if (normalized.status === 'fulfilled') {
          addActivity(`Request ${normalized.id} was fulfilled for ${normalized.name}.`, 'success')
        }
      }

      const handleHeatmapUpdate = (points) => {
        if (mounted) setHeatmapPoints((points || []).map(normalizeHeatmapPoint))
      }

      const handleStatsUpdate = (nextStats) => {
        if (mounted) setStats(normalizeStats(nextStats))
      }

      const handleNgoUpdated = (ngo) => {
        if (!mounted) return
        const quantity = ngo?.availability?.quantity ?? 0
        addActivity(`${ngo?.ngoName || 'An NGO'} updated resources to ${quantity}.`, 'info')
      }

      const handleReceiveLocation = (payload) => {
        if (!mounted || !payload) return
        const now = Date.now()
        const nextItem = {
          id: payload.id || `${payload.lat}-${payload.lng}`,
          lat: Number(payload.lat),
          lng: Number(payload.lng),
          role: payload.role || 'user',
          label: payload.label || '',
          ts: payload.ts || now,
        }
        if (!Number.isFinite(nextItem.lat) || !Number.isFinite(nextItem.lng)) return

        setLiveLocations((current) => {
          const fresh = current.filter((item) => now - (item.ts || 0) < 120000 && item.id !== nextItem.id)
          return [nextItem, ...fresh].slice(0, 200)
        })
      }

      socket.on('connect', handleConnect)
      socket.on('disconnect', handleDisconnect)
      socket.on('init', handleInit)
      socket.on('new_request', handleNewRequest)
      socket.on('request_updated', handleRequestUpdated)
      socket.on('heatmap_update', handleHeatmapUpdate)
      socket.on('stats_update', handleStatsUpdate)
      socket.on('ngo_updated', handleNgoUpdated)
      socket.on('receive-location', handleReceiveLocation)

      // Ensure we always have the latest init payload (helps after HMR)
      socket.emit('init_request')
    })

    return () => {
      mounted = false

      if (socketRef.current) {
        socketRef.current.off('connect')
        socketRef.current.off('disconnect')
        socketRef.current.off('init')
        socketRef.current.off('new_request')
        socketRef.current.off('request_updated')
        socketRef.current.off('heatmap_update')
        socketRef.current.off('stats_update')
        socketRef.current.off('ngo_updated')
        socketRef.current.off('receive-location')
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    let timer = null

    async function pingBackend() {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2500)
        const response = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal })
        clearTimeout(timeout)
        if (!active) return
        if (response.ok) {
          setBackendReachable(true)
          return
        }
      } catch {
        // ignore
      }
      if (active) {
        setBackendReachable(false)
        timer = setTimeout(pingBackend, 8000)
      }
    }

    pingBackend()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  function emit(event, data) {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    }
  }

  return {
    connected: connected || backendReachable,
    requests,
    heatmapPoints,
    stats,
    recentActivity,
    liveLocations,
    emit,
  }
}
