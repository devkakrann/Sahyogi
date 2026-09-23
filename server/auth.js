/**
 * auth.js — Complete role-based authentication
 * Handles signup, login, OTP for User / Volunteer / NGO Admin
 */
import express from 'express'
import crypto from 'crypto'

const router = express.Router()

// ── In-memory stores (replace with MongoDB in prod) ──────────
let users = []
let otpStore = {}  // { phone: { otp, expiresAt, userData } }

// Demo accounts (pre-seeded for judges) ───────────────────────
users = [
  {
    id: 'U001',
    name: 'Razia Begum',
    phone: '9000000001',
    password: hashPassword('demo1234'),
    role: 'user',
    area: 'Tajganj, Agra',
    people: 5,
    createdAt: new Date(),
  },
  {
    id: 'V001',
    name: 'Arjun Sharma',
    phone: '9000000002',
    password: hashPassword('demo1234'),
    role: 'volunteer',
    area: 'Agra',
    skills: ['Medical', 'Driving'],
    points: 0,
    badge: 'starter',
    deliveries: 0,
    createdAt: new Date(),
  },
  {
    id: 'N001',
    name: 'Seva Bharti Admin',
    phone: '9000000003',
    password: hashPassword('demo1234'),
    role: 'ngo',
    orgName: 'Seva Bharti Agra',
    regNumber: 'NGO-AGRA-001',
    domains: ['Food', 'Medical', 'Shelter'],
    area: 'Agra',
    createdAt: new Date(),
  },
]

// ── Helpers ───────────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function generateToken(user) {
  // Simple token for demo — use JWT in production
  const payload = { id: user.id, role: user.role, name: user.name }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

function verifyToken(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString())
  } catch {
    return null
  }
}

function getFast2SmsApiKey() {
  return process.env.FAST2SMS_KEY
}

async function sendOtpViaFast2Sms(phone, otp) {
  const apiKey = getFast2SmsApiKey()
  if (!apiKey) {
    throw new Error('FAST2SMS_KEY is not configured')
  }

  const message = `Sahayak OTP is ${otp}. Valid for 5 minutes.`
  const fast2SmsUrl = new URL('https://www.fast2sms.com/dev/bulkV2')
  fast2SmsUrl.searchParams.set('authorization', apiKey)
  fast2SmsUrl.searchParams.set('route', 'q')
  fast2SmsUrl.searchParams.set('message', message)
  fast2SmsUrl.searchParams.set('numbers', phone)
  fast2SmsUrl.searchParams.set('flash', '0')

  const response = await fetch(fast2SmsUrl, { method: 'GET' })
  const raw = await response.text()

  let result = {}
  try {
    result = raw ? JSON.parse(raw) : {}
  } catch {
    result = {}
  }

  if (!response.ok) {
    throw new Error(result?.message || `Fast2SMS HTTP ${response.status}`)
  }
  if (result?.return !== true) {
    throw new Error(result?.message || 'Fast2SMS request failed')
  }
}

// ── MIDDLEWARE: protect routes by role ────────────────────────
export function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Login required' })

    const user = verifyToken(token)
    if (!user) return res.status(401).json({ error: 'Invalid token' })

    if (roles.length > 0 && !roles.includes(user.role)) {
      return res.status(403).json({
        error: `Access denied. This page requires ${roles.join(' or ')} role.`,
        requiredRole: roles,
        yourRole: user.role,
      })
    }

    req.user = user
    next()
  }
}

export function getAuthStats() {
  return {
    users: users.length,
    pendingOtps: Object.keys(otpStore).length,
  }
}

