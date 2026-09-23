import { useMemo, useState, useEffect, useRef } from 'react'
import { api, toApiNeedType } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { cacheCoordsForPin, getCoordsForPin, getLabelForPin, getZoneFromPin } from '../data/zonesData.js'
import { updateDemoRequests } from '../services/demoStore.js'

const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
const VOICE_LANGS = [
  { value: 'en-IN', label: 'English (IN)' },
  { value: 'hi-IN', label: 'Hindi (IN)' },
]

const needOptions = [
  { value: 'Food', label: 'Food', icon: 'restaurant', tint: 'secondary' },
  { value: 'Medical', label: 'Medical', icon: 'emergency', tint: 'tertiary' },
  { value: 'Shelter', label: 'Shelter', icon: 'home', tint: 'blue' },
  { value: 'Water', label: 'Water', icon: 'water_drop', tint: 'cyan' },
  { value: 'Rescue', label: 'Rescue', icon: 'handshake', tint: 'purple' },
  { value: 'Education', label: 'Education', icon: 'school', tint: 'green' },
]

const SUGGESTION_CHIPS = {
  food: ['No Food', 'Child Hungry', 'Elderly', 'Pregnant', 'No Power', 'Stranded'],
  medical: ['Injury', 'Pregnant', 'Elderly', 'No Medicine', 'Bleeding', 'Unconscious'],
  shelter: ['Homeless', 'House Damaged', 'Evacuation', 'Family Displaced', 'Night Shelter', 'Rain'],
  water: ['No Water', 'Contaminated', 'Rising Water', 'Flooded', 'Dehydration', 'Shortage'],
  rescue: ['Trapped', 'Collapse', 'Fire', 'Missing', 'Vehicle Stuck', 'Emergency'],
  education: ['Fees Due', 'No Books', 'School Closed', 'Uniforms', 'Scholarship', 'Child Alone'],
  other: ['Trapped', 'Rising Water', 'No Power', 'Injury', 'No Food', 'Pregnant', 'Elderly', 'Child Alone', 'Fire', 'Collapse'],
}

function normalizeNeedLabel(value) {
  const normalized = String(value || '').toLowerCase().trim()
  if (normalized === 'medical') return 'medical'
  if (normalized === 'shelter') return 'shelter'
  if (normalized === 'water') return 'water'
  if (normalized === 'rescue') return 'rescue'
  if (normalized === 'education') return 'education'
  if (normalized === 'food') return 'food'
  return 'other'
}

const initialForm = {
  name: '',
  phone: '',
  type: '',
  location: '',
  pincode: '',
  people: '1',
  notes: '',
}

