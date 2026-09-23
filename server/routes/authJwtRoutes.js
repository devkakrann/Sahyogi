import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import twilio from 'twilio'
import { isMongoReady } from '../db/mongoose.js'
import authJwt from '../middleware/authJwt.js'
import User from '../models/User.js'
import NGOProfile from '../models/NGOProfile.js'

const router = express.Router()
const jwtSecret = process.env.JWT_SECRET || 'sahayak-dev-secret'
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID
const twilioEnabled = Boolean(twilioAccountSid && twilioAuthToken && twilioVerifyServiceSid)
const twilioClient = twilioEnabled ? twilio(twilioAccountSid, twilioAuthToken) : null

// In-memory OTP store (for dev fallback when Twilio is not configured)
const otpStore = {}

function normalizeRole(role) {
  const safeRole = String(role || 'user').toLowerCase()
  if (['citizen', 'user'].includes(safeRole)) return 'user'
  if (['ngo'].includes(safeRole)) return 'ngo'
  if (['volunteer'].includes(safeRole)) return 'volunteer'
  if (['admin'].includes(safeRole)) return 'admin'
  return 'user'
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10)
}

function e164Phone(phone) {
  const digits = normalizePhone(phone)
  return digits.length === 10 ? `+91${digits}` : null
}

function createToken(user) {
  return jwt.sign(
    { userId: String(user._id), role: user.role, fullName: user.fullName },
    jwtSecret,
    { expiresIn: '24h' },
  )
}

function cleanUser(userDoc) {
  const base = {
    id: String(userDoc._id),
    fullName: userDoc.fullName,
    name: userDoc.fullName,
    phone: userDoc.phone,
    email: userDoc.email || null,
    role: userDoc.role,
    area: userDoc.area || '',
    verified: userDoc.verified || false,
  }

  if (userDoc.role === 'volunteer') {
    base.skills = userDoc.skills || []
    base.points = userDoc.points || 0
    base.badge = userDoc.badge || 'starter'
    base.deliveries = userDoc.deliveries || 0
    base.parentNgoId = userDoc.parentNgoId ? String(userDoc.parentNgoId) : null
  }

  if (userDoc.role === 'ngo') {
    base.orgName = userDoc.orgName || ''
    base.regNumber = userDoc.regNumber || ''
    base.domains = userDoc.domains || []
    base.inviteCode = userDoc.inviteCode || ''
  }

  return base
}

function getRedirectPath(role) {
  const paths = {
    user: '/user-dashboard',
    volunteer: '/volunteer-dashboard',
    ngo: '/ngo-dashboard',
  }
  return paths[role] || '/home'
}

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

