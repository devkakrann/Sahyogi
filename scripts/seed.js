/**
 * seed.js — Populate MongoDB with demo data
 * Run: node scripts/seed.js
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') })

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI
if (!mongoUri) {
  console.error('No MONGO_URI set. Check server/.env')
  process.exit(1)
}

// Import models
const UserSchema = new mongoose.Schema({
  fullName: String, phone: { type: String, unique: true }, email: String, passwordHash: String,
  role: String, area: String, verified: Boolean, verifiedAt: Date,
  people: Number, skills: [String], points: Number, badge: String, deliveries: Number,
  availableNow: Boolean, parentNgoId: mongoose.Schema.Types.ObjectId,
  orgName: String, regNumber: String, domains: [String], inviteCode: String,
  location: { type: { type: String }, coordinates: [Number] },
}, { timestamps: true })

const NGOProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  ngoName: String, servicesOffered: [String], priorityLevelsHandled: [String],
  availableNow: Boolean, coverageRadiusKm: Number,
  location: { type: { type: String }, coordinates: [Number] },
}, { timestamps: true })
NGOProfileSchema.index({ location: '2dsphere' })

const HelpRequestSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, name: String, phone: String, area: String, people: Number,
  selectedNeed: String, description: String, notes: String, requestedType: String,
  location: { type: { type: String }, coordinates: [Number] },
  aiCategory: String, urgencyLevel: String, confidenceScore: Number,
  aiSummary: String, aiAction: String, aiScore: Number, priorityScore: Number,
  matchedNgos: [mongoose.Schema.Types.ObjectId],
  assignedNgoId: mongoose.Schema.Types.ObjectId, assignedNgoName: String,
  assignedVolunteerId: mongoose.Schema.Types.ObjectId, assignedVolunteerName: String,
  status: String, claimedAt: Date, assignedAt: Date, fulfilledAt: Date,
  source: String, verified: Boolean,
}, { timestamps: true })
HelpRequestSchema.index({ location: '2dsphere' })

const User = mongoose.model('User', UserSchema)
const NGOProfile = mongoose.model('NGOProfile', NGOProfileSchema)
const HelpRequest = mongoose.model('HelpRequest', HelpRequestSchema)

async function seed() {
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB')

  // Clear existing demo data (optional — only clears demo accounts)
  const demoPhones = ['9000000001', '9000000002', '9000000003', '9000000004', '9000000005']
  await User.deleteMany({ phone: { $in: demoPhones } })

  const passwordHash = await bcrypt.hash('demo1234', 10)

  // ── Demo Users ──────────────────────────────────────────────
  const ngoUser = await User.create({
    fullName: 'Seva Bharti Admin',
    phone: '9000000003',
    passwordHash,
    role: 'ngo',
    area: 'Agra',
    verified: true,
    verifiedAt: new Date(),
    orgName: 'Seva Bharti Agra',
    regNumber: 'NGO-AGRA-001',
    domains: ['Food', 'Medical', 'Shelter'],
    inviteCode: 'SEVA2026',
  })

  const volunteerUser = await User.create({
    fullName: 'Arjun Sharma',
    phone: '9000000002',
    passwordHash,
    role: 'volunteer',
    area: 'Agra',
    verified: true,
    verifiedAt: new Date(),
    skills: ['Medical', 'Driving'],
    points: 2450,
    badge: 'gold',
    deliveries: 38,
    parentNgoId: ngoUser._id,
    availableNow: true,
  })

  const regularUser = await User.create({
    fullName: 'Razia Begum',
    phone: '9000000001',
    passwordHash,
    role: 'user',
    area: 'Tajganj, Agra',
    verified: true,
    verifiedAt: new Date(),
    people: 5,
  })

  // Extra volunteer
  const vol2 = await User.create({
    fullName: 'Priya Gupta',
    phone: '9000000004',
    passwordHash,
    role: 'volunteer',
    area: 'Agra',
    verified: true,
    verifiedAt: new Date(),
    skills: ['Cooking', 'Teaching'],
    points: 2100,
    badge: 'gold',
    deliveries: 31,
    parentNgoId: ngoUser._id,
    availableNow: true,
  })

  // Second NGO
  const ngo2 = await User.create({
    fullName: 'Health For All Admin',
    phone: '9000000005',
    passwordHash,
    role: 'ngo',
    area: 'Agra',
    verified: true,
    verifiedAt: new Date(),
    orgName: 'Health For All Foundation',
    regNumber: 'NGO-AGRA-002',
    domains: ['Medical', 'Rescue'],
    inviteCode: 'HLTH2026',
  })

  console.log('Demo users created')

  // ── NGO Profiles ──────────────────────────────────────────
  await NGOProfile.deleteMany({ userId: { $in: [ngoUser._id, ngo2._id] } })

  await NGOProfile.create({
    userId: ngoUser._id,
    ngoName: 'Seva Bharti Agra',
    servicesOffered: ['food', 'medical', 'shelter', 'water', 'clothing'],
    priorityLevelsHandled: ['medium', 'high', 'critical'],
    availableNow: true,
    coverageRadiusKm: 15,
    location: { type: 'Point', coordinates: [78.012, 27.178] },
  })

  await NGOProfile.create({
    userId: ngo2._id,
    ngoName: 'Health For All Foundation',
    servicesOffered: ['medical', 'rescue'],
    priorityLevelsHandled: ['high', 'critical'],
    availableNow: true,
    coverageRadiusKm: 20,
    location: { type: 'Point', coordinates: [78.025, 27.19] },
  })

  console.log('NGO profiles created')

  // ── Sample Help Requests ──────────────────────────────────
  await HelpRequest.deleteMany({ source: 'seed' })

  const sampleRequests = [
    { name: 'Razia Begum', phone: '9000000001', selectedNeed: 'food', urgencyLevel: 'critical', area: 'Tajganj, Agra', people: 5, lat: 27.1767, lng: 78.0081, description: 'Single mother with 4 children. No food for 2 days.', status: 'matched', assignedNgoId: ngoUser._id, assignedNgoName: 'Seva Bharti Agra' },
    { name: 'Balram Yadav', phone: '9100000001', selectedNeed: 'medical', urgencyLevel: 'critical', area: 'Lohamandi, Agra', people: 1, lat: 27.185, lng: 78.02, description: 'Elderly man needs diabetes medicine urgently.', status: 'assigned', assignedNgoId: ngo2._id, assignedNgoName: 'Health For All Foundation', assignedVolunteerId: volunteerUser._id, assignedVolunteerName: 'Arjun Sharma' },
    { name: 'Meera Devi', phone: '9100000002', selectedNeed: 'shelter', urgencyLevel: 'high', area: 'Sikandra, Agra', people: 6, lat: 27.192, lng: 77.99, description: 'Family displaced after landlord eviction.', status: 'pending' },
    { name: 'Suresh Kumar', phone: '9100000003', selectedNeed: 'food', urgencyLevel: 'high', area: 'Hari Parbat, Agra', people: 3, lat: 27.16, lng: 78.04, description: 'Lost daily wage job. Family with infant needs food.', status: 'pending' },
    { name: 'Prem Shankar', phone: '9100000004', selectedNeed: 'education', urgencyLevel: 'medium', area: 'Mathura City', people: 3, lat: 27.4924, lng: 77.6737, description: '3 children dropped out due to fees.', status: 'pending' },
    { name: 'Fatima Khatoon', phone: '9100000005', selectedNeed: 'medical', urgencyLevel: 'high', area: 'Kalindi Vihar, Agra', people: 2, lat: 27.2, lng: 78.03, description: 'Pregnant woman, 8 months. No prenatal care access.', status: 'matched', assignedNgoId: ngo2._id, assignedNgoName: 'Health For All Foundation' },
    { name: 'Ganesh Prasad', phone: '9100000006', selectedNeed: 'food', urgencyLevel: 'medium', area: 'Etmadpur, Agra', people: 8, lat: 27.15, lng: 77.98, description: 'Flood displaced family. Ration card missing.', status: 'fulfilled', assignedNgoId: ngoUser._id, assignedNgoName: 'Seva Bharti Agra', fulfilledAt: new Date(Date.now() - 86400000) },
  ]

  for (const r of sampleRequests) {
    const priorityScores = { critical: 90, high: 70, medium: 50, low: 30 }
    await HelpRequest.create({
      userId: regularUser._id,
      name: r.name,
      phone: r.phone,
      area: r.area,
      people: r.people,
      selectedNeed: r.selectedNeed,
      requestedType: r.selectedNeed.toUpperCase(),
      description: r.description,
      notes: r.description,
      location: { type: 'Point', coordinates: [r.lng, r.lat] },
      aiCategory: r.selectedNeed,
      urgencyLevel: r.urgencyLevel,
      confidenceScore: 0.85,
      aiSummary: `${r.selectedNeed.charAt(0).toUpperCase() + r.selectedNeed.slice(1)} support needed.`,
      aiScore: priorityScores[r.urgencyLevel] || 50,
      priorityScore: priorityScores[r.urgencyLevel] || 50,
      status: r.status,
      assignedNgoId: r.assignedNgoId,
      assignedNgoName: r.assignedNgoName,
      assignedVolunteerId: r.assignedVolunteerId,
      assignedVolunteerName: r.assignedVolunteerName,
      fulfilledAt: r.fulfilledAt,
      source: 'seed',
      verified: true,
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 3),
    })
  }

  console.log(`${sampleRequests.length} sample requests created`)

  console.log('\n=== SEED COMPLETE ===')
  console.log('Demo accounts:')
  console.log('  User:       phone=9000000001, password=demo1234')
  console.log('  Volunteer:  phone=9000000002, password=demo1234')
  console.log('  NGO Admin:  phone=9000000003, password=demo1234')
  console.log('  NGO invite code: SEVA2026')

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
