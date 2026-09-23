import { mockRequests, mockVolunteers } from '../data/mockData.js'

const STORAGE_KEY = 'sahayak_demo_store_v2'

function buildDemoRequests() {
  const now = Date.now()
  return mockRequests.map((req, index) => ({
    ...req,
    status: String(req.status || 'pending').toLowerCase(),
    notes: req.notes || req.description || '',
    createdAt: req.createdAt || new Date(now - (index + 1) * 3600000).toISOString(),
    priorityScore: req.priorityScore ?? req.aiScore ?? 0,
    assignedVolunteerId: req.assignedVolunteerId || null,
    assignedVolunteerName: req.assignedVolunteerName || null,
    assignedNgoId: req.assignedNgoId || null,
    assignedNgoName: req.assignedNgoName || null,
  }))
}

function buildDemoVolunteers() {
  const demoVolunteer = {
    id: 'DEMO-VOLUNTEER',
    fullName: 'Demo Volunteer',
    phone: '9000000002',
    skills: ['General'],
    availableNow: true,
    parentNgoId: 'DEMO-NGO',
  }

  const rest = mockVolunteers.map((vol, index) => ({
    id: vol.id,
    fullName: vol.name,
    phone: `90000000${String(index + 10).padStart(2, '0')}`,
    skills: ['General'],
    availableNow: true,
    parentNgoId: 'DEMO-NGO',
  }))

  const all = [demoVolunteer, ...rest]
  const seen = new Set()
  return all.filter((v) => {
    if (seen.has(v.id)) return false
    seen.add(v.id)
    return true
  })
}

function seedStore() {
  return {
    inviteCode: 'DEMO-NGO',
    volunteers: buildDemoVolunteers(),
    requests: buildDemoRequests(),
  }
}

function safeLoad() {
  if (typeof window === 'undefined') return seedStore()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedStore()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.requests) || !Array.isArray(parsed.volunteers)) {
      return seedStore()
    }
    return parsed
  } catch {
    return seedStore()
  }
}

function safeSave(store) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore storage errors
  }
}

export function getDemoStore() {
  const store = safeLoad()
  safeSave(store)
  return store
}

export function updateDemoRequests(updater) {
  const store = safeLoad()
  const nextRequests = updater(store.requests)
  const nextStore = { ...store, requests: nextRequests }
  safeSave(nextStore)
  return nextStore
}