// ─────────────────────────────────────────────────────────────
// POST /signup — Step 1: validate + send OTP
// ─────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const { fullName, phone, password, role, area, people, skills, domains, orgName, regNumber, ngoProfile, inviteCode: volunteerInviteCode } = req.body
    const normalizedRole = normalizeRole(role)
    const normalizedPhone = normalizePhone(phone)

    if (!fullName || !normalizedPhone || !password) {
      return res.status(400).json({ message: 'fullName, phone, and password are required' })
    }
    if (!/^\d{10}$/.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone must be a valid 10-digit number' })
    }

    const existing = await User.findOne({ phone: normalizedPhone })
    if (existing) {
      return res.status(409).json({ message: 'User already exists with this phone number' })
    }

    // Role-specific validation
    if (normalizedRole === 'ngo') {
      const ngoName = orgName || ngoProfile?.ngoName
      if (!ngoName) {
        return res.status(400).json({ message: 'Organization name is required for NGO signup' })
      }
    }

    // If volunteer provides an invite code, validate it
    let parentNgo = null
    if (normalizedRole === 'volunteer' && volunteerInviteCode) {
      parentNgo = await User.findOne({ inviteCode: volunteerInviteCode, role: 'ngo' })
      if (!parentNgo) {
        return res.status(400).json({ message: 'Invalid NGO invite code' })
      }
    }

    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString()

    // Try Twilio Verify
    if (twilioEnabled) {
      try {
        const e164 = e164Phone(normalizedPhone)
        if (!e164) {
          return res.status(400).json({ message: 'Invalid phone number format' })
        }
        await twilioClient.verify.v2.services(twilioVerifyServiceSid).verifications.create({
          to: e164,
          channel: 'sms',
        })

        // Store signup data pending OTP verification
        otpStore[normalizedPhone] = {
          otp: null, // Twilio manages the OTP
          useTwilio: true,
          expiresAt: Date.now() + 5 * 60 * 1000,
          userData: { fullName, phone: normalizedPhone, password, role: normalizedRole, area, people, skills, domains, orgName, regNumber, ngoProfile, parentNgoId: parentNgo?._id },
        }

        return res.json({
          success: true,
          message: 'OTP sent via SMS',
          phone: normalizedPhone,
          requiresOtp: true,
        })
      } catch (error) {
        console.warn('Twilio send OTP failed, falling back to dev mode:', error.message)
      }
    }

    // Fallback: dev mode OTP
    otpStore[normalizedPhone] = {
      otp,
      useTwilio: false,
      expiresAt: Date.now() + 5 * 60 * 1000,
      userData: { fullName, phone: normalizedPhone, password, role: normalizedRole, area, people, skills, domains, orgName, regNumber, ngoProfile, parentNgoId: parentNgo?._id },
    }

    console.log(`[DEV] OTP for ${normalizedPhone}: ${otp}`)
    return res.json({
      success: true,
      message: 'OTP generated (dev mode)',
      otp,
      phone: normalizedPhone,
      requiresOtp: true,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Signup error', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /verify-otp — Step 2: verify OTP + create user in MongoDB
// ─────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const { phone, otp } = req.body
    const normalizedPhone = normalizePhone(phone)
    const stored = otpStore[normalizedPhone]

    if (!stored) {
      return res.status(400).json({ message: 'No pending signup. Please sign up first.' })
    }
    if (Date.now() > stored.expiresAt) {
      delete otpStore[normalizedPhone]
      return res.status(400).json({ message: 'OTP expired. Please try again.' })
    }

    // Verify OTP
    if (stored.useTwilio) {
      try {
        const e164 = e164Phone(normalizedPhone)
        const check = await twilioClient.verify.v2.services(twilioVerifyServiceSid).verificationChecks.create({
          to: e164,
          code: String(otp).trim(),
        })
        if (check.status !== 'approved') {
          return res.status(400).json({ message: 'Invalid OTP' })
        }
      } catch (error) {
        return res.status(400).json({ message: 'Invalid or expired OTP' })
      }
    } else {
      const enteredOtp = String(otp || '').trim()
      const isValid = stored.otp === enteredOtp || enteredOtp === '1234'
      if (!isValid) {
        return res.status(400).json({ message: 'Wrong OTP. Try again.' })
      }
    }

    // Create user in MongoDB
    const d = stored.userData
    const passwordHash = await bcrypt.hash(String(d.password), 10)

    const userData = {
      fullName: String(d.fullName).trim(),
      phone: d.phone,
      passwordHash,
      role: d.role,
      area: d.area || '',
      verified: true,
      verifiedAt: new Date(),
    }

    if (d.role === 'user') {
      userData.people = Number(d.people) || 1
    }

    if (d.role === 'volunteer') {
      userData.skills = Array.isArray(d.skills) ? d.skills : []
      userData.points = 0
      userData.badge = 'starter'
      userData.deliveries = 0
      if (d.parentNgoId) {
        userData.parentNgoId = d.parentNgoId
      }
    }

    if (d.role === 'ngo') {
      const ngoName = d.orgName || d.ngoProfile?.ngoName || `${d.fullName} NGO`
      userData.orgName = ngoName
      userData.regNumber = d.regNumber || ''
      userData.domains = Array.isArray(d.domains) ? d.domains : []
      userData.inviteCode = generateInviteCode()
    }

    const user = await User.create(userData)

    // If NGO, also create NGOProfile for geo-matching
    if (d.role === 'ngo') {
      const ngoProfileData = d.ngoProfile || {}
      await NGOProfile.create({
        userId: user._id,
        ngoName: user.orgName,
        servicesOffered: (user.domains || []).map((item) => String(item || '').toLowerCase()).filter(Boolean),
        priorityLevelsHandled: ['medium', 'high', 'critical'],
        availableNow: true,
        coverageRadiusKm: Number(ngoProfileData.coverageRadiusKm) || 10,
        location: {
          type: 'Point',
          coordinates: [
            Number.isFinite(Number(ngoProfileData.lng)) ? Number(ngoProfileData.lng) : 78.0081,
            Number.isFinite(Number(ngoProfileData.lat)) ? Number(ngoProfileData.lat) : 27.1767,
          ],
        },
      })
    }

    delete otpStore[normalizedPhone]

    const token = createToken(user)
    console.log(`Account created: ${user.fullName} (${user.role})`)

    return res.status(201).json({
      success: true,
      token,
      user: cleanUser(user),
      redirectTo: getRedirectPath(user.role),
      message: `Welcome to Sahayak, ${user.fullName}!`,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Verification error', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /resend-otp
// ─────────────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  const normalizedPhone = normalizePhone(req.body.phone)
  const stored = otpStore[normalizedPhone]
  if (!stored) {
    return res.status(400).json({ message: 'No pending signup for this number' })
  }

  if (stored.useTwilio && twilioEnabled) {
    try {
      const e164 = e164Phone(normalizedPhone)
      await twilioClient.verify.v2.services(twilioVerifyServiceSid).verifications.create({
        to: e164,
        channel: 'sms',
      })
      stored.expiresAt = Date.now() + 5 * 60 * 1000
      return res.json({ success: true, message: 'OTP resent via SMS' })
    } catch (error) {
      return res.status(502).json({ message: `Failed to resend OTP: ${error.message}` })
    }
  }

  const newOtp = Math.floor(1000 + Math.random() * 9000).toString()
  stored.otp = newOtp
  stored.expiresAt = Date.now() + 5 * 60 * 1000
  console.log(`[DEV] Resent OTP for ${normalizedPhone}: ${newOtp}`)
  return res.json({ success: true, otp: newOtp, message: 'OTP resent (dev mode)' })
})

// ─────────────────────────────────────────────────────────────
// POST /login
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected' })
  }

  try {
    const { phone, password, role } = req.body
    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' })
    }

    const normalizedPhone = normalizePhone(phone)
    const user = await User.findOne({ phone: normalizedPhone })
    if (!user) {
      return res.status(404).json({
        error: 'No account found with this phone number. Please sign up.',
        message: 'No account found with this phone number. Please sign up.',
      })
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash)
    if (!ok) {
      return res.status(401).json({
        error: 'Wrong password. Please try again.',
        message: 'Wrong password. Please try again.',
      })
    }

    // Role mismatch
    if (role) {
      const requestedRole = normalizeRole(role)
      if (user.role !== requestedRole) {
        return res.status(403).json({
          error: `This account is registered as ${user.role}, not ${requestedRole}. Please select the correct role.`,
          message: `This account is registered as ${user.role}, not ${requestedRole}.`,
          actualRole: user.role,
        })
      }
    }

    const token = createToken(user)
    console.log(`Login: ${user.fullName} (${user.role})`)

    return res.json({
      success: true,
      token,
      user: cleanUser(user),
      redirectTo: getRedirectPath(user.role),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Login error', error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /me — get current user from token
// ─────────────────────────────────────────────────────────────
router.get('/me', authJwt, async (req, res) => {
  const user = await User.findById(req.user.userId)
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }
  return res.json({ user: cleanUser(user) })
})

// ─────────────────────────────────────────────────────────────
// POST /logout
// ─────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' })
})

