import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, Marker, Popup, CircleMarker, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { api } from '../services/api.js'

const DEFAULT_CENTER = { lat: 27.1767, lng: 78.0081 }
const ZONE_PALETTE = [
  'red',
  'blue',
  'green',
  'orange',
  'purple',
  'yellow',
  'pink',
  'cyan',
  'brown',
  'gray',
  'lime',
  'teal',
  'indigo',
  'gold',
  'black',
]
const DART_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="50" viewBox="0 0 36 50" fill="none">
  <path d="M18 0C8.6 0 1 7.6 1 17c0 11.3 14.8 32.2 16.3 34.3.4.6 1 .7 1.4 0C20.2 49.2 35 28.3 35 17 35 7.6 27.4 0 18 0z" fill="#1d4ed8"/>
  <circle cx="18" cy="17" r="7" fill="#93c5fd"/>
  <circle cx="18" cy="17" r="4" fill="#0ea5e9"/>
</svg>`
const DART_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DART_ICON_SVG)}`
const DART_ICON = L.icon({
  iconUrl: DART_ICON_URL,
  iconSize: [32, 46],
  iconAnchor: [16, 46],
  popupAnchor: [0, -36],
})

function parseZoneIndex(zone) {
  const match = String(zone || '').match(/zone\s*(\d+)/i)
  if (!match) return null
  const index = Number(match[1])
  return Number.isFinite(index) ? index : null
}

function getZoneColor(zone) {
  const index = parseZoneIndex(zone)
  if (!index || index < 1 || index > ZONE_PALETTE.length) return '#ef4444'
  return ZONE_PALETTE[index - 1]
}

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function HeatmapLayer({ points }) {
  const map = useMap()

  useEffect(() => {
    const heatPoints = points.map((point) => [point.lat, point.lng, point.intensity])
    const heat = L.heatLayer(heatPoints, {
      radius: 28,
      blur: 20,
      minOpacity: 0.35,
      gradient: {
        0.2: '#60a5fa',
        0.45: '#34d399',
        0.65: '#fbbf24',
        0.85: '#f97316',
        1.0: '#ef4444',
      },
    })
    heat.addTo(map)
    return () => map.removeLayer(heat)
  }, [points, map])

  return null
}

function UserLocationMarker({ onLocate, onError }) {
  const map = useMap()
  const [position, setPosition] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!navigator.geolocation) {
      onError?.('Geolocation is not supported in this browser.')
      return undefined
    }

    let active = true
    navigator.geolocation.getCurrentPosition(
      (location) => {
        if (!active) return
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        }
        setPosition(coords)
        onLocate?.(coords)
        map.setView([coords.lat, coords.lng], 15, { animate: true })
      },
      (error) => {
        if (!active) return
        onError?.(error.message || 'Unable to access your location.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )

    return () => {
      active = false
    }
  }, [map, onLocate, onError])

  if (!position) return null

  return (
    <Marker position={[position.lat, position.lng]}>
      <Popup>You are here</Popup>
    </Marker>
  )
}

function LiveLocationMarkers({ locations }) {
  if (!locations.length) return null

  return (
    <>
      {locations.map((loc) => (
        <CircleMarker
          key={loc.id}
          center={[loc.lat, loc.lng]}
          radius={8}
          pathOptions={{ color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 0.8 }}
        >
          <Popup>{loc.label || 'Live user location'}</Popup>
        </CircleMarker>
      ))}
    </>
  )
}

function ZoneMarkerLayer({ zone, centerOverride, focusOnZone = true }) {
  const map = useMap()
  const center = useMemo(() => {
    if (centerOverride?.lat && centerOverride?.lng) {
      return { lat: Number(centerOverride.lat), lng: Number(centerOverride.lng) }
    }
    return null
  }, [centerOverride])

  useEffect(() => {
    if (!center || !focusOnZone) return undefined
    const currentZoom = map.getZoom()
    const nextZoom = Math.max(currentZoom, 9)
    map.setView([center.lat, center.lng], nextZoom, { animate: true })
  }, [center, focusOnZone, map])

  if (!center) return null

  const color = getZoneColor(zone)
  return (
    <>
      <Circle
        center={[center.lat, center.lng]}
        radius={60000}
        pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 2, dashArray: '6 10' }}
      />
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={6}
        pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 1 }}
      />
    </>
  )
}

function PreviewMarker({ point }) {
  const map = useMap()

  useEffect(() => {
    if (!point) return
    map.setView([point.lat, point.lng], 12, { animate: true })
  }, [point, map])

  if (!point) return null

  return (
    <Marker position={[point.lat, point.lng]} icon={DART_ICON}>
      <Popup>{point.label || 'Selected location'}</Popup>
    </Marker>
  )
}

