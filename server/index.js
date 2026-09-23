import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import cors from 'cors'
import { connectMongo, isMongoReady } from './db/mongoose.js'
import authJwtRoutes from './routes/authJwtRoutes.js'
import helpRoutes from './routes/helpRoutes.js'
import HelpRequest from './models/HelpRequest.js'
import NGOProfile from './models/NGOProfile.js'
import User from './models/User.js'
import { classifyUrgency } from './services/triageService.js'
import { geocodeArea, reverseGeocode } from './services/geocode.js'
import { extractPincode, getPincodeCoords } from './services/pincodeLookup.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', 'client', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const app = express()
const httpServer = createServer(app)

const allowedOrigins = [process.env.CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean)
const isDev = process.env.NODE_ENV !== 'production'
const corsOrigin = isDev ? '*' : allowedOrigins

const io = new SocketIO(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
})

const PORT = Number(process.env.PORT) || 3001
const twilioConfigured = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID,
)

app.use(
  cors({
    origin: corsOrigin,
  }),
)
app.use(express.json())

// Make Socket.IO available inside route handlers
app.set('io', io)

// ── Routes ───────────────────────────────────────────────────
// Consolidated JWT auth (signup, login, verify-otp, me, logout, ngo/volunteers)
app.use('/api/auth/jwt', authJwtRoutes)

// Also mount auth routes at /api/auth for backward compatibility
app.use('/api/auth', authJwtRoutes)

// Help requests (submit, my-requests, ngo-board, claim, assign, fulfill, analytics, heatmap, stats)
app.use('/api/help', helpRoutes)

// Connect to MongoDB
connectMongo()

// ── Rate limiting ────────────────────────────────────────────
const rateMap = new Map()
function rateLimit(phone, maxPerMinute = 10) {
  const bucket = `${phone}_${Math.floor(Date.now() / 60000)}`
  const count = (rateMap.get(bucket) || 0) + 1
  rateMap.set(bucket, count)
  return count > maxPerMinute
}

// ── Local AI triage ──────────────────────────────────────────
function localTriage(text, selectedNeed = 'other') {
  const triage = classifyUrgency(selectedNeed, text)
  const responseTimes = { critical: '< 2 hours', high: '2-6 hours', medium: '6-24 hours', low: '12-48 hours' }

  return {
    urgency: triage.urgencyLevel.toUpperCase(),
    category: (triage.aiCategory || selectedNeed).toUpperCase(),
    summary: `${(triage.aiCategory || selectedNeed).charAt(0).toUpperCase() + (triage.aiCategory || selectedNeed).slice(1)} support needed.`,
    action: triage.urgencyLevel === 'critical' ? 'Immediate dispatch required.' : 'Queue and match within the day.',
    response_time: responseTimes[triage.urgencyLevel] || '6-24 hours',
    aiScore: Math.round(triage.confidenceScore * 100),
    familySize: 1,
    hasDisability: false,
    keywords: [],
  }
}

// ── API: Triage endpoint ─────────────────────────────────────
app.post('/api/triage', async (req, res) => {
  const { description, selectedNeed } = req.body
  if (!description || description.length < 5) {
    return res.status(400).json({ error: 'Description too short' })
  }
  const result = localTriage(description, selectedNeed)
  return res.json(result)
})

// Geocode preview for map updates during request intake
app.get('/api/geocode', async (req, res) => {
  const query = String(req.query.query || '').trim()
  if (!query) {
    return res.status(400).json({ error: 'query is required' })
  }
  const geoKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY

  let geocoded = null
  if (geoKey) {
    geocoded = await geocodeArea(query)
  }

  if (!geocoded) {
    const pin = extractPincode(query)
    const fallback = pin ? getPincodeCoords(pin) : null
    if (fallback) {
      return res.json({ lat: fallback.lat, lng: fallback.lng })
    }
    return res.status(404).json({ error: 'Location not found' })
  }

  return res.json(geocoded)
})

app.get('/api/reverse-geocode', async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  const geoKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
  if (!geoKey) {
    return res.status(501).json({ error: 'Geocoding is not configured' })
  }

  const result = await reverseGeocode(lat, lng)
  if (!result) {
    return res.status(404).json({ error: 'Location not found' })
  }

  return res.json(result)
})

