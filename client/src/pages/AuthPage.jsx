/**
 * AuthPage.jsx — 3-role login/signup with OTP
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../services/api.js'

const ROLES = [
    {
        id: 'user', label: 'I Need Help', icon: '🙏', color: '#EF4444',
        desc: 'Request food, medicine, shelter'
    },
    {
        id: 'volunteer', label: 'Volunteer', icon: '🦸', color: '#8B5CF6',
        desc: 'Help people near you'
    },
    {
        id: 'ngo', label: 'NGO Admin', icon: '🏥', color: '#0D9488',
        desc: 'Manage resources & operations'
    },
]

const DEMO_ACCOUNTS = [
    { role: 'user', phone: '9000000001', password: 'demo1234', label: 'Demo User' },
    { role: 'volunteer', phone: '9000000002', password: 'demo1234', label: 'Demo Volunteer' },
    { role: 'ngo', phone: '9000000003', password: 'demo1234', label: 'Demo NGO Admin' },
]

const NGO_DOMAINS = [
    { id: 'Food', icon: 'restaurant', color: '#f59e0b' },
    { id: 'Medical', icon: 'medical_services', color: '#f472b6' },
    { id: 'Shelter', icon: 'home', color: '#60a5fa' },
    { id: 'Water', icon: 'water_drop', color: '#22d3ee' },
    { id: 'Rescue', icon: 'volunteer_activism', color: '#a78bfa' },
    { id: 'Education', icon: 'school', color: '#4ade80' },
]

const ROLE_ROUTE_MAP = {
    user: 'request',
    volunteer: 'volunteer-dashboard',
    ngo: 'ngo-dashboard',
}

const THEME_STORAGE_KEY = 'sahayak_theme_mode'
const THEME_OPTIONS = [
    { value: 'light', icon: 'light_mode', label: 'Light mode' },
    { value: 'auto', icon: 'auto_mode', label: 'Auto mode' },
    { value: 'dark', icon: 'dark_mode', label: 'Dark mode' },
]

function normalizeThemeMode(value) {
    return THEME_OPTIONS.some((option) => option.value === value) ? value : 'auto'
}

function resolveThemeMode(mode) {
    if (mode === 'auto' && typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return mode === 'dark' ? 'dark' : 'light'
}

function applyThemeAttributes(mode) {
    const normalizedMode = normalizeThemeMode(mode)
    const resolvedMode = resolveThemeMode(normalizedMode)
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme-mode', normalizedMode)
        document.documentElement.setAttribute('data-theme-resolved', resolvedMode)
    }
}

function getInitialThemeMode() {
    if (typeof window === 'undefined') return 'auto'
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY)
    const initialMode = normalizeThemeMode(storedMode)
    applyThemeAttributes(initialMode)
    return initialMode
}

function resolveRoute(redirectTo, role) {
    const cleaned = String(redirectTo || '').trim().replace(/^\//, '')
    if (cleaned) return cleaned
    return ROLE_ROUTE_MAP[role] || 'home'
}

function buildDemoUser(demo) {
    const base = {
        id: `DEMO-${demo.role.toUpperCase()}`,
        phone: demo.phone,
        role: demo.role,
    }

    if (demo.role === 'user') {
        return {
            ...base,
            name: 'Demo User',
            fullName: 'Demo User',
            area: 'Tajganj, Agra',
        }
    }

    if (demo.role === 'volunteer') {
        return {
            ...base,
            name: 'Demo Volunteer',
            fullName: 'Demo Volunteer',
            area: 'Agra',
            points: 0,
            badge: 'starter',
            deliveries: 0,
        }
    }

    return {
        ...base,
        name: 'Demo NGO Admin',
        fullName: 'Demo NGO Admin',
        area: 'Agra',
        orgName: 'Seva Bharti Agra',
    }
}

export default function AuthPage({ navigate, initialRole }) {
    const { login } = useAuth()
    const [selectedRole, setSelectedRole] = useState(initialRole || 'user')
    const [themeMode, setThemeMode] = useState(getInitialThemeMode)
    const [mode, setMode] = useState('login')   // 'login' | 'signup' | 'otp'
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [otpPhone, setOtpPhone] = useState('')
    const [otpHint, setOtpHint] = useState('')
    const [countdown, setCountdown] = useState(0)

    // Form fields
    const [form, setForm] = useState({
        name: '', phone: '', password: '',
        area: '', people: '1',
        skills: [],
        ngoDomains: [],
        orgName: '', regNumber: '',
        otp: ['', '', '', ''],
    })

    const update = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const setTheme = (value) => {
        const normalizedMode = normalizeThemeMode(value)
        setThemeMode(normalizedMode)
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_STORAGE_KEY, normalizedMode)
        }
        applyThemeAttributes(normalizedMode)
    }
    const toggleSkill = (skill) => {
        setForm(f => ({
            ...f,
            skills: f.skills.includes(skill)
                ? f.skills.filter(s => s !== skill)
                : [...f.skills, skill]
        }))
    }
    const toggleNgoDomain = (domain) => {
        setForm(f => ({
            ...f,
            ngoDomains: f.ngoDomains.includes(domain)
                ? f.ngoDomains.filter((item) => item !== domain)
                : [...f.ngoDomains, domain]
        }))
    }

    // ── Handle Login ──────────────────────────────────────────
    const handleLogin = async () => {
        setLoading(true)
        setError('')
        const { data, error: err } = await api.login({
            phone: form.phone, password: form.password, role: selectedRole
        })
        setLoading(false)

        if (err) {
            if (err.includes('registered as')) {
                setError(err + ' Click your actual role above to fix this.')
            } else {
                setError(err)
            }
            return
        }

        login(data.user, data.token)
        navigate(resolveRoute(data?.redirectTo, data?.user?.role || selectedRole))
    }

    // ── Handle Signup → Send OTP ──────────────────────────────
    const handleSignup = async () => {
        if (selectedRole === 'ngo' && form.ngoDomains.length === 0) {
            setError('Please select at least one NGO domain.')
            return
        }

        setLoading(true)
        setError('')
        const { data, error: err } = await api.signup({
            fullName: form.name, phone: form.phone,
            password: form.password, role: selectedRole,
            area: form.area, people: form.people,
            skills: form.skills,
            domains: form.ngoDomains,
            orgName: form.orgName, regNumber: form.regNumber,
            inviteCode: form.inviteCode || '',
        })
        setLoading(false)
        if (err) { setError(err); return }

        setOtpPhone(form.phone)
        setOtpHint(data.otp || '1234')
        setMode('otp')
        startCountdown()
    }
    // ── Handle OTP Verify ─────────────────────────────────────
    const handleVerifyOTP = async () => {
        const otpString = form.otp.join('')
        if (otpString.length < 4) { setError('Enter all 4 digits'); return }

        setLoading(true)
        setError('')
        const { data, error: err } = await api.verifyOTP({ phone: otpPhone, otp: otpString })
        setLoading(false)
        if (err) { setError(err); return }

        login(data.user, data.token)
        navigate(resolveRoute(data?.redirectTo, data?.user?.role || selectedRole))
    }

    // ── Demo Quick Login ──────────────────────────────────────
    const handleDemoLogin = async (demo) => {
        setLoading(true)
        setError('')
        setSelectedRole(demo.role)
        const { data, error: err } = await api.login({
            phone: demo.phone, password: demo.password, role: demo.role
        })
        if (!err && data?.user && data?.token) {
            setLoading(false)
            login(data.user, data.token)
            navigate(resolveRoute(data?.redirectTo, data?.user?.role || demo.role))
            return
        }

        // Offline-safe demo fallback: still allow one-click demo navigation.
        const demoUser = buildDemoUser(demo)
        const demoToken = `demo-${demo.role}-token`
        setLoading(false)
        setError('')
        login(demoUser, demoToken)
        navigate(resolveRoute('', demo.role))
    }

    // ── OTP input handling (auto-advance) ────────────────────
    const handleOTPInput = (index, value) => {
        const digits = value.replace(/\D/g, '').slice(0, 1)
        const newOtp = [...form.otp]
        newOtp[index] = digits
        update('otp', newOtp)

        if (digits && index < 3) {
            document.getElementById(`otp-${index + 1}`)?.focus()
        }
        if (index === 3 && digits) {
            // Auto-submit when last digit entered
            setTimeout(() => handleVerifyOTP(), 100)
        }
    }

    const handleOTPKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !form.otp[index] && index > 0) {
            document.getElementById(`otp-${index - 1}`)?.focus()
        }
    }

    // ── Resend countdown timer ────────────────────────────────
    const startCountdown = () => {
        setCountdown(44)
        const timer = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { clearInterval(timer); return 0 }
                return c - 1
            })
        }, 1000)
    }

    useEffect(() => {
        applyThemeAttributes(themeMode)
        if (themeMode !== 'auto' || typeof window === 'undefined') return undefined

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const syncAutoTheme = () => applyThemeAttributes('auto')

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', syncAutoTheme)
            return () => mediaQuery.removeEventListener('change', syncAutoTheme)
        }

        mediaQuery.addListener(syncAutoTheme)
        return () => mediaQuery.removeListener(syncAutoTheme)
    }, [themeMode])

    const roleConfig = ROLES.find(r => r.id === selectedRole)

    // Input style shorthand
    const inputStyle = {
        width: '100%', border: '1.5px solid var(--border)', borderRadius: '10px',
        padding: '11px 14px', fontFamily: 'var(--font-body)', fontSize: '0.875rem',
        background: 'var(--surface)', color: 'var(--text)', outline: 'none',
        transition: 'border-color 0.2s', boxSizing: 'border-box',
    }

    return (
        <div style={{
            minHeight: 'calc(100vh - 64px)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px', background: 'var(--auth-page-bg)'
        }}>
            <div style={{ width: '100%', maxWidth: '480px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        background: 'var(--auth-chip-bg)', borderRadius: '20px',
                        padding: '6px 16px', marginBottom: '12px'
                    }}>
                        <span className="live-dot" style={{ width: '7px', height: '7px' }}></span>
                        <span style={{ color: 'var(--auth-chip-text)', fontSize: '0.75rem', fontWeight: 700 }}>
                            Sahyogi — Binary Minds
                        </span>
                    </div>
                    <h1 style={{
                        fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '2rem',
                        margin: '0 0 6px', letterSpacing: '-0.03em'
                    }}>
                        {mode === 'otp' ? 'Verify OTP' : 'Welcome Back'}
                    </h1>
                    <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.875rem' }}>
                        {mode === 'otp'
                            ? `Code sent to +91 ••••••${otpPhone.slice(-4)}`
                            : 'Choose your role to continue'}
                    </p>
                    <div
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            marginTop: '12px', padding: '4px', borderRadius: '999px',
                            background: 'var(--auth-soft-bg)', border: '1px solid var(--border)'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '16px', color: 'var(--primary)' }}>
                            auto_awesome
                        </span>
                        {THEME_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                title={option.label}
                                onClick={() => setTheme(option.value)}
                                style={{
                                    width: '28px', height: '28px', borderRadius: '999px',
                                    border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    background: themeMode === option.value ? 'var(--primary)' : 'transparent',
                                    color: themeMode === option.value ? '#ffffff' : 'var(--muted)'
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '16px' }}>
                                    {option.icon}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Card */}
                <div style={{
                    background: 'var(--auth-card-bg)', borderRadius: '20px',
                    border: '1px solid var(--border)', padding: '28px',
                    boxShadow: 'var(--shadow)'
                }}>

                    {/* ── OTP SCREEN ─────────────────────────────────── */}
                    {mode === 'otp' && (
                        <div>
                            {/* OTP hint */}
                            <div style={{
                                background: 'var(--auth-info-bg)', border: '1px solid var(--auth-info-border)',
                                borderRadius: '10px', padding: '12px 14px',
                                marginBottom: '20px', display: 'flex', gap: '8px'
                            }}>
                                <span>💡</span>
                                <span style={{ fontSize: '0.82rem', color: 'var(--auth-info-text)' }}>
                                    Demo OTP: <strong style={{ fontFamily: 'monospace', fontSize: '1rem' }}>
                                        {otpHint}
                                    </strong> or use <strong>1234</strong>
                                </span>
                            </div>

                            {/* 4-digit OTP boxes */}
                            <div style={{
                                display: 'flex', gap: '12px', justifyContent: 'center',
                                marginBottom: '20px'
                            }}>
                                {form.otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        id={`otp-${i}`}
                                        type="text" inputMode="numeric" maxLength={1}
                                        value={digit}
                                        onChange={e => handleOTPInput(i, e.target.value)}
                                        onKeyDown={e => handleOTPKeyDown(i, e)}
                                        style={{
                                            width: '64px', height: '64px', textAlign: 'center',
                                            fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 700,
                                            border: `2px solid ${digit ? 'var(--primary)' : 'var(--border)'}`,
                                            borderRadius: '12px', background: 'var(--auth-soft-bg)',
                                            color: 'var(--text)', outline: 'none',
                                            transition: 'border-color 0.15s',
                                        }}
                                    />
                                ))}
                            </div>

                            {error && (
                                <p style={{
                                    color: 'var(--urgent)', fontSize: '0.82rem',
                                    textAlign: 'center', marginBottom: '12px'
                                }}>
                                    ⚠️ {error}
                                </p>
                            )}

                            <button onClick={handleVerifyOTP} disabled={loading}
                                style={{
                                    width: '100%', background: 'var(--primary)', color: '#fff',
                                    border: 'none', borderRadius: '12px', padding: '13px',
                                    fontFamily: 'var(--font-heading)', fontWeight: 700,
                                    fontSize: '0.95rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '8px'
                                }}>
                                {loading
                                    ? <><span style={{
                                        width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#fff', borderRadius: '50%',
                                        animation: 'spin 0.7s linear infinite'
                                    }} />Verifying...</>
                                    : '✓ Verify & Enter Sahyogi'}
                            </button>

                            {/* Resend */}
                            <div style={{
                                textAlign: 'center', marginTop: '14px', fontSize: '0.82rem',
                                color: 'var(--muted)'
                            }}>
                                {countdown > 0
                                    ? `Resend in ${countdown}s`
                                    : <button onClick={() => { startCountdown(); }}
                                        style={{
                                            background: 'none', border: 'none', color: 'var(--primary)',
                                            cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem'
                                        }}>
                                        Resend OTP
                                    </button>
                                }
                            </div>

                            <button onClick={() => setMode('signup')}
                                style={{
                                    width: '100%', background: 'none', border: 'none',
                                    color: 'var(--muted)', cursor: 'pointer', marginTop: '8px',
                                    fontSize: '0.8rem'
                                }}>
                                ← Back to signup
                            </button>
                        </div>
                    )}

                    {/* ── LOGIN / SIGNUP SCREENS ──────────────────────── */}
                    {mode !== 'otp' && (
                        <>
                            {/* Role selector */}
                            <div style={{ marginBottom: '20px' }}>
                                <p style={{
                                    fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                    margin: '0 0 10px'
                                }}>
                                    I am a...
                                </p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {ROLES.map(role => (
                                        <button key={role.id} onClick={() => setSelectedRole(role.id)}
                                            style={{
                                                flex: 1, padding: '10px 6px', border: `2px solid ${selectedRole === role.id ? role.color : 'var(--border)'}`,
                                                borderRadius: '12px', cursor: 'pointer',
                                                background: selectedRole === role.id ? role.color + '12' : 'transparent',
                                                textAlign: 'center', transition: 'all 0.2s',
                                            }}>
                                            <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{role.icon}</div>
                                            <div style={{
                                                fontSize: '0.72rem', fontWeight: 700,
                                                color: selectedRole === role.id ? role.color : 'var(--muted)',
                                                fontFamily: 'var(--font-heading)'
                                            }}>
                                                {role.label}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mode switcher: Login / Sign Up */}
                            <div style={{
                                display: 'flex', background: 'var(--auth-soft-bg)', borderRadius: '10px',
                                padding: '3px', marginBottom: '20px'
                            }}>
                                {['login', 'signup'].map(m => (
                                    <button key={m} onClick={() => { setMode(m); setError('') }}
                                        style={{
                                            flex: 1, padding: '9px', borderRadius: '8px', border: 'none',
                                            background: mode === m ? 'var(--surface)' : 'transparent',
                                            color: mode === m ? 'var(--text)' : 'var(--muted)',
                                            fontFamily: 'var(--font-heading)', fontWeight: mode === m ? 700 : 400,
                                            fontSize: '0.875rem', cursor: 'pointer',
                                            boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                            transition: 'all 0.2s',
                                        }}>
                                        {m === 'login' ? 'Log In' : 'Sign Up'}
                                    </button>
                                ))}
                            </div>

                            {/* Error message */}
                            {error && (
                                <div style={{
                                    background: 'var(--auth-error-bg)', border: '1px solid var(--auth-error-border)',
                                    borderRadius: '8px', padding: '10px 12px',
                                    marginBottom: '14px', fontSize: '0.82rem', color: 'var(--auth-error-text)'
                                }}>
                                    ⚠️ {error}
                                </div>
                            )}

                            {/* LOGIN FORM */}
                            {mode === 'login' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{
                                            display: 'block', fontSize: '0.78rem', fontWeight: 600,
                                            marginBottom: '5px', color: 'var(--text)'
                                        }}>
                                            📱 Phone Number <span style={{ color: '#EF4444' }}>*</span>
                                        </label>
                                        <input value={form.phone} onChange={e => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            placeholder="10-digit mobile number" style={inputStyle}
                                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                    </div>
                                    <div>
                                        <label style={{
                                            display: 'block', fontSize: '0.78rem', fontWeight: 600,
                                            marginBottom: '5px', color: 'var(--text)'
                                        }}>
                                            🔒 Password <span style={{ color: '#EF4444' }}>*</span>
                                        </label>
                                        <input type="password" value={form.password}
                                            onChange={e => update('password', e.target.value)}
                                            placeholder="Your password" style={inputStyle}
                                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                    </div>
                                    <button onClick={handleLogin} disabled={loading || !form.phone || !form.password}
                                        style={{
                                            background: loading || !form.phone || !form.password
                                                ? 'var(--auth-disabled-bg)' : roleConfig?.color || 'var(--primary)',
                                            color: loading || !form.phone || !form.password ? 'var(--auth-disabled-text)' : '#fff',
                                            border: 'none', borderRadius: '12px', padding: '13px',
                                            fontFamily: 'var(--font-heading)', fontWeight: 700,
                                            fontSize: '0.95rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', gap: '8px'
                                        }}>
                                        {loading
                                            ? <><span style={{
                                                width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                                                borderTopColor: '#fff', borderRadius: '50%',
                                                animation: 'spin 0.7s linear infinite'
                                            }} />Logging in...</>
                                            : `${roleConfig?.icon} Log In as ${roleConfig?.label}`}
                                    </button>
                                </div>
                            )}

                            {/* SIGNUP FORM */}
                            {mode === 'signup' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* Common fields */}
                                    <input value={form.name} onChange={e => update('name', e.target.value)}
                                        placeholder="Full name *" style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                    <input value={form.phone} onChange={e => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="10-digit phone number *" style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                    <input type="password" value={form.password}
                                        onChange={e => update('password', e.target.value)}
                                        placeholder="Create password *" style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                    <input value={form.area} onChange={e => update('area', e.target.value)}
                                        placeholder="Your area / city *" style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border)'} />

                                    {/* User-specific */}
                                    {selectedRole === 'user' && (
                                        <input type="number" min="1" value={form.people}
                                            onChange={e => update('people', e.target.value)}
                                            placeholder="Number of people in family" style={{ ...inputStyle, width: '100%' }}
                                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                    )}

                                    {/* Volunteer-specific */}
                                    {selectedRole === 'volunteer' && (
                                        <div>
                                            <input value={form.inviteCode || ''} onChange={e => update('inviteCode', e.target.value)}
                                                placeholder="NGO Invite Code (optional)" style={{ ...inputStyle, marginBottom: '12px' }}
                                                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'} />

                                            <label style={{
                                                fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)',
                                                display: 'block', marginBottom: '8px'
                                            }}>
                                                My Skills (select at least 1) *
                                            </label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {['Medical', 'Driving', 'Cooking', 'Rescue', 'Teaching', 'Languages'].map(skill => (
                                                    <button key={skill} onClick={() => toggleSkill(skill)}
                                                        style={{
                                                            padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                                                            border: `1.5px solid ${form.skills.includes(skill) ? '#8B5CF6' : 'var(--border)'}`,
                                                            background: form.skills.includes(skill) ? 'var(--auth-skill-bg)' : 'transparent',
                                                            color: form.skills.includes(skill) ? 'var(--auth-skill-text)' : 'var(--muted)',
                                                            fontSize: '0.78rem', fontWeight: 600,
                                                        }}>
                                                        {skill}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* NGO-specific */}
                                    {selectedRole === 'ngo' && (
                                        <>
                                            <input value={form.orgName} onChange={e => update('orgName', e.target.value)}
                                                placeholder="Organization name *" style={inputStyle}
                                                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                            <input value={form.regNumber} onChange={e => update('regNumber', e.target.value)}
                                                placeholder="NGO Registration number *" style={inputStyle}
                                                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                            <div>
                                                <label style={{
                                                    fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)',
                                                    display: 'block', marginBottom: '8px'
                                                }}>
                                                    Service Domains (select one or more) *
                                                </label>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                                                    {NGO_DOMAINS.map((domain) => {
                                                        const selected = form.ngoDomains.includes(domain.id)
                                                        return (
                                                            <button
                                                                key={domain.id}
                                                                type="button"
                                                                onClick={() => toggleNgoDomain(domain.id)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                                    width: '100%', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer',
                                                                    border: `1.5px solid ${selected ? domain.color : 'var(--border)'}`,
                                                                    background: selected ? `${domain.color}22` : 'transparent',
                                                                    color: selected ? domain.color : 'var(--muted)',
                                                                    transition: 'all 0.2s', fontSize: '0.8rem', fontWeight: 700,
                                                                }}
                                                            >
                                                                <span
                                                                    className="material-symbols-outlined"
                                                                    style={{ fontVariationSettings: "'FILL' 1", fontSize: '17px' }}
                                                                >
                                                                    {domain.icon}
                                                                </span>
                                                                <span>{domain.id}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <button onClick={handleSignup} disabled={loading || (selectedRole === 'ngo' && form.ngoDomains.length === 0)}
                                        style={{
                                            background: roleConfig?.color || 'var(--primary)',
                                            opacity: loading || (selectedRole === 'ngo' && form.ngoDomains.length === 0) ? 0.7 : 1,
                                            color: '#fff', border: 'none', borderRadius: '12px',
                                            padding: '13px', fontFamily: 'var(--font-heading)',
                                            fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', gap: '8px'
                                        }}>
                                        {loading
                                            ? <><span style={{
                                                width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                                                borderTopColor: '#fff', borderRadius: '50%',
                                                animation: 'spin 0.7s linear infinite'
                                            }} />Sending OTP...</>
                                            : `${roleConfig?.icon} Sign Up as ${roleConfig?.label}`}
                                    </button>
                                </div>
                            )}

                            {/* Demo quick login buttons */}
                            <div style={{
                                marginTop: '20px', paddingTop: '16px',
                                borderTop: '1px solid var(--border)'
                            }}>
                                <p style={{
                                    fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center',
                                    margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em'
                                }}>
                                    ⚡ Quick Demo Access (for judges)
                                </p>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {DEMO_ACCOUNTS.map(demo => (
                                        <button key={demo.role} onClick={() => handleDemoLogin(demo)}
                                            disabled={loading}
                                            style={{
                                                flex: 1, padding: '8px 4px', border: '1px solid var(--border)',
                                                borderRadius: '8px', cursor: 'pointer', background: 'var(--auth-soft-bg)',
                                                fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                                            {demo.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