async function getCoordinates() {
  if (!navigator.geolocation) return null

  return new Promise((resolve) => {
    let done = false
    const finish = (value) => {
      if (!done) {
        done = true
        resolve(value)
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => finish({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 60000 },
    )

    setTimeout(() => finish(null), 2200)
  })
}

function getNeedTone(tint) {
  if (tint === 'secondary') return 'need-tone need-tone-food'
  if (tint === 'tertiary') return 'need-tone need-tone-medical'
  if (tint === 'blue') return 'need-tone need-tone-shelter'
  if (tint === 'cyan') return 'need-tone need-tone-water'
  if (tint === 'purple') return 'need-tone need-tone-rescue'
  return 'need-tone need-tone-education'
}

function urgencyBadgeClasses(urgency) {
  const value = String(urgency || '').toLowerCase()
  if (value === 'critical') return 'bg-tertiary-container text-on-tertiary-container'
  if (value === 'urgent' || value === 'high') return 'bg-secondary-container text-on-secondary-fixed'
  return 'bg-primary-container text-on-primary-container'
}

function urgencyToIntensity(urgency) {
  const value = String(urgency || '').toLowerCase()
  if (value === 'critical') return 1.0
  if (value === 'urgent' || value === 'high') return 0.7
  if (value === 'low') return 0.2
  return 0.4
}

export default function RequestForm({ navigate, onPreviewLocation, onPreviewZone }) {
  const { user, getToken } = useAuth()

  const [form, setForm] = useState({
    ...initialForm,
    name: user?.fullName || user?.name || '',
    phone: user?.phone || '',
    location: user?.location || user?.area || '',
    pincode: user?.pincode || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceLang, setVoiceLang] = useState('en-IN')
  const [voiceInterim, setVoiceInterim] = useState('')
  const [voiceFinal, setVoiceFinal] = useState('')
  const recognitionRef = useRef(null)
  const voiceBaseRef = useRef('')
  const silenceTimerRef = useRef(null)
  const maxTimerRef = useRef(null)
  const previewTimerRef = useRef(null)
  const lastPreviewRef = useRef('')
  const lastPreviewCoordsRef = useRef(null)
  const lastAutoLocationRef = useRef({ pin: null, value: '' })

  useEffect(() => {
    const description = String(form.notes || '').trim()
    if (!form.type || description.length < 8) {
      return undefined
    }

    const timer = setTimeout(async () => {
      setAnalysisLoading(true)
      const { data } = await api.triage(description, toApiNeedType(form.type))
      if (data) {
        setAnalysis({
          urgency: data.urgency,
          category: data.category,
          summary: data.summary,
          action: data.action,
          aiScore: data.aiScore,
          responseTime: data.response_time,
        })
      }
      setAnalysisLoading(false)
    }, 420)

    return () => clearTimeout(timer)
  }, [form.notes, form.type])

  const previewIntensity = useMemo(
    () => urgencyToIntensity(success?.urgency || analysis?.urgency),
    [analysis?.urgency, success?.urgency],
  )

  useEffect(() => {
    const pincode = String(form.pincode || '').trim()
    if (!/^\d{6}$/.test(pincode)) return
    const label = getLabelForPin(pincode)
    if (!label) return

    setForm((current) => {
      const currentLocation = String(current.location || '').trim()
      const lastAuto = lastAutoLocationRef.current
      const shouldReplace = !currentLocation || currentLocation === lastAuto.value || lastAuto.pin === pincode
      if (!shouldReplace) return current

      lastAutoLocationRef.current = { pin: pincode, value: label }
      return { ...current, location: label }
    })
  }, [form.pincode])

  useEffect(() => {
    if (!onPreviewLocation) return undefined

    const location = String(form.location || '').trim()
    const pincode = String(form.pincode || '').trim()
    const validPin = /^\d{6}$/.test(pincode)
    const hasLocation = location.length >= 3
    const query = [hasLocation ? location : '', validPin ? pincode : ''].filter(Boolean).join(' ')

    if (!hasLocation && !validPin) {
      onPreviewLocation(null)
      return undefined
    }

    if (lastPreviewRef.current === query) return undefined

    clearTimeout(previewTimerRef.current)
    previewTimerRef.current = setTimeout(async () => {
      lastPreviewRef.current = query
      const fallback = validPin ? getCoordsForPin(pincode) : null
      if (fallback?.lat && fallback?.lng) {
        lastPreviewCoordsRef.current = { lat: fallback.lat, lng: fallback.lng }
        onPreviewLocation({
          lat: fallback.lat,
          lng: fallback.lng,
          intensity: previewIntensity,
          type: 'preview',
          label: location || `PIN ${pincode}`,
        })
        return
      }
      const { data } = await api.geocode(query)
      if (data?.lat && data?.lng) {
        if (validPin) {
          cacheCoordsForPin(pincode, { lat: Number(data.lat), lng: Number(data.lng) })
        }
        lastPreviewCoordsRef.current = { lat: Number(data.lat), lng: Number(data.lng) }
        onPreviewLocation({
          lat: Number(data.lat),
          lng: Number(data.lng),
          intensity: previewIntensity,
          type: 'preview',
          label: hasLocation ? location : `PIN ${pincode}`,
        })
      } else {
        lastPreviewCoordsRef.current = null
        onPreviewLocation(null)
      }
    }, 550)

    return () => clearTimeout(previewTimerRef.current)
  }, [form.location, form.pincode, onPreviewLocation, previewIntensity])

  useEffect(() => {
    if (!onPreviewLocation) return
    if (!lastPreviewCoordsRef.current) return
    const location = String(form.location || '').trim()
    const pincode = String(form.pincode || '').trim()
    onPreviewLocation({
      lat: lastPreviewCoordsRef.current.lat,
      lng: lastPreviewCoordsRef.current.lng,
      intensity: previewIntensity,
      type: 'preview',
      label: location || `PIN ${pincode}`,
    })
  }, [previewIntensity, form.location, form.pincode, onPreviewLocation])

  useEffect(() => {
    if (!onPreviewZone) return undefined

    const pincode = String(form.pincode || '').trim()
    const validPin = /^\d{6}$/.test(pincode)
    if (!validPin) {
      onPreviewZone(null)
      return undefined
    }
    const zoneIndex = getZoneFromPin(pincode)
    if (!zoneIndex) {
      onPreviewZone(null)
      return undefined
    }
    onPreviewZone(`Zone ${zoneIndex}`)
    return undefined
  }, [form.pincode, onPreviewZone])

  const currentStep = useMemo(() => {
    if (!form.type) return 0
    if (String(form.notes || '').trim().length < 8) return 1
    const detailsFilled = form.name && form.phone && form.location && form.pincode && form.people
    if (!detailsFilled) return 2
    return 3
  }, [form])

  const completion = useMemo(() => {
    const detailsDone = Number(Boolean(form.name && form.phone && form.location && form.pincode && form.people))
    const needDone = Number(Boolean(form.type))
    const notesDone = Number(String(form.notes || '').trim().length >= 8)
    const done = detailsDone + needDone + notesDone
    return Math.round((done / 3) * 100)
  }, [form])

  function handleChange(event) {
    const { name, value } = event.target
    if (name === 'notes' || name === 'type') {
      setAnalysis(null)
      setAnalysisLoading(false)
    }
    setForm((current) => ({ ...current, [name]: value }))
  }

  function stopListening() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
    setVoiceInterim('')
    if (voiceFinal) {
      setForm((prev) => ({
        ...prev,
        notes: `${voiceBaseRef.current} ${voiceFinal}`.trim(),
      }))
    }
    clearTimeout(silenceTimerRef.current)
    clearTimeout(maxTimerRef.current)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess(null)

    const token = getToken?.()
    const demoUserId = String(user?.id || '').toUpperCase()
    const isDemoUser = demoUserId.startsWith('DEMO-')
    const isDemoToken = typeof token === 'string' && token.startsWith('demo-')
    const isDemoSession = isDemoUser || isDemoToken
    if (!token && !isDemoSession) {
      setError('Please log in to submit a request so it appears in your dashboard.')
      if (navigate) {
        setTimeout(() => navigate('auth'), 600)
      }
      return
    }

    if (!form.name || !form.phone || !form.type || !form.location || !form.pincode || !form.people) {
      setError('Please fill in name, phone, need type, location, pincode, and people.')
      return
    }
    if (!/^\d{6}$/.test(String(form.pincode).trim())) {
      setError('Please enter a valid 6-digit pincode.')
      return
    }
    if (String(form.notes || '').trim().length < 8) {
      setError('Please describe your situation in at least 8 characters.')
      return
    }

    setSubmitting(true)
    const coords = await getCoordinates()

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      area: form.location.trim(),
      pincode: form.pincode.trim(),
      people: Number(form.people) || 1,
      selectedNeed: String(form.type || '').toLowerCase(),
      type: toApiNeedType(form.type),
      notes: form.notes.trim(),
      lat: coords?.lat,
      lng: coords?.lng,
    }

    const finalizeSuccess = (result) => {
      setSuccess(result)
      setAnalysis((current) =>
        current || {
          urgency: result.urgency,
          category: result.aiCategory || payload.type,
          summary: result.aiSummary || 'System triage completed.',
          action: '',
          aiScore: result.priorityScore,
          responseTime: result.estimatedResponse,
        },
      )
      setSubmitting(false)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })

      if (navigate) {
        setTimeout(() => {
          navigate('map')
        }, 3000)
      }
    }

    const finalizeError = (message) => {
      setError(message)
      setSubmitting(false)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }

    if (isDemoSession) {
      const urgencyValue = String(analysis?.urgency || 'medium').toLowerCase()
      const urgencyScores = { critical: 90, high: 70, medium: 50, low: 30 }
      const priorityScore = urgencyScores[urgencyValue] || 50
      const fallbackCoords = getCoordsForPin(payload.pincode)
      const resolvedLat = Number.isFinite(coords?.lat) ? coords.lat : fallbackCoords?.lat
      const resolvedLng = Number.isFinite(coords?.lng) ? coords.lng : fallbackCoords?.lng

      const demoRequest = {
        id: `DEMO-${Date.now()}`,
        name: payload.name,
        phone: payload.phone,
        type: payload.selectedNeed,
        urgency: urgencyValue,
        status: 'pending',
        area: payload.area,
        pincode: payload.pincode,
        people: payload.people,
        notes: payload.notes,
        description: payload.notes,
        priorityScore,
        aiScore: priorityScore,
        lat: resolvedLat,
        lng: resolvedLng,
        createdAt: new Date().toISOString(),
      }

      updateDemoRequests((current) => [demoRequest, ...current])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sahayak_demo_update'))
      }

      finalizeSuccess({
        requestId: demoRequest.id,
        priorityScore,
        urgency: urgencyValue.toUpperCase(),
        aiCategory: payload.type,
        aiSummary: analysis?.summary || 'System triage completed.',
        status: 'PENDING',
        matchedNgo: null,
        estimatedResponse: urgencyValue === 'critical' ? '< 2 hours' : urgencyValue === 'high' ? '2-6 hours' : '6-24 hours',
      })
      return
    }

    const submitFn = api.submitHelpRequest
    const { data, error: submitError } = await submitFn(token, payload)

    if (submitError) {
      const errorText = String(submitError || '').toLowerCase()
      if (!isDemoSession && errorText.includes('selectedneed')) {
        const { data: fallbackData, error: fallbackError } = await api.submitRequest(payload)
        if (fallbackError || !fallbackData) {
          finalizeError(fallbackError || submitError)
          return
        }
        finalizeSuccess(fallbackData)
        return
      }
      finalizeError(submitError)
      return
    }

    finalizeSuccess(data)
  }

  const detectedUrgency = success?.urgency || analysis?.urgency || 'Pending'
  const detectedCategory = success?.aiCategory || analysis?.category || toApiNeedType(form.type) || 'Pending'
  const selectedNeedKey = normalizeNeedLabel(form.type)
  const suggestionChips = SUGGESTION_CHIPS[selectedNeedKey] || SUGGESTION_CHIPS.other

  return (
    <div className="space-y-8">
      <div className="relative pt-4">
        <div className="flex justify-between items-center relative z-10 w-full">
          {['Need Type', 'AI Analysis', 'Your Details', 'Review'].map((label, index) => {
            const isActive = index === currentStep
            const isCompleted = index < currentStep || (index === 3 && currentStep === 3 && completion === 100)

            return (
              <div key={label} className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-primary text-on-primary ring-4 ring-primary/20 scale-110 shadow-lg process-step-active'
                      : isCompleted
                      ? 'bg-primary text-on-primary process-step-complete'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {isCompleted && !isActive ? <span className="material-symbols-outlined process-step-check">check</span> : index + 1}
                </div>
                <span
                  className={`text-xs font-semibold px-2 transition-all duration-300 ${
                    isActive ? 'text-primary font-extrabold' : isCompleted ? 'text-primary opacity-80' : 'text-on-surface-variant opacity-60'
                  }`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
        <div className="absolute top-9 left-0 w-full h-1 bg-surface-container-highest rounded-full -z-0">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-in-out process-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, currentStep * 33.33))}%` }}
          />
        </div>
      </div>

      <section className="space-y-8">
        <header>
          <h1 className="text-4xl font-extrabold font-headline text-on-surface leading-tight">Request Relief Support</h1>
          <p className="text-on-surface-variant mt-2 text-lg">
            Select your need and describe the situation. AI decides urgency to avoid false critical submissions.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-extrabold font-headline">Step 1: Choose your need</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {needOptions.map((option) => {
                const selected = form.type === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setAnalysis(null)
                      setAnalysisLoading(false)
                      setForm((current) => ({ ...current, type: option.value }))
                    }}
                    className={`group need-option-card flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all text-center active:scale-95 ${
                      selected
                        ? 'need-option-selected'
                        : 'bg-surface-container-low border-transparent hover:border-primary/30'
                    }`}
                  >
                    <div
                      className={`need-option-icon w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform ${getNeedTone(option.tint)} ${
                        selected ? '' : 'group-hover:scale-110'
                      }`}
                    >
                      <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {option.icon}
                      </span>
                    </div>
                    <span className={`need-option-label font-bold font-headline ${selected ? 'text-primary' : 'text-on-surface'}`}>
                      {option.label}
                    </span>
                    {selected ? (
                      <span className="need-option-check material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-extrabold font-headline">Step 2: Situation analysis</h3>
            <div className="relative group">
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                className="w-full bg-surface-container-low border-none rounded-xl p-6 focus:ring-2 focus:ring-primary transition-all text-lg"
                placeholder="Describe your current situation in detail..."
                rows={4}
              />
              <button
                type="button"
                onClick={() => {
                  if (!SpeechRecognition) {
                    setError('Voice input requires Chrome browser.')
                    return
                  }
                  if (isListening) {
                    stopListening()
                    return
                  }
                  const recognition = new SpeechRecognition()
                  recognition.lang = 'en-IN'
                  recognition.continuous = true
                  recognition.interimResults = true
                  recognitionRef.current = recognition
                  voiceBaseRef.current = form.notes.trim()
                  setVoiceFinal('')
                  setVoiceInterim('')
                  recognition.lang = voiceLang
                  recognition.onresult = (event) => {
                    let interim = ''
                    let finalChunk = ''
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                      if (event.results[i].isFinal) {
                        finalChunk += event.results[i][0].transcript + ' '
                      } else {
                        interim += event.results[i][0].transcript
                      }
                    }
                    if (finalChunk) {
                      setVoiceFinal((prev) => `${prev} ${finalChunk}`.trim())
                    }
                    setVoiceInterim(interim)
                    const base = voiceBaseRef.current
                    const combined = `${base} ${voiceFinal} ${finalChunk} ${interim}`.trim()
                    setForm((prev) => ({ ...prev, notes: combined }))
                    clearTimeout(silenceTimerRef.current)
                    silenceTimerRef.current = setTimeout(() => {
                      stopListening()
                    }, 6000)
                  }
                  recognition.onerror = () => {
                    setError('Voice input failed. Please try again.')
                    stopListening()
                  }
                  recognition.onend = () => {
                    stopListening()
                  }
                  recognition.start()
                  setIsListening(true)
                  clearTimeout(maxTimerRef.current)
                  maxTimerRef.current = setTimeout(() => {
                    stopListening()
                  }, 45000)
                }}
                className={`absolute bottom-4 right-4 w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-lg ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-on-primary hover:bg-primary-container'
                }`}
                title={isListening ? 'Stop recording' : 'Speak your situation'}
              >
                <span className="material-symbols-outlined">{isListening ? 'stop' : 'mic'}</span>
              </button>
              <div className="absolute bottom-4 right-[3.5rem] flex items-center gap-2">
                <select
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value)}
                  disabled={isListening}
                  className="bg-white/90 border border-slate-200 text-xs font-semibold rounded-lg px-2 py-1 shadow-sm"
                >
                  {VOICE_LANGS.map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
                {voiceInterim ? (
                  <span className="text-[10px] text-slate-500 bg-white/80 px-2 py-1 rounded-full">Listening…</span>
                ) : null}
              </div>
              {isListening ? (
                <div className="absolute top-2 right-4 flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Listening...
                </div>
              ) : null}
            </div>
            {voiceInterim ? (
              <div className="text-xs text-slate-500 italic">Live transcript: {voiceInterim}</div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, notes: `${current.notes} ${chip}`.trim() }))}
                  className="px-4 py-1.5 bg-surface-container-highest text-on-surface-variant text-sm font-semibold rounded-full hover:bg-primary hover:text-on-primary transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-extrabold font-headline">Step 3: Contact information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="request-name" className="text-sm font-bold text-on-surface-variant px-1">
                  Full Name
                </label>
                <input
                  id="request-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary"
                  placeholder="Arjun Sharma"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="request-phone" className="text-sm font-bold text-on-surface-variant px-1">
                  Phone Number
                </label>
                <input
                  id="request-phone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="request-location" className="text-sm font-bold text-on-surface-variant px-1">
                  Area / Address
                </label>
                <input
                  id="request-location"
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary"
                  placeholder="Sector 12, Agra"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="request-pincode" className="text-sm font-bold text-on-surface-variant px-1">
                  PIN Code
                </label>
                <input
                  id="request-pincode"
                  type="text"
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary"
                  placeholder="282001"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="request-people" className="text-sm font-bold text-on-surface-variant px-1">
                  People Affected
                </label>
                <input
                  id="request-people"
                  type="number"
                  name="people"
                  value={form.people}
                  onChange={handleChange}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary"
                  placeholder="3"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-extrabold font-headline">Step 4: AI Priority + review</h3>
            <div className="bg-surface-container-lowest p-6 rounded-2xl border-l-8 border-tertiary flex items-center gap-6 shadow-sm">
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                  <circle className="text-outline-variant" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                  <circle
                    className="text-tertiary"
                    cx="48"
                    cy="48"
                    fill="transparent"
                    r="40"
                    stroke="currentColor"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 * (1 - completion / 100)}
                    strokeWidth="8"
                  />
                </svg>
                <span className="absolute text-lg font-bold font-headline text-tertiary">{completion}%</span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full ${urgencyBadgeClasses(detectedUrgency)}`}>
                    {analysisLoading ? 'Analyzing' : detectedUrgency}
                  </span>
                  <span className="text-sm font-bold text-on-surface-variant">
                    Category: <span className="text-on-surface">{detectedCategory}</span>
                  </span>
                </div>
                <h4 className="text-lg font-bold font-headline">
                  {analysisLoading ? 'AI triage in progress...' : 'AI urgency is system-controlled'}
                </h4>
                <p className="text-sm text-on-surface-variant opacity-90">
                  {analysis?.summary || success?.aiSummary || 'Add need + details and the system will classify urgency automatically.'}
                </p>
                {analysis?.responseTime || success?.estimatedResponse ? (
                  <p className="text-xs text-on-surface-variant">
                    Expected response window: <span className="font-bold text-on-surface">{analysis?.responseTime || success?.estimatedResponse}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-tertiary/30 bg-tertiary/10 text-tertiary px-4 py-3 text-sm font-semibold">{error}</div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 text-primary px-4 py-3 text-sm space-y-1">
              <p className="font-bold">Request submitted successfully.</p>
              <p>Request ID: {success.requestId}</p>
              <p>Detected urgency: {success.urgency}</p>
              <p>Detected category: {success.aiCategory}</p>
              <p>Priority score: {success.priorityScore}</p>
              <p>Status: {success.status}</p>
              {success.matchedNgo ? <p>Matched NGO: {success.matchedNgo}</p> : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setForm({
                  ...initialForm,
                  name: user?.fullName || user?.name || '',
                  phone: user?.phone || '',
                  location: user?.location || user?.area || '',
                  pincode: user?.pincode || '',
                })
                setAnalysis(null)
                setAnalysisLoading(false)
                setError('')
                setSuccess(null)
              }}
              className="px-6 py-3 rounded-xl font-bold text-on-surface border border-outline-variant/50 hover:bg-surface-container-low transition-colors"
            >
              Reset
            </button>
            <button type="submit" disabled={submitting} className="btn-primary min-w-[220px] py-3.5">
              {submitting ? 'Submitting...' : 'Submit Help Request'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