// ── API: Submit request (public, backward compatible) ────────
app.post('/api/requests', async (req, res) => {
  const { name, phone, area, pincode, lat, lng, people, type, notes } = req.body

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone required' })
  }
  if (!pincode || !/^\d{6}$/.test(String(pincode).trim())) {
    return res.status(400).json({ error: 'Valid 6-digit pincode required' })
  }
  if (!notes || String(notes).trim().length < 8) {
    return res.status(400).json({ error: 'Please describe your situation in at least 8 characters' })
  }
  if (rateLimit(phone)) {
    return res.status(429).json({ error: 'Too many requests. Please wait.' })
  }

  if (!isMongoReady()) {
    return res.status(503).json({ error: 'Database not available' })
  }

  try {
    const selectedNeed = String(type || 'other').toLowerCase()
    const noteText = String(notes || '').trim()
    const triage = classifyUrgency(selectedNeed, noteText)

    const parsedLat = Number.parseFloat(lat)
    const parsedLng = Number.parseFloat(lng)
    let resolvedLat = Number.isFinite(parsedLat) ? parsedLat : null
    let resolvedLng = Number.isFinite(parsedLng) ? parsedLng : null

    if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
      const geoQuery = [area, pincode].filter(Boolean).join(' ')
      const geocoded = await geocodeArea(geoQuery)
      if (geocoded) {
        resolvedLat = geocoded.lat
        resolvedLng = geocoded.lng
      }
    }

    if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
      const pinFallback = getPincodeCoords(pincode)
      if (pinFallback) {
        resolvedLat = pinFallback.lat
        resolvedLng = pinFallback.lng
      }
    }

    if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
      resolvedLat = 27.1767
      resolvedLng = 78.0081
    }

    const urgencyScores = { critical: 90, high: 70, medium: 50, low: 30 }
    const priorityScore = urgencyScores[triage.urgencyLevel] || 50

    // Geo-match NGOs
    let matchedNgos = []
    try {
      matchedNgos = await NGOProfile.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [resolvedLng, resolvedLat] },
            distanceField: 'distanceMeters',
            spherical: true,
            maxDistance: 50000,
            query: { availableNow: true, servicesOffered: selectedNeed },
          },
        },
        { $limit: 5 },
      ])
    } catch (geoError) {
      // Geo query may fail if no 2dsphere index or no NGOs — that's okay
    }

    const newRequest = await HelpRequest.create({
      name,
      phone,
      area: area || '',
      pincode: String(pincode || '').trim(),
      people: Number.parseInt(people, 10) || 1,
      selectedNeed,
      requestedType: String(type || '').toUpperCase(),
      description: noteText,
      notes: noteText,
      location: {
        type: 'Point',
        coordinates: [resolvedLng, resolvedLat],
      },
      aiCategory: triage.aiCategory,
      urgencyLevel: triage.urgencyLevel,
      confidenceScore: triage.confidenceScore,
      aiSummary: `${selectedNeed.charAt(0).toUpperCase() + selectedNeed.slice(1)} support needed.`,
      aiScore: Math.round(triage.confidenceScore * 100),
      priorityScore,
      matchedNgos: matchedNgos.map((n) => n._id),
      assignedNgoName: matchedNgos.length > 0 ? matchedNgos[0].ngoName : null,
      status: matchedNgos.length > 0 ? 'matched' : 'pending',
      source: 'web',
    })

    // Emit via Socket.IO
    const requestData = newRequest.toObject()
    requestData.id = String(newRequest._id)
    io.emit('new_request', requestData)
    emitDashboardUpdates()

    return res.status(201).json({
      success: true,
      requestId: String(newRequest._id),
      priorityScore,
      urgency: triage.urgencyLevel.toUpperCase(),
      aiCategory: triage.aiCategory.toUpperCase(),
      aiSummary: newRequest.aiSummary,
      status: newRequest.status.toUpperCase(),
      matchedNgo: newRequest.assignedNgoName,
      estimatedResponse: triage.urgencyLevel === 'critical' ? '< 2 hours' : triage.urgencyLevel === 'high' ? '2-6 hours' : '6-24 hours',
    })
  } catch (error) {
    console.error('Request creation failed:', error.message)
    return res.status(500).json({ error: 'Failed to create request' })
  }
})