function LeafletMap({ points, liveLocations, onLocate, onGeoError, previewZone, previewPoint }) {
  const center = useMemo(() => getMapCenter(points), [points])
  const featuredPoint = useMemo(
    () => points.find((point) => Number(point.lat) && Number(point.lng)),
    [points],
  )
  const preview = useMemo(() => {
    if (!previewPoint?.lat || !previewPoint?.lng) return null
    return {
      lat: Number(previewPoint.lat),
      lng: Number(previewPoint.lng),
      label: previewPoint.label || 'Selected location',
    }
  }, [previewPoint])

  const hasPreview = Boolean(preview)

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={10} className="h-full w-full">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {!preview && featuredPoint ? (
        <Marker position={[featuredPoint.lat, featuredPoint.lng]}>
          <Popup>{featuredPoint.label || 'Live event location'}</Popup>
        </Marker>
      ) : null}
      <PreviewMarker point={preview} />
      <UserLocationMarker onLocate={onLocate} onError={onGeoError} />
      <LiveLocationMarkers locations={liveLocations} />
      <ZoneMarkerLayer zone={previewZone} centerOverride={preview} focusOnZone={!hasPreview} />
      {points.length > 0 ? <HeatmapLayer points={points} /> : null}
    </MapContainer>
  )
}

function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined' || !apiKey) {
    return Promise.reject(new Error('Missing Google Maps API key'))
  }

  if (window.google?.maps?.visualization) {
    return Promise.resolve()
  }

  if (window.__googleMapsLoading) {
    return window.__googleMapsLoading
  }

  window.__googleMapsLoading = new Promise((resolve, reject) => {
    const scriptId = 'google-maps-js'
    const existing = document.getElementById(scriptId)
    if (existing) {
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')))
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(script)
  })

  return window.__googleMapsLoading
}

function getMapCenter(points) {
  if (!points.length) return DEFAULT_CENTER
  const totals = points.reduce(
    (acc, point) => ({
      lat: acc.lat + Number(point.lat || 0),
      lng: acc.lng + Number(point.lng || 0),
      count: acc.count + 1,
    }),
    { lat: 0, lng: 0, count: 0 },
  )
  if (!totals.count) return DEFAULT_CENTER
  return { lat: totals.lat / totals.count, lng: totals.lng / totals.count }
}

function GoogleHeatmap({ points, ready }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const heatmapRef = useRef(null)
  const center = useMemo(() => getMapCenter(points), [points])

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 10,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        clickableIcons: false,
      })
    } else {
      mapInstanceRef.current.setCenter(center)
    }
  }, [ready, center])

  useEffect(() => {
    if (!ready || !mapInstanceRef.current || !window.google?.maps?.visualization) return

    if (heatmapRef.current) {
      heatmapRef.current.setMap(null)
    }

    if (!points.length) return

    const data = points.map((point) => ({
      location: new window.google.maps.LatLng(point.lat, point.lng),
      weight: Math.max(0.1, Number(point.intensity) || 0.3),
    }))

    heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
      data,
      radius: 30,
      opacity: 0.65,
    })
    heatmapRef.current.setMap(mapInstanceRef.current)

    return () => {
      heatmapRef.current?.setMap(null)
    }
  }, [ready, points])

  return <div ref={mapRef} className="h-full w-full" />
}

function LiveBadge({ value }) {
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-tertiary/10 text-tertiary rounded-full text-[10px] font-bold tracking-widest uppercase">
      <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
      {value}
    </span>
  )
}

