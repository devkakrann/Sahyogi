import express from 'express'
import mongoose from 'mongoose'
import { isMongoReady } from '../db/mongoose.js'
import authJwt, { requireRoles } from '../middleware/authJwt.js'
import HelpRequest from '../models/HelpRequest.js'
import NGOProfile from '../models/NGOProfile.js'
import User from '../models/User.js'
import { classifyUrgency } from '../services/triageService.js'
import { geocodeArea } from '../services/geocode.js'
import { getPincodeCoords } from '../services/pincodeLookup.js'

const router = express.Router()
const ALLOWED_NEEDS = ['food', 'medical', 'shelter', 'water', 'rescue', 'education', 'clothing', 'other']

function emitRealtimeUpdate(req, requestDoc, event = 'request_updated') {
  const io = req.app?.get?.('io')
  if (io && requestDoc) {
    const requestData = requestDoc.toObject()
    requestData.id = String(requestDoc._id)
    io.emit(event, requestData)
  }
  const emitDashboardUpdates = req.app?.get?.('emitDashboardUpdates')
  if (typeof emitDashboardUpdates === 'function') {
    emitDashboardUpdates()
  }
}

function normalizeNeed(value) {
  const normalized = String(value || '').toLowerCase().trim()
  return ALLOWED_NEEDS.includes(normalized) ? normalized : 'other'
}