export function getAuthUserById(userId) {
  if (!userId) return null
  return users.find((user) => String(user.id) === String(userId)) || null
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/signup
// Body: { name, phone, password, role, area, skills?, domains?, orgName?, regNumber? }
// ─────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { name, phone, password, role, area, skills, domains, orgName, regNumber, people } = req.body

  // Validation
  if (!name || !phone || !password || !role) {
    return res.status(400).json({ error: 'Name, phone, password and role are required' })
  }
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone must be exactly 10 digits' })
  }
  if (!['user', 'volunteer', 'ngo'].includes(role)) {
    return res.status(400).json({ error: 'Role must be user, volunteer, or ngo' })
  }
  if (users.find((u) => u.phone === phone)) {
    return res.status(409).json({ error: 'This phone number is already registered' })
  }

  // Role-specific validation
  if (role === 'ngo' && (!orgName || !regNumber)) {
    return res.status(400).json({ error: 'Organization name and registration number required for NGO' })
  }
  if (role === 'ngo' && (!Array.isArray(domains) || domains.length === 0)) {
    return res.status(400).json({ error: 'Select at least one NGO domain' })
  }

  const normalizedDomains = Array.isArray(domains)
    ? [...new Set(domains.map((item) => String(item || '').trim()).filter(Boolean))]
    : []

  // Generate and store OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString()
  otpStore[phone] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    userData: {
      name,
      phone,
      password: hashPassword(password),
      role,
      area,
      skills,
      domains: normalizedDomains,
      orgName,
      regNumber,
      people,
    },
  }

  const fast2SmsApiKey = getFast2SmsApiKey()
  if (fast2SmsApiKey) {
    try {
      await sendOtpViaFast2Sms(phone, otp)
      return res.json({
        success: true,
        message: 'OTP sent to your phone',
        phone,
      })
    } catch (error) {
      delete otpStore[phone]
      return res.status(502).json({ error: `Failed to send OTP SMS: ${error.message}` })
    }
  }

  console.log(`OTP for ${phone}: ${otp}`)
  return res.json({
    success: true,
    message: 'OTP generated (dev mode). FAST2SMS_KEY is not configured.',
    otp,
    phone,
  })
})
// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Body: { phone, otp }
// ─────────────────────────────────────────────────────────────
router.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body

  const stored = otpStore[phone]
  if (!stored) {
    return res.status(400).json({ error: 'No OTP found. Please sign up first.' })
  }
  if (Date.now() > stored.expiresAt) {
    delete otpStore[phone]
    return res.status(400).json({ error: 'OTP expired. Please try again.' })
  }

  const allowDemoOtp = !getFast2SmsApiKey()
  const enteredOtp = String(otp || '').trim()
  const isValidOtp = stored.otp === enteredOtp || (allowDemoOtp && enteredOtp === '1234')
  if (!isValidOtp) {
    return res.status(400).json({ error: 'Wrong OTP. Try again.' })
  }

  // Create user account
  const newUser = {
    id: `${stored.userData.role.toUpperCase()[0]}${Date.now()}`,
    ...stored.userData,
    // Role-specific defaults
    ...(stored.userData.role === 'volunteer' && {
      points: 0, badge: 'starter', deliveries: 0,
    }),
    ...(stored.userData.role === 'ngo' && {
      resources: { food: 100, medical: 20, shelter: 10 },
    }),
    createdAt: new Date(),
  }

  users.push(newUser)
  delete otpStore[phone]

  const token = generateToken(newUser)
  console.log(`Account created: ${newUser.name} (${newUser.role})`)

  res.json({
    success: true,
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      phone: newUser.phone,
      role: newUser.role,
      area: newUser.area,
      ...(newUser.role === 'ngo' && { orgName: newUser.orgName, domains: newUser.domains || [] }),
    },
    redirectTo: getRedirectPath(newUser.role),
    message: `Welcome to Sahayak, ${newUser.name}!`,
  })
})
// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { phone, password, role }
// ─────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { phone, password, role } = req.body

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' })
  }

  const user = users.find(u => u.phone === phone)

  if (!user) {
    return res.status(404).json({ error: 'No account found with this phone number. Please sign up.' })
  }
  if (user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Wrong password. Please try again.' })
  }

  // Role mismatch warning
  if (role && user.role !== role) {
    return res.status(403).json({
      error: `This account is registered as ${user.role}, not ${role}. Please select the correct role.`,
      actualRole: user.role,
    })
  }

  const token = generateToken(user)
  console.log(`🔐 Login: ${user.name} (${user.role})`)

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      area: user.area,
      // Role-specific data
      ...(user.role === 'volunteer' && {
        points: user.points,
        badge: user.badge,
        deliveries: user.deliveries,
      }),
      ...(user.role === 'ngo' && {
        orgName: user.orgName,
        domains: user.domains || [],
      }),
    },
    redirectTo: getRedirectPath(user.role),
  })
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/resend-otp
// ─────────────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  const { phone } = req.body
  const stored = otpStore[phone]

  if (!stored) return res.status(400).json({ error: 'No pending signup for this number' })

  const newOtp = Math.floor(1000 + Math.random() * 9000).toString()
  stored.otp = newOtp
  stored.expiresAt = Date.now() + 5 * 60 * 1000

  const fast2SmsApiKey = getFast2SmsApiKey()
  if (fast2SmsApiKey) {
    try {
      await sendOtpViaFast2Sms(phone, newOtp)
      return res.json({ success: true, message: 'OTP resent' })
    } catch (error) {
      return res.status(502).json({ error: `Failed to resend OTP SMS: ${error.message}` })
    }
  }

  console.log(`Resent OTP for ${phone}: ${newOtp}`)
  return res.json({ success: true, otp: newOtp, message: 'OTP resent (dev mode)' })
})
// ─────────────────────────────────────────────────────────────
// GET /api/auth/me — get current user from token
// ─────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not logged in' })

  const decoded = verifyToken(token)
  if (!decoded) return res.status(401).json({ error: 'Invalid token' })

  const user = users.find(u => u.id === decoded.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  res.json({
    id: user.id, name: user.name,
    phone: user.phone, role: user.role, area: user.area,
    ...(user.role === 'volunteer' && { points: user.points, badge: user.badge, deliveries: user.deliveries }),
    ...(user.role === 'ngo' && { orgName: user.orgName, domains: user.domains || [] }),
  })
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout — client just deletes token, but we log it
// ─────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' })
})

// ── Helper: where to send each role after login ───────────────
function getRedirectPath(role) {
  const paths = {
    user: '/request',
    volunteer: '/volunteer-dashboard',
    ngo: '/ngo-dashboard',
  }
  return paths[role] || '/home'
}

export default router