// ── Compatibility: Simple heatmap ingestion endpoints ──────────────────────
function normalizeHeatmapType(value) {
  const allowed = ['food', 'medical', 'shelter', 'water', 'rescue', 'education', 'clothing', 'other']
  const normalized = String(value || '').toLowerCase().trim()
  return allowed.includes(normalized) ? normalized : 'other'
}

app.get('/heatmap-data', async (req, res) => {
  if (!isMongoReady()) return res.json([])

  try {
    const requests = await HelpRequest.find({
      status: { $nin: ['fulfilled', 'cancelled'] },
    }).select('location')

    const formatted = requests.map((item) => ({
      lat: item.location?.coordinates?.[1] ?? 27.1767,
      lng: item.location?.coordinates?.[0] ?? 78.0081,
    }))

    return res.json(formatted)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

app.post('/add-request', async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ error: 'Database not available' })
  }

  try {
    const { type, lat, lng, area, name, phone } = req.body
    const selectedNeed = normalizeHeatmapType(type)
    const parsedLat = Number.parseFloat(lat)
    const parsedLng = Number.parseFloat(lng)
    let resolvedLat = Number.isFinite(parsedLat) ? parsedLat : null
    let resolvedLng = Number.isFinite(parsedLng) ? parsedLng : null

    if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
      const geocoded = await geocodeArea(area)
      if (geocoded) {
        resolvedLat = geocoded.lat
        resolvedLng = geocoded.lng
      }
    }

    if (!Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
      return res.status(400).json({ error: 'lat/lng or area is required' })
    }

    const newRequest = await HelpRequest.create({
      name: String(name || 'Anonymous').trim(),
      phone: String(phone || '').trim(),
      area: area || '',
      people: 1,
      selectedNeed,
      requestedType: String(type || selectedNeed).toUpperCase(),
      description: 'Heatmap ingest',
      notes: 'Heatmap ingest',
      location: { type: 'Point', coordinates: [resolvedLng, resolvedLat] },
      aiCategory: selectedNeed,
      urgencyLevel: 'medium',
      confidenceScore: 0.4,
      aiSummary: `${selectedNeed.charAt(0).toUpperCase() + selectedNeed.slice(1)} support needed.`,
      aiScore: 40,
      priorityScore: 40,
      status: 'pending',
      source: 'api',
    })

    const requestData = newRequest.toObject()
    requestData.id = String(newRequest._id)
    io.emit('new_request', requestData)
    emitDashboardUpdates()

    return res.json({ message: 'Request added successfully', id: String(newRequest._id) })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// ── API: Get requests (public, backward compatible) ──────────
app.get('/api/requests', async (req, res) => {
  if (!isMongoReady()) return res.json([])

  try {
    const { urgency, type, status, limit = 100 } = req.query
    const query = {}
    if (urgency) query.urgencyLevel = String(urgency).toLowerCase()
    if (type) query.selectedNeed = String(type).toLowerCase()
    if (status) query.status = String(status).toLowerCase()

    const requests = await HelpRequest.find(query)
      .sort({ priorityScore: -1, createdAt: -1 })
      .limit(Number(limit) || 100)

    // Map to backward-compatible format
    const mapped = requests.map((r) => ({
      id: String(r._id),
      name: r.name || '',
      phone: r.phone || '',
      type: (r.selectedNeed || r.aiCategory || 'other').toUpperCase(),
      urgency: (r.urgencyLevel || 'medium').toUpperCase(),
      area: r.area || '',
      people: r.people || 1,
      notes: r.notes || r.description || '',
      aiSummary: r.aiSummary || '',
      aiCategory: (r.aiCategory || '').toUpperCase(),
      aiScore: r.aiScore || 0,
      priorityScore: r.priorityScore || 0,
      status: (r.status || 'pending').toUpperCase(),
      matchedNgo: r.assignedNgoName || null,
      assignedVolunteer: r.assignedVolunteerName || null,
      lat: r.location?.coordinates?.[1] || 27.1767,
      lng: r.location?.coordinates?.[0] || 78.0081,
      createdAt: r.createdAt,
      fulfilledAt: r.fulfilledAt,
      description: r.description || r.notes || '',
      submittedAt: r.createdAt,
    }))

    return res.json(mapped)
  } catch (error) {
    return res.json([])
  }
})

// ── API: Update request status ───────────────────────────────
app.patch('/api/requests/:id/status', async (req, res) => {
  if (!isMongoReady()) return res.status(503).json({ error: 'Database not available' })

  try {
    const status = String(req.body.status || '').toLowerCase()
    const validStatuses = ['pending', 'matched', 'assigned', 'in_progress', 'fulfilled', 'cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const request = await HelpRequest.findById(req.params.id)
    if (!request) {
      return res.status(404).json({ error: 'Not found' })
    }

    request.status = status
    if (status === 'fulfilled') request.fulfilledAt = new Date()
    await request.save()

    const requestData = request.toObject()
    requestData.id = String(request._id)
    io.emit('request_updated', requestData)
    emitDashboardUpdates()

    return res.json({ success: true, request: requestData })
  } catch (error) {
    return res.status(500).json({ error: 'Update failed' })
  }
})

// ── API: Match request to NGO ────────────────────────────────
app.post('/api/match', async (req, res) => {
  if (!isMongoReady()) return res.status(503).json({ error: 'Database not available' })

  try {
    const { requestId } = req.body
    const request = await HelpRequest.findById(requestId)
    if (!request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    const coords = request.location?.coordinates || [78.0081, 27.1767]
    const matchedNgos = await NGOProfile.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: coords },
          distanceField: 'distanceMeters',
          spherical: true,
          maxDistance: 50000,
          query: { availableNow: true, servicesOffered: request.selectedNeed },
        },
      },
      { $limit: 1 },
    ])

    if (matchedNgos.length === 0) {
      return res.status(404).json({ error: 'No matching NGO found nearby' })
    }

    const match = matchedNgos[0]
    request.status = 'matched'
    request.assignedNgoName = match.ngoName
    request.assignedNgoId = match.userId
    request.claimedAt = new Date()
    await request.save()

    const requestData = request.toObject()
    requestData.id = String(request._id)
    io.emit('request_updated', requestData)
    emitDashboardUpdates()

    return res.json({
      success: true,
      matchedNgo: match.ngoName,
      distanceKm: (match.distanceMeters / 1000).toFixed(1),
    })
  } catch (error) {
    return res.status(500).json({ error: 'Match failed' })
  }
})