function parseCoordinate(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function calculatePriorityScore({ urgency, familySize = 1, hasDisability = false }) {
  const urgencyScores = { critical: 100, high: 70, medium: 40, low: 20 }
  const urgencyScore = urgencyScores[urgency] || 40
  const vulnerabilityScore = Math.min(100, familySize * 15 + (hasDisability ? 30 : 0))
  const score = (urgencyScore * 0.6) + (vulnerabilityScore * 0.4)
  return Math.round(Math.min(100, score))
}

// ─────────────────────────────────────────────────────────────
// POST /request — Submit a help request (authenticated user)
// ─────────────────────────────────────────────────────────────
router.post('/request', authJwt, async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const { selectedNeed, description, lat, lng, area, pincode, people, name, phone, notes } = req.body
    const need = normalizeNeed(selectedNeed || req.body.type)
    const parsedLat = parseCoordinate(lat)
    const parsedLng = parseCoordinate(lng)
    const descText = String(description || notes || '').trim()

    if (!need || need === 'other' && !selectedNeed) {
      return res.status(400).json({ message: 'selectedNeed is required' })
    }
    if (!descText || descText.length < 8) {
      return res.status(400).json({ message: 'Description is required (min 8 chars)' })
    }
    if (!pincode || !/^\d{6}$/.test(String(pincode).trim())) {
      return res.status(400).json({ message: 'Valid 6-digit pincode is required' })
    }

    let resolvedLat = parsedLat !== null ? parsedLat : null
    let resolvedLng = parsedLng !== null ? parsedLng : null

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

    // AI triage (local keyword-based)
    const triage = classifyUrgency(need, descText)
    const priorityScore = calculatePriorityScore({
      urgency: triage.urgencyLevel,
      familySize: Number(people) || 1,
    })

    // Geo-match NGOs
    const matchedNgos = await NGOProfile.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [resolvedLng, resolvedLat] },
          distanceField: 'distanceMeters',
          spherical: true,
          maxDistance: 50000,
          query: {
            availableNow: true,
            servicesOffered: need,
          },
        },
      },
      {
        $match: {
          $expr: {
            $gte: [{ $multiply: ['$coverageRadiusKm', 1000] }, '$distanceMeters'],
          },
        },
      },
      { $limit: 10 },
    ])

    const request = await HelpRequest.create({
      userId: new mongoose.Types.ObjectId(req.user.userId),
      name: name || req.user.fullName,
      phone: phone || req.user.phone,
      area: area || '',
      pincode: String(pincode || '').trim(),
      people: Number(people) || 1,
      selectedNeed: need,
      requestedType: String(selectedNeed || '').toUpperCase(),
      description: descText,
      notes: descText,
      location: {
        type: 'Point',
        coordinates: [resolvedLng, resolvedLat],
      },
      aiCategory: triage.aiCategory,
      urgencyLevel: triage.urgencyLevel,
      confidenceScore: triage.confidenceScore,
      aiSummary: `${need.charAt(0).toUpperCase() + need.slice(1)} support needed.`,
      aiScore: triage.confidenceScore * 100,
      priorityScore,
      matchedNgos: matchedNgos.map((ngo) => ngo._id),
      assignedNgoId: matchedNgos.length > 0 ? matchedNgos[0].userId : undefined,
      assignedNgoName: matchedNgos.length > 0 ? matchedNgos[0].ngoName : undefined,
      status: matchedNgos.length > 0 ? 'matched' : 'pending',
      source: 'web',
    })

    emitRealtimeUpdate(req, request, 'new_request')

    return res.status(201).json({
      success: true,
      message: 'Request created successfully',
      requestId: String(request._id),
      triage,
      priorityScore,
      urgency: triage.urgencyLevel,
      aiCategory: triage.aiCategory,
      aiSummary: request.aiSummary,
      status: request.status,
      matchedNgo: request.assignedNgoName || null,
      matchedNgoCount: matchedNgos.length,
      matchedNgos: matchedNgos.map((ngo) => ({
        id: String(ngo._id),
        ngoName: ngo.ngoName,
        distanceKm: Number((Number(ngo.distanceMeters || 0) / 1000).toFixed(2)),
      })),
      estimatedResponse: triage.urgencyLevel === 'critical' ? '< 2 hours' : triage.urgencyLevel === 'high' ? '2-6 hours' : '6-24 hours',
      request,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Request failed', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /my-requests — user sees their own requests with live status
// ─────────────────────────────────────────────────────────────
router.get('/my-requests', authJwt, async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const requests = await HelpRequest.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50)

    return res.json({ requests })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading requests', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /ngo-board — NGO sees domain-filtered requests
// ─────────────────────────────────────────────────────────────
router.get('/ngo-board', authJwt, requireRoles('ngo', 'admin'), async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const ngo = await NGOProfile.findOne({ userId: req.user.userId })
    const ngoUser = await User.findById(req.user.userId)

    // Find requests that matched this NGO or match its service domains
    const query = { status: { $ne: 'cancelled' } }

    if (ngo) {
      query.$or = [
        { matchedNgos: ngo._id },
        { assignedNgoId: new mongoose.Types.ObjectId(req.user.userId) },
        { selectedNeed: { $in: ngo.servicesOffered || [] } },
      ]
    }

    const requests = await HelpRequest.find(query)
      .sort({ priorityScore: -1, createdAt: -1 })
      .populate('userId', 'fullName phone')
      .populate('assignedVolunteerId', 'fullName phone')
      .limit(200)

    // Get NGO's volunteers
    const volunteers = await User.find({ parentNgoId: req.user.userId, role: 'volunteer' })
      .select('fullName phone skills availableNow')

    return res.json({
      ngoId: ngo ? String(ngo._id) : null,
      ngoName: ngoUser?.orgName || ngo?.ngoName || 'Unknown',
      inviteCode: ngoUser?.inviteCode || '',
      requests,
      volunteers: volunteers.map((v) => ({ id: String(v._id), fullName: v.fullName, phone: v.phone, skills: v.skills, availableNow: v.availableNow })),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading NGO board', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /request/:id/claim — NGO claims a pending request
// ─────────────────────────────────────────────────────────────
router.post('/request/:id/claim', authJwt, requireRoles('ngo', 'admin'), async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const request = await HelpRequest.findById(req.params.id)
    if (!request) {
      return res.status(404).json({ message: 'Request not found' })
    }
    if (request.status !== 'pending' && request.status !== 'matched' && request.status !== 'open') {
      return res.status(400).json({ message: `Cannot claim a request with status: ${request.status}` })
    }

    const ngoUser = await User.findById(req.user.userId)

    request.assignedNgoId = new mongoose.Types.ObjectId(req.user.userId)
    request.assignedNgoName = ngoUser?.orgName || req.user.fullName
    request.status = 'matched'
    request.claimedAt = new Date()
    await request.save()

    emitRealtimeUpdate(req, request)

    return res.json({ success: true, message: 'Request claimed', request })
  } catch (error) {
    return res.status(500).json({ message: 'Claim failed', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// PATCH /request/:id/assign — NGO assigns volunteer to request
// ─────────────────────────────────────────────────────────────
router.patch('/request/:id/assign', authJwt, requireRoles('ngo', 'admin'), async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const { volunteerId } = req.body
    if (!volunteerId) {
      return res.status(400).json({ message: 'volunteerId is required' })
    }

    const request = await HelpRequest.findById(req.params.id)
    if (!request) {
      return res.status(404).json({ message: 'Request not found' })
    }

    const volunteer = await User.findById(volunteerId).select('fullName role parentNgoId availableNow')
    if (!volunteer || volunteer.role !== 'volunteer') {
      return res.status(404).json({ message: 'Volunteer not found' })
    }
    if (String(volunteer.parentNgoId || '') !== req.user.userId) {
      return res.status(403).json({ message: 'Volunteer does not belong to your NGO' })
    }
    if (volunteer.availableNow === false) {
      return res.status(400).json({ message: 'Volunteer is not available' })
    }
    if (request.assignedNgoId && String(request.assignedNgoId) !== req.user.userId) {
      return res.status(403).json({ message: 'Request is assigned to another NGO' })
    }

    request.assignedVolunteerId = volunteer._id
    request.assignedVolunteerName = volunteer.fullName
    request.status = 'assigned'
    request.assignedAt = new Date()
    if (!request.assignedNgoId) {
      const ngoUser = await User.findById(req.user.userId)
      request.assignedNgoId = new mongoose.Types.ObjectId(req.user.userId)
      request.assignedNgoName = ngoUser?.orgName || req.user.fullName
    }
    await request.save()

    emitRealtimeUpdate(req, request)

    return res.json({ success: true, message: `Assigned to ${volunteer.fullName}`, request })
  } catch (error) {
    return res.status(500).json({ message: 'Assignment failed', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// PATCH /request/:id/fulfill — NGO or Volunteer marks as fulfilled
// ─────────────────────────────────────────────────────────────
router.patch('/request/:id/fulfill', authJwt, async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const request = await HelpRequest.findById(req.params.id)
    if (!request) {
      return res.status(404).json({ message: 'Request not found' })
    }

    // Allow only the assigned volunteer (or admin override)
    const isAdmin = req.user.role === 'admin'
    const isAssignedVol = request.assignedVolunteerId && String(request.assignedVolunteerId) === req.user.userId
    if (!isAssignedVol && !isAdmin) {
      return res.status(403).json({ message: 'Only the assigned volunteer can fulfill this request' })
    }

    request.status = 'fulfilled'
    request.fulfilledAt = new Date()
    await request.save()

    // Update volunteer stats (award 100-200 points per delivery)
    let pointsAwarded = 0
    if (request.assignedVolunteerId) {
      pointsAwarded = Math.floor(100 + Math.random() * 101)
      await User.findByIdAndUpdate(request.assignedVolunteerId, {
        $inc: { points: pointsAwarded, deliveries: 1 },
      })
    }

    emitRealtimeUpdate(req, request)

    return res.json({ success: true, message: 'Request marked as fulfilled', request, pointsAwarded })
  } catch (error) {
    return res.status(500).json({ message: 'Fulfill failed', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /volunteer-assignments — Volunteer sees only assigned requests
// ─────────────────────────────────────────────────────────────
router.get('/volunteer-assignments', authJwt, async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    // If volunteer has a parentNgoId, also show requests assigned to their NGO that need a volunteer
    const volunteerUser = await User.findById(req.user.userId)
    const query = {
      $or: [
        { assignedVolunteerId: new mongoose.Types.ObjectId(req.user.userId) },
      ],
    }

    if (volunteerUser?.parentNgoId) {
      query.$or.push({
        assignedNgoId: volunteerUser.parentNgoId,
        assignedVolunteerId: { $exists: false },
        status: { $in: ['matched', 'assigned'] },
      })
      query.$or.push({
        assignedNgoId: volunteerUser.parentNgoId,
        assignedVolunteerId: null,
        status: { $in: ['matched', 'assigned'] },
      })
    }

    const requests = await HelpRequest.find(query)
      .sort({ priorityScore: -1, createdAt: -1 })
      .limit(50)

    return res.json({ missions: requests })
  } catch (error) {
    return res.status(500).json({ message: 'Error loading assignments', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /all — All requests (for heatmap/analytics, public)
// ─────────────────────────────────────────────────────────────
router.get('/all', async (req, res) => {
  if (!isMongoReady()) {
    return res.json([])
  }

  try {
    const { status, limit = 100 } = req.query
    const query = {}
    if (status) query.status = status.toLowerCase()

    const requests = await HelpRequest.find(query)
      .sort({ priorityScore: -1, createdAt: -1 })
      .limit(Number(limit) || 100)

    return res.json(requests)
  } catch (error) {
    return res.json([])
  }
})

// ─────────────────────────────────────────────────────────────
// GET /heatmap — Heatmap points from real DB data
// ─────────────────────────────────────────────────────────────
router.get('/heatmap', async (req, res) => {
  if (!isMongoReady()) {
    return res.json([])
  }

  try {
    const requests = await HelpRequest.find({
      status: { $nin: ['fulfilled', 'cancelled'] },
    }).select('location urgencyLevel selectedNeed priorityScore aiScore')

    const points = requests.map((r) => {
      const coords = r.location?.coordinates || [78.0081, 27.1767]
      const intensityMap = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2 }
      const score = Number.isFinite(r.priorityScore) ? r.priorityScore : Number.isFinite(r.aiScore) ? r.aiScore : null
      const derived = Number.isFinite(score) ? Math.min(1, Math.max(0.2, score / 100)) : null
      const fallbackIntensity = intensityMap[r.urgencyLevel] || 0.3
      return {
        lat: coords[1],
        lng: coords[0],
        intensity: derived ?? fallbackIntensity,
        type: r.selectedNeed,
        priorityScore: Number.isFinite(score) ? score : undefined,
      }
    })

    return res.json(points)
  } catch (error) {
    return res.json([])
  }
})

// ─────────────────────────────────────────────────────────────
// GET /analytics — Real analytics from MongoDB
// ─────────────────────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  if (!isMongoReady()) {
    return res.json({ byType: {}, byUrgency: {}, byStatus: {}, topAreas: [], ngoPerformance: [], stats: {} })
  }

  try {
    const allRequests = await HelpRequest.find({}).lean()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const byType = {}
    const byUrgency = {}
    const byStatus = {}
    const byArea = {}
    let todayCount = 0
    let todayFulfilled = 0
    let totalFulfilled = 0

    allRequests.forEach((r) => {
      const type = (r.selectedNeed || r.aiCategory || 'other').toUpperCase()
      const urgency = (r.urgencyLevel || 'medium').toUpperCase()
      const status = (r.status || 'pending').toUpperCase()
      const area = r.area || 'Unknown'

      byType[type] = (byType[type] || 0) + 1
      byUrgency[urgency] = (byUrgency[urgency] || 0) + 1
      byStatus[status] = (byStatus[status] || 0) + 1
      byArea[area] = (byArea[area] || 0) + 1

      if (new Date(r.createdAt) >= todayStart) {
        todayCount++
        if (status === 'FULFILLED') todayFulfilled++
      }
      if (status === 'FULFILLED') totalFulfilled++
    })

    const topAreas = Object.entries(byArea)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([area, count]) => ({ area, count }))

    const ngoProfiles = await NGOProfile.find({}).lean()
    const ngoPerformance = await Promise.all(
      ngoProfiles.map(async (ngo) => {
        const fulfilled = await HelpRequest.countDocuments({ assignedNgoId: ngo.userId, status: 'fulfilled' })
        const matched = await HelpRequest.countDocuments({ assignedNgoId: ngo.userId })
        return {
          name: ngo.ngoName,
          fulfilled,
          matched,
          capacity: ngo.coverageRadiusKm || 10,
          rating: 4.5,
        }
      }),
    )

    const pendingCount = byStatus.PENDING || 0
    const criticalCount = allRequests.filter((r) => r.urgencyLevel === 'critical' && r.status === 'pending').length

    return res.json({
      byType,
      byUrgency,
      byStatus,
      topAreas,
      ngoPerformance: ngoPerformance.sort((a, b) => b.fulfilled - a.fulfilled),
      stats: {
        requestsToday: todayCount,
        fulfilledToday: todayFulfilled,
        pendingCount,
        criticalCount,
        totalFulfilled,
        avgResponseMin: 23,
        totalRequests: allRequests.length,
        ngosActive: ngoProfiles.filter((n) => n.availableNow).length,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Analytics error', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /stats — Quick stats
// ─────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
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
    return res.json({ requestsToday: 0, pendingCount: 0, criticalCount: 0 })
  }
})

// Keep the old ngo-profile creation route
router.post('/ngo-profile', authJwt, requireRoles('ngo', 'admin'), async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const { ngoName, servicesOffered, priorityLevelsHandled, availableNow, coverageRadiusKm, lat, lng } = req.body
    const parsedLat = parseCoordinate(lat)
    const parsedLng = parseCoordinate(lng)

    if (!ngoName) return res.status(400).json({ message: 'ngoName is required' })
    if (!Array.isArray(servicesOffered) || servicesOffered.length === 0) {
      return res.status(400).json({ message: 'servicesOffered must include at least one service' })
    }
    if (parsedLat === null || parsedLng === null) return res.status(400).json({ message: 'lat and lng are required' })

    const profile = await NGOProfile.findOneAndUpdate(
      { userId: req.user.userId },
      {
        ngoName: String(ngoName).trim(),
        servicesOffered: servicesOffered.map((item) => String(item || '').toLowerCase()).filter(Boolean),
        priorityLevelsHandled: Array.isArray(priorityLevelsHandled)
          ? priorityLevelsHandled.map((item) => String(item || '').toLowerCase()).filter(Boolean)
          : ['medium', 'high', 'critical'],
        availableNow: availableNow !== false,
        coverageRadiusKm: Number(coverageRadiusKm) || 10,
        location: { type: 'Point', coordinates: [parsedLng, parsedLat] },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    return res.json({ message: 'NGO profile saved', ngoProfile: profile })
  } catch (error) {
    return res.status(500).json({ message: 'Error saving NGO profile', error: error.message })
  }
})

export default router