export default function MapView({ socketData, previewPoint, previewZone }) {
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const [fallbackPoints, setFallbackPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [googleReady, setGoogleReady] = useState(false)
  const [mapProvider, setMapProvider] = useState('osm')
  const [mapsError, setMapsError] = useState('')
  const [geoError, setGeoError] = useState('')
  const [userLocation, setUserLocation] = useState(null)
  const lastEmitRef = useRef(0)
  const usingGoogle = mapProvider === 'google'

  const handleLocate = useCallback((coords) => {
    setUserLocation(coords)
    setGeoError('')
  }, [])

  const handleGeoError = useCallback((message) => {
    setGeoError(message)
  }, [])

  useEffect(() => {
    let active = true

    api
      .getHeatmap()
      .then(({ data }) => {
        if (active && data) setFallbackPoints(data)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!googleKey) {
      setMapsError('Google Maps API key missing. Using OpenStreetMap.')
      setGoogleReady(false)
      if (mapProvider === 'google') setMapProvider('osm')
      return undefined
    }

    if (mapProvider !== 'google') {
      setGoogleReady(false)
      setMapsError('')
      return undefined
    }

    loadGoogleMaps(googleKey)
      .then(() => {
        if (!active) return
        setGoogleReady(true)
        setMapsError('')
      })
      .catch((error) => {
        if (!active) return
        setMapsError(error.message || 'Google Maps failed to load. Using OpenStreetMap.')
        setGoogleReady(false)
        setMapProvider('osm')
      })

    return () => {
      active = false
    }
  }, [googleKey, mapProvider])

  const points = socketData?.heatmapPoints?.length ? socketData.heatmapPoints : fallbackPoints
  const liveLocations = socketData?.liveLocations || []
  const localHeat = useMemo(() => {
    if (!userLocation || socketData?.connected) return []
    return [
      {
        lat: userLocation.lat,
        lng: userLocation.lng,
        intensity: 0.25,
        type: 'live',
        label: 'Your location',
      },
    ]
  }, [userLocation, socketData?.connected])

  const combinedPoints = useMemo(() => {
    const preview = previewPoint?.lat && previewPoint?.lng ? [{ ...previewPoint }] : []
    const liveHeat = liveLocations.map((loc) => ({
      lat: loc.lat,
      lng: loc.lng,
      intensity: 0.25,
      type: 'live',
      label: loc.label || 'Live user',
    }))
    return [...preview, ...liveHeat, ...localHeat, ...points]
  }, [liveLocations, points, previewPoint, localHeat])
  const sidePoints = useMemo(() => {
    if (!combinedPoints.length) return []
    return [...combinedPoints]
      .sort((a, b) => (b.intensity || 0) - (a.intensity || 0))
      .slice(0, 8)
  }, [combinedPoints])
  const liveCount = points.length
  const requestsToday = socketData?.stats?.requestsToday || 0

  useEffect(() => {
    if (!socketData?.emit || typeof navigator === 'undefined' || !navigator.geolocation) return undefined

    const sendLocation = (coords) => {
      const now = Date.now()
      if (now - lastEmitRef.current < 5000) return
      lastEmitRef.current = now

      socketData.emit('send-location', {
        lat: coords.latitude,
        lng: coords.longitude,
        role: 'user',
        label: 'Live user',
      })
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => sendLocation(position.coords),
      () => {},
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 10000 },
    )

    return () => {
      if (typeof navigator !== 'undefined' && navigator.geolocation && watchId != null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [socketData])

  return (
    <section className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm min-h-[620px]">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(0,104,95,0.08),transparent),radial-gradient(circle_at_bottom_left,rgba(133,83,0,0.08),transparent)]" />

      <div className="relative z-10 p-4 h-full">
        <div className="h-[580px] rounded-2xl overflow-hidden relative border border-slate-200">
          {usingGoogle ? (
            <GoogleHeatmap points={combinedPoints} ready={googleReady} />
          ) : (
            <LeafletMap
              points={combinedPoints}
              liveLocations={liveLocations}
              onLocate={handleLocate}
              onGeoError={handleGeoError}
              previewZone={previewZone}
              previewPoint={previewPoint}
            />
          )}

          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/70 space-y-2">
            <div className="flex items-center justify-between gap-6">
              <p className="text-xs uppercase tracking-widest font-extrabold text-slate-500">Active Snapshot</p>
              <LiveBadge value="LIVE" />
            </div>
            <p className="text-sm text-on-surface">
              <span className="font-bold font-mono text-primary">{liveCount}</span> heat points
            </p>
            <p className="text-sm text-on-surface">
              <span className="font-bold font-mono text-primary">{requestsToday}</span> requests today
            </p>
          </div>

          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/70 space-y-2 min-w-[190px]">
            <p className="text-xs uppercase tracking-widest font-extrabold text-slate-500">Layer Mode</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">
                Heatmap
              </button>
              <button type="button" className="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                NGOs
              </button>
            </div>
            {loading ? <p className="text-xs text-slate-500">Refreshing map feed...</p> : null}
            <p className="text-xs uppercase tracking-widest font-extrabold text-slate-500 pt-2">Map Provider</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMapProvider('osm')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  mapProvider === 'osm' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                }`}
                aria-pressed={mapProvider === 'osm'}
              >
                OSM
              </button>
              <button
                type="button"
                onClick={() => setMapProvider('google')}
                disabled={!googleKey}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  mapProvider === 'google'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600'
                } ${!googleKey ? 'opacity-60 cursor-not-allowed' : ''}`}
                aria-pressed={mapProvider === 'google'}
              >
                Google
              </button>
            </div>
            {usingGoogle && !googleReady ? (
              <p className="text-xs text-slate-500">Loading Google Maps...</p>
            ) : null}
            {mapsError ? <p className="text-xs text-amber-600 font-semibold">{mapsError}</p> : null}
            {geoError ? <p className="text-xs text-amber-600 font-semibold">{geoError}</p> : null}
            {userLocation ? (
              <p className="text-[10px] text-slate-500">
                You: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </p>
            ) : null}
          </div>

          <div className="absolute right-4 top-[210px] bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/70 w-[220px] max-h-[320px] overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs uppercase tracking-widest font-extrabold text-slate-500">Live Heat Points</p>
              <LiveBadge value="LIVE" />
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {sidePoints.length ? (
                sidePoints.map((point, index) => (
                  <div key={`${point.lat}-${point.lng}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-bold text-on-surface">
                      {point.label || point.type || `Point ${index + 1}`}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {Number(point.lat).toFixed(3)}, {Number(point.lng).toFixed(3)}
                    </p>
                    <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(10, (point.intensity || 0.2) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">Waiting for live points...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