// ── API: NGO requests (backward compatible) ──────────────────
app.get('/api/ngo/requests', async (req, res) => {
  if (!isMongoReady()) return res.json({ requests: [] })

  try {
    const requests = await HelpRequest.find({ status: { $ne: 'cancelled' } })
      .sort({ priorityScore: -1, createdAt: -1 })
      .limit(100)

    const mapped = requests.map((r) => ({
      id: String(r._id),
      name: r.name || '',
      phone: r.phone || '',
      type: (r.selectedNeed || 'other').toUpperCase(),
      urgency: (r.urgencyLevel || 'medium').toUpperCase(),
      area: r.area || '',
      people: r.people || 1,
      notes: r.notes || r.description || '',
      description: r.description || r.notes || '',
      priorityScore: r.priorityScore || 0,
      aiScore: r.aiScore || 0,
      status: (r.status || 'pending').toUpperCase(),
      matchedNgo: r.assignedNgoName || null,
      assignedVolunteer: r.assignedVolunteerName || null,
      createdAt: r.createdAt,
    }))

    return res.json({ requests: mapped })
  } catch (error) {
    return res.json({ requests: [] })
  }
})

// ── API: Get NGOs ────────────────────────────────────────────
app.get('/api/ngos', async (req, res) => {
  if (!isMongoReady()) return res.json([])

  try {
    const ngos = await NGOProfile.find({}).lean()
    return res.json(
      ngos.map((n) => ({
        id: String(n._id),
        ngoName: n.ngoName,
        name: n.ngoName,
        type: n.servicesOffered || [],
        available: n.availableNow ? 80 : 0,
        lat: n.location?.coordinates?.[1] || 27.1767,
        lng: n.location?.coordinates?.[0] || 78.0081,
        availability: { quantity: n.coverageRadiusKm || 10, lastUpdated: n.updatedAt },
        rating: 4.5,
        verified: true,
      })),
    )
  } catch (error) {
    return res.json([])
  }
})

