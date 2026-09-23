import { PINCODE_DIRECTORY } from './pincodeDirectory.js'
import upDistrictData from './upDistrictData.json'

const pinIndex = new Map()
const districtIndex = new Map()

upDistrictData.forEach((entry) => {
  const pinKey = String(entry.pin || '').trim()
  if (pinKey) pinIndex.set(pinKey, entry)
  const districtKey = String(entry.district || '').trim().toLowerCase()
  if (districtKey) districtIndex.set(districtKey, entry)
})

const COORDS_CACHE_KEY = 'sahayak_pin_coords'

function readCoordsCache() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(COORDS_CACHE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeCoordsCache(next) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COORDS_CACHE_KEY, JSON.stringify(next))
  } catch {
    // ignore storage failures
  }
}

export function cacheCoordsForPin(pin, coords) {
  const key = String(pin || '').trim()
  if (!key || !coords?.lat || !coords?.lng) return
  const cache = readCoordsCache()
  cache[key] = { lat: Number(coords.lat), lng: Number(coords.lng) }
  writeCoordsCache(cache)
}

export function getDistrictForPin(pin) {
  const key = String(pin || '').trim()
  if (!key) return null
  if (pinIndex.has(key)) return pinIndex.get(key).district

  const entry = PINCODE_DIRECTORY[key]
  if (entry?.label) {
    const parts = entry.label.split(',').map((part) => part.trim()).filter(Boolean)
    if (parts.length > 1) return parts[parts.length - 1]
  }

  return null
}

export function getZoneFromPin(pin) {
  const entry = findClosestPinEntry(pin)
  if (!entry) return null
  return Number(entry.zone) || null
}

export function findClosestPinEntry(pin) {
  const pinValue = Number(pin)
  if (!Number.isFinite(pinValue)) return null
  let min = Infinity
  let result = null
  upDistrictData.forEach((entry) => {
    const base = Number(entry.pin)
    if (!Number.isFinite(base)) return
    const diff = Math.abs(pinValue - base)
    if (diff < min) {
      min = diff
      result = entry
    }
  })
  return result
}

export function getCoordsForPin(pin) {
  const key = String(pin || '').trim()
  const cache = readCoordsCache()
  if (cache[key]?.lat && cache[key]?.lng) {
    return { lat: Number(cache[key].lat), lng: Number(cache[key].lng) }
  }

  const exact = pinIndex.get(key)
  if (exact?.lat && exact?.lng) {
    return { lat: Number(exact.lat), lng: Number(exact.lng) }
  }

  const closest = findClosestPinEntry(key)
  if (closest?.lat && closest?.lng) {
    return { lat: Number(closest.lat), lng: Number(closest.lng) }
  }

  return null
}

export function getLabelForPin(pin) {
  const key = String(pin || '').trim()
  const entry = PINCODE_DIRECTORY[key]
  if (entry?.label) return entry.label
  const closest = findClosestPinEntry(key)
  if (closest?.district) return `${closest.district}, Uttar Pradesh`
  const district = getDistrictForPin(pin)
  return district || ''
}

export function getZoneLabelForPin(pin) {
  const zone = getZoneFromPin(pin)
  return zone ? `Zone ${zone}` : ''
}
