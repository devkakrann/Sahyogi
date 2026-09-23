import https from 'https'

const geocodeCache = new Map()

async function fetchJson(url) {
  if (typeof fetch === 'function') {
    const response = await fetch(url)
    if (!response.ok) return null
    return response.json()
  }

  return new Promise((resolve) => {
    https
      .get(url.toString(), (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume()
          resolve(null)
          return
        }
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch {
            resolve(null)
          }
        })
      })
      .on('error', () => resolve(null))
  })
}

export async function geocodeArea(area) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
  const query = String(area || '').trim()
  if (!apiKey || !query) return null

  const cacheKey = query.toLowerCase()
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey)

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', query)
    if (process.env.GOOGLE_MAPS_GEOCODE_REGION) {
      url.searchParams.set('region', process.env.GOOGLE_MAPS_GEOCODE_REGION)
    }
    url.searchParams.set('key', apiKey)

    const data = await fetchJson(url)
    if (!data) return null
    const location = data?.results?.[0]?.geometry?.location
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return null
    }

    const result = { lat: location.lat, lng: location.lng }
    geocodeCache.set(cacheKey, result)
    return result
  } catch {
    return null
  }
}

export async function reverseGeocode(lat, lng) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!apiKey || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('latlng', `${latNum},${lngNum}`)
    url.searchParams.set('key', apiKey)

    const data = await fetchJson(url)
    if (!data) return null
    const result = data?.results?.[0]
    if (!result) return null

    const components = result.address_components || []
    const postal = components.find((c) => Array.isArray(c.types) && c.types.includes('postal_code'))
    return {
      address: result.formatted_address || '',
      pincode: postal?.long_name || '',
      lat: latNum,
      lng: lngNum,
    }
  } catch {
    return null
  }
}