// ── API: Heatmap from DB ─────────────────────────────────────
app.get('/api/heatmap', async (req, res) => {
  if (!isMongoReady()) return res.json([])

  try {
    const requests = await HelpRequest.find({
      status: { $nin: ['fulfilled', 'cancelled'] },
    }).select('location urgencyLevel selectedNeed priorityScore aiScore')

    return res.json(
      requests.map((r) => {
        const coords = r.location?.coordinates || [78.0081, 27.1767]
        const intensityMap = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2 }
        const score = Number.isFinite(r.priorityScore) ? r.priorityScore : Number.isFinite(r.aiScore) ? r.aiScore : null
        const derived = Number.isFinite(score) ? Math.min(1, Math.max(0.2, score / 100)) : null
        const fallbackIntensity = intensityMap[r.urgencyLevel] || 0.3
        return {
          id: String(r._id),
          lat: coords[1],
          lng: coords[0],
          type: (r.selectedNeed || 'other').toUpperCase(),
          intensity: derived ?? fallbackIntensity,
          priorityScore: Number.isFinite(score) ? score : undefined,
        }
      }),
    )
  } catch (error) {
    return res.json([])
  }
})

// ── API: Stats from DB ───────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  if (!isMongoReady()) {
    return res.json({ requestsToday: 0, pendingCount: 0, criticalCount: 0, avgResponseMin: 0, ngosActive: 0 })
  }

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [total, pending, critical, fulfilled, todayCount, ngosActive] = await Promise.all([
      HelpRequest.countDocuments({}),
      HelpRequest.countDocuments({ status: 'pending' }),
      HelpRequest.countDocuments({ urgencyLevel: 'critical', status: { $in: ['pending', 'open'] } }),
      HelpRequest.countDocuments({ status: 'fulfilled' }),
      HelpRequest.countDocuments({ createdAt: { $gte: todayStart } }),
      NGOProfile.countDocuments({ availableNow: true }),
    ])

    return res.json({
      requestsToday: todayCount,
      fulfilledToday: 0,
      pendingCount: pending,
      criticalCount: critical,
      totalFulfilled: fulfilled,
      avgResponseMin: 23,
      fulfillmentRate: total > 0 ? Math.round((fulfilled / total) * 100) : 0,
      totalRequests: total,
      ngosActive,
    })
  } catch (error) {
    return res.json({ requestsToday: 0, pendingCount: 0 })
  }
})

// ── API: Analytics from DB ───────────────────────────────────
app.get('/api/analytics', async (req, res) => {
  if (!isMongoReady()) {
    return res.json({ byType: {}, byUrgency: {}, byStatus: {}, topAreas: [], ngoPerformance: [], stats: {} })
  }

  try {
    const allRequests = await HelpRequest.find({}).lean()

    const byType = {}
    const byUrgency = {}
    const byStatus = {}
    const byArea = {}

    allRequests.forEach((r) => {
      const type = (r.selectedNeed || 'other').toUpperCase()
      const urgency = (r.urgencyLevel || 'medium').toUpperCase()
      const status = (r.status || 'pending').toUpperCase()
      const area = r.area || 'Unknown'

      byType[type] = (byType[type] || 0) + 1
      byUrgency[urgency] = (byUrgency[urgency] || 0) + 1
      byStatus[status] = (byStatus[status] || 0) + 1
      byArea[area] = (byArea[area] || 0) + 1
    })

    const topAreas = Object.entries(byArea)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([area, count]) => ({ area, count }))

    const ngoProfiles = await NGOProfile.find({}).lean()
    const ngoPerformance = []
    for (const ngo of ngoProfiles) {
      const fulfilled = await HelpRequest.countDocuments({ assignedNgoId: ngo.userId, status: 'fulfilled' })
      const matched = await HelpRequest.countDocuments({ assignedNgoId: ngo.userId })
      ngoPerformance.push({ name: ngo.ngoName, fulfilled, matched, capacity: ngo.coverageRadiusKm || 10, rating: 4.5 })
    }

    const fulfilled = allRequests.filter((r) => r.status === 'fulfilled').length
    const pending = allRequests.filter((r) => r.status === 'pending').length

    return res.json({
      byType,
      byUrgency,
      byStatus,
      topAreas,
      ngoPerformance: ngoPerformance.sort((a, b) => b.fulfilled - a.fulfilled),
      stats: {
        requestsToday: allRequests.length,
        pendingCount: pending,
        criticalCount: allRequests.filter((r) => r.urgencyLevel === 'critical' && r.status === 'pending').length,
        totalFulfilled: fulfilled,
        avgResponseMin: 23,
        totalRequests: allRequests.length,
        ngosActive: ngoProfiles.filter((n) => n.availableNow).length,
      },
    })
  } catch (error) {
    return res.json({ byType: {}, byStatus: {}, stats: {} })
  }
})

