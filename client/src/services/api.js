const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const REQUEST_TYPE_MAP = {
  FOOD: 'food', MEDICAL: 'medical', SHELTER: 'shelter', EDUCATION: 'education',
  WATER: 'water', RESCUE: 'rescue', CLOTHING: 'other', OTHER: 'other',
  food: 'food', medical: 'medical', shelter: 'shelter', education: 'education',
  water: 'water', rescue: 'rescue', clothing: 'other', other: 'other',
}
const URGENCY_MAP = {
  CRITICAL: 'critical', URGENT: 'high', NORMAL: 'medium', HIGH: 'high',
  MEDIUM: 'medium', LOW: 'low', critical: 'critical', urgent: 'high',
  normal: 'medium', high: 'high', medium: 'medium', low: 'low',
}
const STATUS_MAP = {
  PENDING: 'pending', MATCHED: 'matched', ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress', FULFILLED: 'fulfilled', CANCELLED: 'cancelled',
  pending: 'pending', matched: 'matched', assigned: 'assigned',
  in_progress: 'in_progress', fulfilled: 'fulfilled', cancelled: 'cancelled',
}

function normalizeType(type) { return REQUEST_TYPE_MAP[type] || String(type || 'other').toLowerCase() }
function normalizeUrgency(urgency) { return URGENCY_MAP[urgency] || String(urgency || 'medium').toLowerCase() }
function normalizeStatus(status) { return STATUS_MAP[status] || String(status || 'pending').toLowerCase() }

