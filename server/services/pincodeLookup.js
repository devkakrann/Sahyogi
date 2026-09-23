const PINCODE_COORDS = {
  // Ghaziabad H.O. (approximate city center)
  '201002': { lat: 28.6692, lng: 77.4538, label: 'Ghaziabad' },
}

export function getPincodeCoords(pincode) {
  const key = String(pincode || '').trim()
  return PINCODE_COORDS[key] || null
}

export function extractPincode(text) {
  const match = String(text || '').match(/\b\d{6}\b/)
  return match ? match[0] : null
}