// ── API: Volunteer missions (backward compatible) ────────────
app.get('/api/volunteer/missions', async (req, res) => {
  if (!isMongoReady()) return res.json({ missions: [] })

  try {
    const missions = await HelpRequest.find({ status: { $in: ['pending', 'matched', 'assigned'] } })
      .sort({ priorityScore: -1 })
      .limit(20)

    return res.json({ missions })
  } catch (error) {
    return res.json({ missions: [] })
  }
})

// ── API: User's own requests ─────────────────────────────────
app.get('/api/user/my-requests', async (req, res) => {
  // This is a backward-compatible endpoint; the auth-protected version is in helpRoutes
  return res.json({ requests: [] })
})

// ── Dashboard updates via Socket.IO ──────────────────────────
async function emitDashboardUpdates() {
  if (!isMongoReady()) return

  try {
    const requests = await HelpRequest.find({
      status: { $nin: ['fulfilled', 'cancelled'] },
    }).select('location urgencyLevel selectedNeed priorityScore aiScore')

    const heatmapPoints = requests.map((r) => {
      const coords = r.location?.coordinates || [78.0081, 27.1767]
      const intensityMap = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2 }
      const score = Number.isFinite(r.priorityScore) ? r.priorityScore : Number.isFinite(r.aiScore) ? r.aiScore : null
      const derived = Number.isFinite(score) ? Math.min(1, Math.max(0.2, score / 100)) : null
      const fallbackIntensity = intensityMap[r.urgencyLevel] || 0.3
      return {
        lat: coords[1],
        lng: coords[0],
        type: (r.selectedNeed || 'other').toUpperCase(),
        intensity: derived ?? fallbackIntensity,
        priorityScore: Number.isFinite(score) ? score : undefined,
      }
    })

    io.emit('heatmap_update', heatmapPoints)

    // Quick stats
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const [total, pending, critical, fulfilled, todayCount] = await Promise.all([
      HelpRequest.countDocuments({}),
      HelpRequest.countDocuments({ status: 'pending' }),
      HelpRequest.countDocuments({ urgencyLevel: 'critical', status: 'pending' }),
      HelpRequest.countDocuments({ status: 'fulfilled' }),
      HelpRequest.countDocuments({ createdAt: { $gte: todayStart } }),
    ])

    io.emit('stats_update', { requestsToday: todayCount, pendingCount: pending, criticalCount: critical, totalFulfilled: fulfilled, avgResponseMin: 23, totalRequests: total })
  } catch (error) {
    // Silently fail — dashboard updates are non-critical
  }
}

// Expose dashboard updater to route handlers
app.set('emitDashboardUpdates', emitDashboardUpdates)

async function sendInitPayload(socket) {
  if (!isMongoReady()) {
    socket.emit('init', { requests: [], heatmap: [], stats: {} })
    return
  }

  try {
    const recentRequests = await HelpRequest.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const mapped = recentRequests.map((r) => ({
      id: String(r._id),
      name: r.name || '',
      type: (r.selectedNeed || 'other').toUpperCase(),
      urgency: (r.urgencyLevel || 'medium').toUpperCase(),
      area: r.area || '',
      people: r.people || 1,
      status: (r.status || 'pending').toUpperCase(),
      priorityScore: r.priorityScore || 0,
      lat: r.location?.coordinates?.[1] || 27.1767,
      lng: r.location?.coordinates?.[0] || 78.0081,
      createdAt: r.createdAt,
      description: r.description || r.notes || '',
      submittedAt: r.createdAt,
    }))

    const active = await HelpRequest.find({
      status: { $nin: ['fulfilled', 'cancelled'] },
    }).select('location urgencyLevel selectedNeed priorityScore aiScore')

    const heatmap = active.map((r) => {
      const coords = r.location?.coordinates || [78.0081, 27.1767]
      const intensityMap = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2 }
      const score = Number.isFinite(r.priorityScore) ? r.priorityScore : Number.isFinite(r.aiScore) ? r.aiScore : null
      const derived = Number.isFinite(score) ? Math.min(1, Math.max(0.2, score / 100)) : null
      const fallbackIntensity = intensityMap[r.urgencyLevel] || 0.3
      return {
        lat: coords[1],
        lng: coords[0],
        type: (r.selectedNeed || 'other').toUpperCase(),
        intensity: derived ?? fallbackIntensity,
        priorityScore: Number.isFinite(score) ? score : undefined,
      }
    })

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const [total, pending, critical, fulfilled, todayCount] = await Promise.all([
      HelpRequest.countDocuments({}),
      HelpRequest.countDocuments({ status: 'pending' }),
      HelpRequest.countDocuments({ urgencyLevel: 'critical', status: { $in: ['pending', 'open'] } }),
      HelpRequest.countDocuments({ status: 'fulfilled' }),
      HelpRequest.countDocuments({ createdAt: { $gte: todayStart } }),
    ])

    socket.emit('init', {
      requests: mapped,
      heatmap,
      stats: {
        requestsToday: todayCount,
        pendingCount: pending,
        criticalCount: critical,
        totalFulfilled: fulfilled,
        avgResponseMin: 23,
        totalRequests: total,
      },
    })
  } catch (error) {
    socket.emit('init', { requests: [], heatmap: [], stats: {} })
  }
}