function formatRelativeTime(value) {
  if (!value) return 'just now'
  if (typeof value === 'string' && Number.isNaN(Date.parse(value))) return value
  const date = new Date(value)
  const deltaMs = Date.now() - date.getTime()
  if (Number.isNaN(deltaMs)) return 'just now'
  const deltaMinutes = Math.max(1, Math.round(deltaMs / 60000))
  if (deltaMinutes < 60) return `${deltaMinutes} min ago`
  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours} hour${deltaHours === 1 ? '' : 's'} ago`
  const deltaDays = Math.round(deltaHours / 24)
  return `${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`
}

export function normalizeRequest(request) {
  if (!request) return null
  const createdAt = request.createdAt || request.submittedAt || request.fulfilledAt || null
  const priorityScore = request.priorityScore ?? request.aiScore ?? 0
  return {
    ...request,
    id: request.id || request._id || '',
    area: request.area || request.location || 'Unknown area',
    type: normalizeType(request.type || request.selectedNeed),
    urgency: normalizeUrgency(request.urgency || request.urgencyLevel),
    status: normalizeStatus(request.status),
    people: Number(request.people) || 1,
    aiScore: priorityScore,
    priorityScore,
    createdAt,
    submittedAt: formatRelativeTime(createdAt || request.submittedAt),
    description: request.description || request.notes || '',
    name: request.name || '',
  }
}

export function normalizeHeatmapPoint(point) {
  if (Array.isArray(point)) {
    return { lat: Number(point[0]) || 27.1767, lng: Number(point[1]) || 78.0081, intensity: Number(point[2]) || 0.3 }
  }
  const rawIntensity = Number(point?.intensity) || Number(point?.weight)
  const score = Number(point?.priorityScore ?? point?.aiScore)
  const scoreIntensity = Number.isFinite(score) ? Math.min(1, Math.max(0.2, score / 100)) : null
  return {
    ...point,
    lat: Number(point?.lat) || 27.1767,
    lng: Number(point?.lng) || 78.0081,
    intensity: rawIntensity || scoreIntensity || 0.3,
    type: normalizeType(point?.type),
  }
}

export function normalizeStats(stats) {
  if (!stats) return null
  return {
    ...stats,
    pending: stats.pending ?? stats.pendingCount ?? 0,
    pendingCount: stats.pendingCount ?? stats.pending ?? 0,
    critical: stats.critical ?? stats.criticalCount ?? 0,
    criticalCount: stats.criticalCount ?? stats.critical ?? 0,
  }
}

export function normalizeNgo(ngo) {
  if (!ngo) return null
  return {
    ...ngo,
    name: ngo.name || ngo.ngoName,
    available: ngo.available ?? ngo.availability?.quantity ?? 0,
    focus: Array.isArray(ngo.focus) ? ngo.focus : ngo.type || [],
  }
}

export function toApiNeedType(value) {
  const normalized = String(value || '').toUpperCase()
  const map = { MEDICAL: 'MEDICAL', FOOD: 'FOOD', SHELTER: 'SHELTER', EDUCATION: 'EDUCATION', CLOTHING: 'CLOTHING', WATER: 'WATER', RESCUE: 'RESCUE', TRANSPORT: 'OTHER', OTHER: 'OTHER' }
  return map[normalized] || 'OTHER'
}

export function toApiUrgency(value) {
  const normalized = String(value || '').toUpperCase()
  const map = { CRITICAL: 'CRITICAL', HIGH: 'URGENT', URGENT: 'URGENT', MEDIUM: 'NORMAL', NORMAL: 'NORMAL', LOW: 'NORMAL' }
  return map[normalized] || 'NORMAL'
}

// ── HTTP helper ──────────────────────────────────────────────
async function request(path, options = {}, transform = (data) => data) {
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    })
    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await response.json() : await response.text()
    if (!response.ok) {
      if (response.status === 401) {
        try {
          localStorage.removeItem('sahayak_token')
          localStorage.removeItem('sahayak_user')
        } catch {
          // ignore storage failures
        }
      }
      throw new Error((data && (data.error || data.message)) || `HTTP ${response.status}`)
    }
    return { data: transform(data), error: null }
  } catch (error) {
    console.error(`API error [${path}]`, error.message)
    return { data: null, error: error.message }
  }
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

// ── Unified API ──────────────────────────────────────────────
export const api = {
  // ── Auth (single JWT system) ─────────────────────────────
  signup: (payload) =>
    request('/api/auth/jwt/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyOTP: (payload) =>
    request('/api/auth/jwt/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resendOTP: (payload) =>
    request('/api/auth/jwt/resend-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    request('/api/auth/jwt/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: (token) =>
    request('/api/auth/jwt/me', {
      headers: authHeaders(token),
    }),

  logout: (token) =>
    request('/api/auth/jwt/logout', {
      method: 'POST',
      headers: authHeaders(token),
    }),

  // ── Triage ───────────────────────────────────────────────
  triage: (description, selectedNeed) =>
    request('/api/triage', {
      method: 'POST',
      body: JSON.stringify({ description, selectedNeed }),
    }),

  geocode: (query) =>
    request(`/api/geocode?query=${encodeURIComponent(query)}`),

  reverseGeocode: (lat, lng) =>
    request(`/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`),

  // ── Requests (public) ────────────────────────────────────
  submitRequest: (payload) =>
    request('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitHelpRequest: (token, payload) =>
    request('/api/help/request', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }),

  getRequests: (filters = {}) => {
    const params = new URLSearchParams(filters).toString()
    return request(`/api/requests${params ? `?${params}` : ''}`, {}, (data) =>
      Array.isArray(data) ? data.map(normalizeRequest).filter(Boolean) : [],
    )
  },

  updateStatus: (requestId, status) =>
    request(`/api/requests/${requestId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: String(status || '').toUpperCase() }),
    }),

  matchRequest: (requestId, ngoId) =>
    request('/api/match', {
      method: 'POST',
      body: JSON.stringify({ requestId, ngoId }),
    }),

  // ── User: My Requests ────────────────────────────────────
  getMyRequests: (token) =>
    request('/api/help/my-requests', {
      headers: authHeaders(token),
    }, (data) => ({
      ...data,
      requests: Array.isArray(data?.requests) ? data.requests.map(normalizeRequest).filter(Boolean) : [],
    })),

  // ── NGO ──────────────────────────────────────────────────
  getNGOs: (type) =>
    request(`/api/ngos${type ? `?type=${type}` : ''}`, {}, (data) =>
      Array.isArray(data) ? data.map(normalizeNgo).filter(Boolean) : [],
    ),

  getNgoBoard: (token) =>
    request('/api/help/ngo-board', {
      headers: authHeaders(token),
    }, (data) => ({
      ...data,
      requests: Array.isArray(data?.requests) ? data.requests.map(normalizeRequest).filter(Boolean) : [],
    })),

  getNgoRequests: (token, filters = {}) => {
    const params = new URLSearchParams(filters).toString()
    return request(
      `/api/ngo/requests${params ? `?${params}` : ''}`,
      { headers: authHeaders(token) },
      (data) => ({
        ...data,
        requests: Array.isArray(data?.requests) ? data.requests.map(normalizeRequest).filter(Boolean) : [],
      }),
    )
  },

  claimRequest: (token, requestId) =>
    request(`/api/help/request/${requestId}/claim`, {
      method: 'POST',
      headers: authHeaders(token),
    }),

  assignVolunteer: (token, requestId, volunteerId) =>
    request(`/api/help/request/${requestId}/assign`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ volunteerId }),
    }),

  fulfillRequest: (token, requestId) =>
    request(`/api/help/request/${requestId}/fulfill`, {
      method: 'PATCH',
      headers: authHeaders(token),
    }),

  getNgoVolunteers: (token) =>
    request('/api/auth/jwt/ngo/volunteers', {
      headers: authHeaders(token),
    }),

  getNgoInviteCode: (token) =>
    request('/api/auth/jwt/ngo/invite-code', {
      headers: authHeaders(token),
    }),

  addVolunteerToNgo: (token, volunteerId) =>
    request('/api/auth/jwt/ngo/add-volunteer', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ volunteerId }),
    }),

  updateNGOResources: (ngoId, quantity) =>
    request(`/api/ngos/${ngoId}/resources`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),

  saveNgoProfile: (token, payload) =>
    request('/api/help/ngo-profile', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }),

  // ── Volunteer ────────────────────────────────────────────
  getVolunteerMissions: (token) =>
    request('/api/help/volunteer-assignments', {
      headers: authHeaders(token),
    }),

  // ── Data ─────────────────────────────────────────────────
  getHeatmap: () =>
    request('/api/heatmap', {}, (data) => (Array.isArray(data) ? data.map(normalizeHeatmapPoint) : [])),

  getAnalytics: () =>
    request('/api/analytics', {}, (data) => ({
      ...data,
      stats: normalizeStats(data?.stats),
    })),

  getStats: () => request('/api/stats', {}, normalizeStats),

  // ── SMS (kept for backward compat) ───────────────────────
  simulateSMS: (phone, message) =>
    request('/api/sms/simulate', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    }),

  verifySMS: (phone, otp, lat, lng) =>
    request('/api/sms/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, lat, lng }),
    }),
}
