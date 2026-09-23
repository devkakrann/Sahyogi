import { useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getShortUserName } from '../utils/userDisplay.js'

const VOICE_PROMPTS = {
  fullName: {
    en: 'Please enter your full name',
    hi: 'कृपया अपना पूरा नाम दर्ज करें',
    ta: 'உங்கள் முழு பெயரை உள்ளிடவும்',
  },
  phone: {
    en: 'Enter your ten digit phone number',
    hi: 'अपना दस अंकों का फोन नंबर दर्ज करें',
    ta: 'உங்கள் பத்து இலக்க தொலைபேசி எண்ணை உள்ளிடவும்',
  },
  otp: {
    en: 'Enter the six digit OTP sent to your phone',
    hi: 'अपने फोन पर आया छह अंकों का ओटीपी दर्ज करें',
    ta: 'உங்கள் தொலைபேசிக்கு வந்த ஆறு இலக்க OTP-ஐ உள்ளிடவும்',
  },
}

const LANG_OPTIONS = [
  { code: 'en', label: 'English', nativeLabel: 'English', voice: 'en-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'Hindi (हिन्दी)', voice: 'hi-IN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'Tamil (தமிழ்)', voice: 'ta-IN' },
]

const ROLE_OPTIONS = [
  {
    key: 'user',
    label: 'Citizen',
    icon: 'person',
    apiValue: 'user',
    loginTitle: 'Citizen Login Panel',
    loginHint: 'Use your registered phone and password to continue.',
  },
  {
    key: 'volunteer',
    label: 'Volunteer',
    icon: 'volunteer_activism',
    apiValue: 'volunteer',
    loginTitle: 'Volunteer Login Panel',
    loginHint: 'Volunteer accounts can access assigned area and action queue.',
  },
  {
    key: 'ngo',
    label: 'NGO Admin',
    icon: 'domain',
    apiValue: 'ngo',
    loginTitle: 'NGO Admin Login Panel',
    loginHint: 'NGO admin accounts can manage teams, resources, and approvals.',
  },
]

function formatRole(role) {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (normalized === 'volunteer') return 'Volunteer'
  if (normalized === 'ngo_admin' || normalized === 'ngo') return 'NGO Admin'
  return 'Citizen'
}

function parseApiError(error) {
  const text = String(error || '')
  if (text.toLowerCase().includes('failed to fetch') || text.toLowerCase().includes('network')) {
    return 'Backend not running. Start server and retry.'
  }
  return text || 'Something went wrong. Please try again.'
}

const DEMO_BY_ROLE = {
  user: { phone: '9000000001', password: 'demo1234' },
  volunteer: { phone: '9000000002', password: 'demo1234' },
  ngo: { phone: '9000000003', password: 'demo1234' },
}