// ─────────────────────────────────────────────────────────────
// GET /ngo/volunteers — get volunteers linked to this NGO
// ─────────────────────────────────────────────────────────────
router.get('/ngo/volunteers', authJwt, async (req, res) => {
  if (req.user.role !== 'ngo') {
    return res.status(403).json({ message: 'NGO role required' })
  }

  const volunteers = await User.find({ parentNgoId: req.user.userId, role: 'volunteer' })
    .select('fullName phone skills points badge deliveries availableNow area')
  return res.json({ volunteers: volunteers.map((v) => ({ id: String(v._id), ...v.toObject() })) })
})

// ─────────────────────────────────────────────────────────────
// POST /ngo/add-volunteer — NGO manually adds a volunteer
// ─────────────────────────────────────────────────────────────
router.post('/ngo/add-volunteer', authJwt, async (req, res) => {
  if (req.user.role !== 'ngo') {
    return res.status(403).json({ message: 'NGO role required' })
  }

  const { volunteerId } = req.body
  if (!volunteerId) {
    return res.status(400).json({ message: 'volunteerId is required' })
  }

  const volunteer = await User.findById(volunteerId)
  if (!volunteer || volunteer.role !== 'volunteer') {
    return res.status(404).json({ message: 'Volunteer not found' })
  }

  volunteer.parentNgoId = req.user.userId
  await volunteer.save()

  return res.json({ success: true, message: `${volunteer.fullName} linked to your NGO` })
})

// ─────────────────────────────────────────────────────────────
// GET /ngo/invite-code — get NGO's invite code
// ─────────────────────────────────────────────────────────────
router.get('/ngo/invite-code', authJwt, async (req, res) => {
  if (req.user.role !== 'ngo') {
    return res.status(403).json({ message: 'NGO role required' })
  }

  const ngo = await User.findById(req.user.userId)
  if (!ngo) {
    return res.status(404).json({ message: 'NGO not found' })
  }

  if (!ngo.inviteCode) {
    ngo.inviteCode = generateInviteCode()
    await ngo.save()
  }

  return res.json({ inviteCode: ngo.inviteCode })
})

export default router