// ── Socket.IO connection ─────────────────────────────────────
io.on('connection', async (socket) => {
  await sendInitPayload(socket)

  socket.on('join_ngo', ({ ngoId }) => {
    socket.join(`ngo_${ngoId}`)
  })

  socket.on('init_request', async () => {
    await sendInitPayload(socket)
  })

  socket.on('send-location', (payload = {}) => {
    const lat = Number(payload.lat)
    const lng = Number(payload.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    io.emit('receive-location', {
      id: socket.id,
      lat,
      lng,
      role: payload.role || 'user',
      label: payload.label || '',
      ts: Date.now(),
    })
  })
})

// ── Health check ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const userCount = isMongoReady() ? await User.countDocuments({}).catch(() => 0) : 0
  const requestCount = isMongoReady() ? await HelpRequest.countDocuments({}).catch(() => 0) : 0

  res.json({
    status: 'ok',
    mongo: isMongoReady() ? 'connected' : 'disconnected',
    users: userCount,
    requests: requestCount,
  })
})

app.get('/', (_, res) => {
  res.send('Sahayak Backend LIVE!')
})

// ── Start server ─────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Sahayak backend running on http://localhost:${PORT}`)
  const mongoReady = isMongoReady()
  console.log(`MongoDB: ${mongoReady ? 'connected' : 'pending...'}`)
  console.log(`Twilio Verify: ${twilioConfigured ? 'enabled' : 'disabled (dev OTP mode)'}`)
  if (mongoReady) {
    console.log('All data is now persisted in MongoDB.')
  } else {
    console.log('MongoDB is not connected. Set MONGODB_URI to enable database-backed routes.')
  }
  console.log('Available endpoints:')
  console.log('  AUTH:')
  console.log('    POST /api/auth/jwt/signup')
  console.log('    POST /api/auth/jwt/verify-otp')
  console.log('    POST /api/auth/jwt/login')
  console.log('    GET  /api/auth/jwt/me')
  console.log('    POST /api/auth/jwt/logout')
  console.log('    GET  /api/auth/jwt/ngo/volunteers')
  console.log('    POST /api/auth/jwt/ngo/add-volunteer')
  console.log('    GET  /api/auth/jwt/ngo/invite-code')
  console.log('  REQUESTS:')
  console.log('    POST /api/requests')
  console.log('    GET  /api/requests')
  console.log('    PATCH /api/requests/:id/status')
  console.log('    POST /api/match')
  console.log('  HELP (auth-protected):')
  console.log('    POST /api/help/request')
  console.log('    GET  /api/help/my-requests')
  console.log('    GET  /api/help/ngo-board')
  console.log('    POST /api/help/request/:id/claim')
  console.log('    PATCH /api/help/request/:id/assign')
  console.log('    PATCH /api/help/request/:id/fulfill')
  console.log('    GET  /api/help/volunteer-assignments')
  console.log('  DATA:')
  console.log('    GET  /api/heatmap')
  console.log('    GET  /api/stats')
  console.log('    GET  /api/analytics')
  console.log('    GET  /api/ngos')
  console.log('    GET  /health')
})