export default function AuthPortal({ navigate }) {
  const { user, login: loginWithContext, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('signup')
  const [selectedRole, setSelectedRole] = useState('user')
  const [language, setLanguage] = useState('en')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [phoneForOtp, setPhoneForOtp] = useState('')
  const [otp, setOtp] = useState('')

  const [signupForm, setSignupForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    assignedArea: '',
    terms: false,
  })
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' })

  const passwordStrength = useMemo(() => {
    const len = signupForm.password.length
    if (len >= 12) return 4
    if (len >= 8) return 3
    if (len >= 5) return 2
    if (len >= 1) return 1
    return 0
  }, [signupForm.password])

  const otpDigits = useMemo(() => Array.from({ length: 6 }, (_, index) => otp[index] || ''), [otp])
  const selectedRoleConfig = useMemo(
    () => ROLE_OPTIONS.find((role) => role.key === selectedRole) || ROLE_OPTIONS[0],
    [selectedRole],
  )

  function setSignupValue(field, value) {
    if (field === 'phone') {
      setSignupForm((current) => ({ ...current, phone: value.replace(/\D/g, '').slice(0, 10) }))
      return
    }
    setSignupForm((current) => ({ ...current, [field]: value }))
  }

  function setLoginValue(field, value) {
    if (field === 'phone') {
      setLoginForm((current) => ({ ...current, phone: value.replace(/\D/g, '').slice(0, 10) }))
      return
    }
    setLoginForm((current) => ({ ...current, [field]: value }))
  }

  function showError(text) {
    setMessage({ type: 'error', text })
  }

  function showSuccess(text) {
    setMessage({ type: 'success', text })
  }

  function speak(field) {
    const text = VOICE_PROMPTS[field]?.[language]
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    const voiceLang = LANG_OPTIONS.find((item) => item.code === language)?.voice || 'en-IN'
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voiceLang
    utterance.rate = 0.85
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  function resetSession() {
    setActiveTab('signup')
    setSelectedRole('user')
    setPhoneForOtp('')
    setOtp('')
    logout()
    setMessage({ type: '', text: '' })
    setSignupForm({
      fullName: '',
      phone: '',
      email: '',
      password: '',
      assignedArea: '',
      terms: false,
    })
    setLoginForm({ phone: '', password: '' })
  }

  async function sendOtp(event) {
    event.preventDefault()
    setMessage({ type: '', text: '' })

    if (!signupForm.fullName.trim()) return showError('Name is required.')
    if (!/^\d{10}$/.test(signupForm.phone)) return showError('Valid 10-digit phone required.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupForm.email)) return showError('Valid email required.')
    if (signupForm.password.length < 8) return showError('Password must be at least 8 characters.')
    if (!signupForm.terms) return showError('Please accept Terms & Conditions.')

    const generatedOrgName = `${signupForm.fullName.trim() || 'Sahyogi'} NGO`
    const generatedRegNumber = `NGO-${signupForm.phone.slice(-4) || '0000'}`
    const signupPayload = {
      name: signupForm.fullName,
      phone: signupForm.phone,
      password: signupForm.password,
      role: selectedRoleConfig.apiValue,
      area: signupForm.assignedArea,
      people: 1,
      skills: selectedRoleConfig.apiValue === 'volunteer' ? ['First Aid', 'Logistics'] : [],
      orgName: selectedRoleConfig.apiValue === 'ngo' ? generatedOrgName : undefined,
      regNumber: selectedRoleConfig.apiValue === 'ngo' ? generatedRegNumber : undefined,
      email: signupForm.email,
    }

    setLoading(true)
    const { data, error } = await api.signup(signupPayload)
    setLoading(false)
    if (error) return showError(parseApiError(error))

    setPhoneForOtp(signupForm.phone)
    setActiveTab('verify')
    const otpHint = data?.otp ? ` Demo OTP: ${data.otp}` : ''
    showSuccess((data?.message || 'OTP sent. Check your phone now.') + otpHint)
    speak('otp')
  }

  async function verifyAndSignup(event) {
    event.preventDefault()
    setMessage({ type: '', text: '' })
    if (!/^\d{4,6}$/.test(otp)) return showError('Enter a valid OTP.')

    setLoading(true)
    const { data, error } = await api.verifyOTP({
      phone: phoneForOtp,
      otp,
    })
    setLoading(false)
    if (error) return showError(parseApiError(error))

    loginWithContext(data.user, data.token)
    showSuccess('Account verified and activated.')
    if (navigate && data?.redirectTo) {
      navigate(String(data.redirectTo).replace('/', ''))
    }
  }

  async function loginUser(event) {
    event.preventDefault()
    setMessage({ type: '', text: '' })
    if (!/^\d{10}$/.test(loginForm.phone)) return showError('Valid 10-digit phone required.')
    if (!loginForm.password) return showError('Password required.')

    setLoading(true)
    const { data, error } = await api.login({
      phone: loginForm.phone,
      password: loginForm.password,
      role: selectedRoleConfig.apiValue,
    })
    setLoading(false)
    if (error) return showError(parseApiError(error))

    loginWithContext(data.user, data.token)
    showSuccess(`${formatRole(data?.user?.role || selectedRoleConfig.apiValue)} login successful.`)
    if (navigate && data?.redirectTo) {
      navigate(String(data.redirectTo).replace('/', ''))
    }
  }

  function useDemoLogin() {
    setActiveTab('login')
    const demo = DEMO_BY_ROLE[selectedRoleConfig.apiValue] || DEMO_BY_ROLE.user
    setLoginForm({ phone: demo.phone, password: demo.password })
    showSuccess('Demo credentials applied. Click LOG IN.')
  }

  return (
    <main className="bg-background text-on-background font-body min-h-screen selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="flex min-h-screen flex-col md:flex-row">
        <section className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-primary-container p-12 flex-col justify-between">
          <div className="absolute inset-0 z-0">
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary rounded-full blur-[120px] opacity-20" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-secondary-container rounded-full blur-[100px] opacity-10" />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 bg-on-primary-container rounded-xl flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-primary text-3xl font-bold fill-icon animate-logo-pulse">emergency</span>
            </div>
            <div>
              <h1 className="font-headline font-extrabold text-2xl tracking-tight text-on-primary-container">Sahyogi</h1>
              <p className="font-label text-xs uppercase tracking-widest text-primary-fixed-dim">Resilient Pulse</p>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative w-72 h-72 mb-12">
              <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-full animate-[spin_20s_linear_infinite]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-container-lowest p-3 rounded-full shadow-lg">
                  <span className="material-symbols-outlined text-primary">house</span>
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-surface-container-lowest p-3 rounded-full shadow-lg">
                  <span className="material-symbols-outlined text-secondary">heart_check</span>
                </div>
                <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-container-lowest p-3 rounded-full shadow-lg">
                  <span className="material-symbols-outlined text-tertiary">corporate_fare</span>
                </div>
              </div>

              <div className="absolute inset-4 rounded-full overflow-hidden border-8 border-on-primary-container/20 shadow-2xl animate-float">
                <img
                  alt="Community Unity"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBofVVtpjWqFvRpgaW2j0a0OLNR20seyJ6TeGfeWAztxFMmlHDmjYih67gb_Et4Ts6eqJ13dEDj-7N8BjRBNwa20vAF1G2myhZcD7-WIrWNBzJFLh89MKG9I7cvNo9qMJQO8yJc2CJX-JN82kPc8--PT83qSRkV8sPJcw3P9qVhg7dmZT26gmB7U2D3XBkIuLW3dj6N73rMVWcsawXxjx-5K5F86XaeYTyKqDUFIRofmEy1ug8k-za-bsbD_56k76_YNmNGqaBKoOXc"
                />
              </div>
            </div>

            <div className="space-y-4 max-w-sm">
              <h2 className="font-headline font-extrabold text-4xl text-on-primary-container leading-tight">
                Empowering Communities, One Pulse at a Time.
              </h2>
              <p className="text-on-primary-container/80 text-lg">
                Join the network designed to make disaster relief coordinated, swift, and human-centric.
              </p>
            </div>
          </div>

          <div className="relative z-10 glass-panel p-6 rounded-lg shadow-xl border border-white/20 hover:-translate-y-2 transition-transform duration-500">
            <div className="flex gap-4 items-start">
              <img
                alt="Dr. Arjan"
                className="w-12 h-12 rounded-full object-cover border-2 border-primary"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1L7aTo_QKez5Aabi3FBtrvENvSbFv5I1QXpfu2sbJaoPMk2dRWFcg7h-BWSJHt8oqkeQqfDvQkvbHXGbhLARKB3gB9XAiXqzVQ0ygkjjRtYetYgnrMqU8QuVt0f_xs7ygmFFifrfSp3TDJaFWpfymI2YvrHYg3AHyHnnuNRZyKRBK78aD9laGzz0k_iyYiyblK6yIWbC_7eL-tSV1_X9UjpFGkNngGeGGeDY198fX7Xj4kcUyaFVQC7mownnY8wUj-VMTUnEu3oVG"
              />
              <div>
                <p className="text-on-surface italic text-sm mb-2">
                  "Sahyogi transformed how we manage resources during the monsoon floods. It's not just a tool; it's a lifeline for the district."
                </p>
                <p className="font-bold text-primary text-xs uppercase">Dr. Arjan Singh • Disaster Response Lead</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex-1 flex flex-col bg-surface-container-lowest overflow-y-auto">
          <div className="flex justify-between items-center px-6 py-6 md:px-12">
            <div className="lg:hidden flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl font-bold fill-icon animate-logo-pulse">emergency</span>
              <span className="font-headline font-extrabold text-xl text-primary">Sahyogi</span>
            </div>
            <div className="flex items-center gap-2 ml-auto group">
              <span className="material-symbols-outlined text-outline text-sm">language</span>
              <select
                className="bg-transparent border-none text-sm font-semibold text-outline focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {LANG_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.nativeLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-6 md:p-12">
            <div className="w-full max-w-xl space-y-10">
              <div className="space-y-2">
                <h3 className="font-headline font-extrabold text-3xl text-on-surface">Start making an impact</h3>
                <p className="text-outline font-medium">Join Sahyogi today. Choose your role to get started.</p>
              </div>

              <div className="grid grid-cols-3 gap-3 p-1.5 bg-surface-container rounded-xl">
                {ROLE_OPTIONS.map((roleOption) => {
                  const isSelected = selectedRole === roleOption.key
                  return (
                    <button
                      key={roleOption.key}
                      type="button"
                      onClick={() => setSelectedRole(roleOption.key)}
                      className={`flex flex-col items-center justify-center py-4 px-2 rounded-lg hover:scale-[0.98] transition-all ${
                        isSelected
                          ? 'bg-surface-container-lowest text-primary shadow-sm'
                          : 'text-outline hover:bg-surface-container-high'
                      }`}
                    >
                      <span className={`material-symbols-outlined mb-1 ${isSelected ? 'fill-icon' : ''}`}>
                        {roleOption.icon}
                      </span>
                      <span className="font-label text-xs font-bold uppercase tracking-tighter">
                        {roleOption.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {!user ? (
                <div className="relative">
                  <div className="flex gap-8 border-b border-surface-variant">
                    <button type="button" onClick={() => setActiveTab('signup')} className={`pb-4 text-sm font-bold ${activeTab === 'signup' ? 'border-b-2 border-primary text-primary' : 'text-outline hover:text-on-surface'}`}>
                      SIGN UP
                    </button>
                    <button type="button" onClick={() => setActiveTab('login')} className={`pb-4 text-sm font-bold ${activeTab === 'login' ? 'border-b-2 border-primary text-primary' : 'text-outline hover:text-on-surface'}`}>
                      LOG IN
                    </button>
                    {activeTab === 'verify' ? <span className="pb-4 text-sm font-bold border-b-2 border-primary text-primary">VERIFY OTP</span> : null}
                  </div>
                </div>
              ) : null}

              {message.text ? (
                <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${message.type === 'error' ? 'bg-tertiary/10 text-tertiary border border-tertiary/30' : 'bg-primary/10 text-primary border border-primary/30'}`}>
                  {message.text}
                </div>
              ) : null}

              {activeTab === 'signup' && !user ? (
                <form className="space-y-6" onSubmit={sendOtp}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="font-label text-xs font-bold text-outline uppercase tracking-wider ml-1">Full Name</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors">mic</span>
                        </div>
                        <input className="block w-full pl-12 pr-12 py-3.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" placeholder="John Doe" type="text" value={signupForm.fullName} onChange={(event) => setSignupValue('fullName', event.target.value)} />
                        <button type="button" onClick={() => speak('fullName')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-primary">
                          <span className="material-symbols-outlined text-sm">volume_up</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="font-label text-xs font-bold text-outline uppercase tracking-wider ml-1">Phone Number</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-outline font-bold text-sm">+91</span>
                        </div>
                        <input className="block w-full pl-14 pr-12 py-3.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" placeholder="98765 43210" type="tel" value={signupForm.phone} onChange={(event) => setSignupValue('phone', event.target.value)} maxLength={10} inputMode="numeric" />
                        <button type="button" onClick={() => speak('phone')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-primary">
                          <span className="material-symbols-outlined text-sm">volume_up</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-label text-xs font-bold text-outline uppercase tracking-wider ml-1">Email</label>
                    <input className="block w-full px-4 py-3.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" placeholder="john@example.com" type="email" value={signupForm.email} onChange={(event) => setSignupValue('email', event.target.value)} />
                  </div>

                  <div className="space-y-6 animate-fade-up">
                    <div className="space-y-2">
                      <label className="font-label text-xs font-bold text-outline uppercase tracking-wider ml-1">Assigned Area / City</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-outline">location_on</span>
                        </div>
                        <input className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" placeholder="e.g. South Mumbai, MH" type="text" value={signupForm.assignedArea} onChange={(event) => setSignupValue('assignedArea', event.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="font-label text-xs font-bold text-outline uppercase tracking-wider ml-1">Skills &amp; Expertise</label>
                      <div className="flex flex-wrap gap-2">
                        <button className="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold flex items-center gap-1 shadow-sm" type="button">
                          First Aid <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                        <button className="px-4 py-2 bg-primary text-on-primary rounded-full text-xs font-bold flex items-center gap-1 shadow-sm" type="button">
                          Logistics <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                        <button className="px-4 py-2 bg-surface-container text-outline rounded-full text-xs font-bold hover:bg-surface-container-high transition-colors" type="button">
                          + Add Skills
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="font-label text-xs font-bold text-outline uppercase tracking-wider ml-1">Set Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-outline">lock</span>
                        </div>
                        <input className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" placeholder="••••••••" type="password" value={signupForm.password} onChange={(event) => setSignupValue('password', event.target.value)} />
                      </div>
                      <div className="flex gap-1 h-1 w-full mt-2">
                        {Array.from({ length: 4 }, (_, index) => (
                          <div key={index} className={`flex-1 rounded-full ${index < passwordStrength ? 'bg-primary' : 'bg-surface-container'}`} />
                        ))}
                      </div>
                      <p className="text-[10px] text-primary font-bold uppercase tracking-widest text-right">Strong Security</p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-outline font-medium">
                    <input type="checkbox" checked={signupForm.terms} onChange={(event) => setSignupValue('terms', event.target.checked)} className="rounded border-surface-variant" />
                    I agree to Terms of Service and Privacy Policy
                  </label>

                  <div className="pt-4 space-y-4">
                    <button className="w-full bg-primary text-on-primary font-headline font-extrabold py-4 rounded-lg shadow-lg shadow-primary/20 active:scale-[0.96] transition-all flex items-center justify-center gap-2 group" type="submit" disabled={loading}>
                      {loading ? 'SENDING OTP...' : 'NEXT: VERIFY OTP'}
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                    <div className="flex items-center gap-4 text-outline py-2">
                      <div className="flex-1 h-px bg-surface-variant" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">or for testing</span>
                      <div className="flex-1 h-px bg-surface-variant" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button className="flex items-center justify-center gap-2 py-3 border-2 border-surface-variant rounded-lg text-xs font-bold hover:bg-surface-container transition-colors active:scale-95" type="button" onClick={useDemoLogin}>
                        <span className="material-symbols-outlined text-primary text-sm">rocket_launch</span>
                        DEMO LOGIN
                      </button>
                      <button className="flex items-center justify-center gap-2 py-3 border-2 border-surface-variant rounded-lg text-xs font-bold hover:bg-surface-container transition-colors active:scale-95" type="button" onClick={() => showSuccess('Guest view enabled for preview mode.')}>
                        <span className="material-symbols-outlined text-outline text-sm">contact_support</span>
                        GUEST VIEW
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}

              {activeTab === 'login' && !user ? (
                <form className="space-y-6" onSubmit={loginUser}>
                  <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
                    <p className="font-label text-[11px] font-bold uppercase tracking-wider text-primary/80">
                      Active role
                    </p>
                    <p className="font-headline text-base font-bold text-on-surface">
                      {selectedRoleConfig.loginTitle}
                    </p>
                    <p className="text-xs text-outline">{selectedRoleConfig.loginHint}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-xs font-bold text-outline uppercase tracking-wider ml-1">Phone Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-outline font-bold text-sm">+91</span>
                      </div>
                      <input className="block w-full pl-14 pr-4 py-3.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" placeholder="98765 43210" type="tel" value={loginForm.phone} onChange={(event) => setLoginValue('phone', event.target.value)} maxLength={10} inputMode="numeric" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="font-label text-xs font-bold text-outline uppercase tracking-wider ml-1">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-outline">lock</span>
                      </div>
                      <input className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" placeholder="••••••••" type="password" value={loginForm.password} onChange={(event) => setLoginValue('password', event.target.value)} />
                    </div>
                  </div>
                  <button className="w-full bg-primary text-on-primary font-headline font-extrabold py-4 rounded-lg shadow-lg shadow-primary/20 active:scale-[0.96] transition-all" type="submit" disabled={loading}>
                    {loading ? 'LOGGING IN...' : 'LOG IN'}
                  </button>
                </form>
              ) : null}

              {activeTab === 'verify' && !user ? (
                <form className="space-y-6 pt-10 border-t border-surface-variant mt-10" onSubmit={verifyAndSignup}>
                  <div className="text-center space-y-2">
                    <h4 className="font-headline font-bold text-xl">Enter 6-digit OTP</h4>
                    <p className="text-sm text-outline">We've sent a code to +91 {phoneForOtp || '----------'}</p>
                  </div>
                  <div className="flex justify-center gap-3">
                    {otpDigits.map((digit, index) => (
                      <div key={index} className="w-12 h-14 text-center text-2xl font-['JetBrains_Mono'] bg-surface-container rounded-xl flex items-center justify-center">
                        {digit || '•'}
                      </div>
                    ))}
                  </div>
                  <input className="block w-full px-4 py-3.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-center tracking-[0.35em] font-['JetBrains_Mono']" placeholder="123456" type="text" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} inputMode="numeric" />
                  <button className="w-full bg-primary text-on-primary font-headline font-extrabold py-4 rounded-lg shadow-lg shadow-primary/20 active:scale-[0.96] transition-all" type="submit" disabled={loading || otp.length < 4}>
                    {loading ? 'VERIFYING...' : 'VERIFY & CONTINUE'}
                  </button>
                  <p className="text-center text-xs font-bold text-primary cursor-pointer hover:underline">Resend code in 00:45</p>
                </form>
              ) : null}

              {user ? (
                <div className="space-y-6 pt-10 border-t border-surface-variant mt-10">
                  <div className="text-center space-y-2">
                    <h4 className="font-headline font-bold text-2xl text-primary">Welcome {getShortUserName(user, 12)}</h4>
                    <p className="text-sm text-outline">
                      Authenticated as {formatRole(user.role || selectedRoleConfig.apiValue)} - {user.phone}
                    </p>
                  </div>
                  <button className="w-full bg-primary text-on-primary font-headline font-extrabold py-4 rounded-lg shadow-lg shadow-primary/20 active:scale-[0.96] transition-all" type="button" onClick={resetSession}>
                    CREATE NEW SESSION
                  </button>
                </div>
              ) : null}

              <footer className="pt-8 text-center text-xs text-outline font-medium">
                By continuing, you agree to Sahyogi&apos;s <button type="button" className="text-primary hover:underline">Terms of Service</button> and <button type="button" className="text-primary hover:underline">Privacy Policy</button>.
              </footer>
            </div>
          </div>
        </section>
      </div>

      {user ? (
        <div className="fixed bottom-8 left-8 z-[100] animate-bounce-in">
          <div className="bg-primary-container border-l-4 border-primary px-6 py-4 rounded-r-lg shadow-2xl flex items-center gap-4">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-sm fill-icon">check_circle</span>
            </div>
            <div>
              <p className="font-headline font-bold text-sm text-on-primary-container">Welcome {getShortUserName(user, 12)}!</p>
              <p className="text-xs text-on-primary-container/70">
                Verified as {formatRole(user.role || selectedRoleConfig.apiValue)} for Sahyogi platform
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
