import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getShortUserName, getUserInitial } from '../utils/userDisplay.js'

const THEME_STORAGE_KEY = 'sahayak_theme_mode'
const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'auto', label: 'Auto', icon: 'auto_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
]

function normalizePageForNav(page) {
  if (page === 'ngo-dashboard') return 'ngo'
  if (page === 'volunteer-dashboard') return 'volunteer'
  if (String(page || '').startsWith('auth')) return 'auth'
  return page
}

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

export default function Navbar({ currentPage, navigate, connected = false, onSMSDemo }) {
  const [open, setOpen] = useState(false)
  const [themeMode, setThemeMode] = useState(getInitialThemeMode)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const activePage = normalizePageForNav(currentPage)
  const { user, logout } = useAuth()
  const shortUserName = getShortUserName(user, 10)
  const userInitial = getUserInitial(user)
  const shortRole = (() => {
    const role = String(user?.role || '').trim().toLowerCase()
    if (role === 'volunteer') return 'VOL'
    if (role === 'ngo' || role === 'ngo_admin') return 'NGO'
    if (role === 'citizen' || role === 'user') return 'USER'
    return String(user?.role || 'USER').toUpperCase()
  })()

  const role = String(user?.role || '').toLowerCase()
  const isNgo = role === 'ngo'
  const isVolunteer = role === 'volunteer'
  const isRequester = role === 'user' || role === 'citizen' || !role
  const showAnalytics = role === 'admin' || isNgo || isVolunteer

  const navItems = [
    ['home', 'Home'],
    ['map', 'Live Map'],
    // Only show "Get Help" for users/citizens (not NGOs/Volunteers)
    ...(!isNgo && !isVolunteer ? [['request', 'Get Help']] : []),
    // Show role-specific dashboard
    ...(isRequester && user ? [['user-dashboard', 'My Requests']] : []),
    ...(isVolunteer ? [['volunteer', 'My Missions']] : []),
    ...(isNgo ? [['ngo', 'Dashboard']] : []),
    ...(showAnalytics ? [['analytics', 'Analytics']] : []),
  ]

  const applyThemeMode = (mode) => {
    const normalizedMode = normalizeThemeMode(mode)
    setThemeMode(normalizedMode)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalizedMode)
    }
    applyThemeAttributes(normalizedMode)
  }

  const goTo = (page) => {
    setOpen(false)
    setThemeMenuOpen(false)
    navigate(page)
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
  return (
    <>
      <nav className="navbar-shell fixed top-0 w-full z-50 backdrop-blur-xl border-b">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-2 xl:gap-3 px-4 sm:px-6 py-4">
          <button
            onClick={() => goTo('home')}
            className="sahayak-brand shrink-0 min-w-[180px] xl:min-w-[208px] pr-2 text-xl xl:text-2xl font-extrabold leading-none flex items-center gap-2 font-headline uppercase tracking-tight"
          >
            <span className="sahayak-logo-shell">
              <span className="material-symbols-outlined sahayak-logo-icon" style={{ fontVariationSettings: "'FILL' 1" }}>
                emergency
              </span>
            </span>
            Sahyogi
          </button>

          <div className="nav-links-shell hidden lg:flex flex-1 min-w-0 items-center">
            <div className="nav-links-grid">
              {navItems.map(([page, label]) => (
                <button
                  key={page}
                  onClick={() => goTo(page)}
                  className={`nav-pill ${activePage === page ? 'nav-pill-active' : 'nav-pill-idle'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 lg:gap-2">
            <div className="relative hidden lg:block">
              <button
                onClick={() => setThemeMenuOpen((value) => !value)}
                className="theme-mode-trigger hidden lg:flex items-center justify-center w-10 h-10 rounded-full border transition-all hover:-translate-y-px"
                title="Choose color mode"
              >
                <span className="material-symbols-outlined theme-star-icon">auto_awesome</span>
              </button>
              {themeMenuOpen ? (
                <div className="theme-menu absolute right-0 mt-2 w-44 rounded-2xl border p-2 animate-fade-up">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        applyThemeMode(option.value)
                        setThemeMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                        themeMode === option.value
                          ? 'bg-primary/15 text-primary'
                          : 'text-[color:var(--theme-chip-text)] hover:bg-primary/10'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">{option.icon}</span>
                        {option.label}
                      </span>
                      {themeMode === option.value ? <span className="material-symbols-outlined text-[16px]">check</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border theme-status-chip">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--theme-chip-text)]">
                {connected ? 'Live' : 'Fallback'}
              </span>
            </div>

            {onSMSDemo ? (
              <button
                onClick={onSMSDemo}
                className="hidden xl:flex items-center border border-primary/20 text-primary px-3.5 py-2.5 rounded-full font-bold hover:bg-primary/5 active:scale-95 transition-all text-sm"
              >
                SMS Hub
              </button>
            ) : null}

            {!isNgo && !isVolunteer ? (
              <button onClick={() => goTo('request')} className="hidden xl:flex items-center gap-2 bg-primary text-on-primary px-5 2xl:px-6 py-2.5 rounded-full font-bold shadow-md shadow-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all">
                <span className="2xl:hidden">Get Help</span>
                <span className="hidden 2xl:inline">Get Help Now</span>
              </button>
            ) : null}

            {user ? (
              <div className="hidden lg:flex max-w-[230px] items-center gap-3 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {userInitial}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[11px] font-bold text-slate-800 leading-tight">{shortUserName}</span>
                  <span className="text-[8px] uppercase tracking-wider font-bold text-slate-500 leading-tight">{shortRole}</span>
                </div>
                <button
                  onClick={() => {
                    logout()
                    goTo('home')
                  }}
                  className="ml-2 p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex items-center"
                  title="Logout"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => goTo('auth')}
                className="hidden lg:flex items-center justify-center py-2 px-5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-slate-600 text-[18px]">account_circle</span>
                <span className="text-sm font-bold text-slate-700">Login</span>
              </button>
            )}

            <button
              className="lg:hidden p-2 rounded-xl transition-all hover:bg-primary/10 text-[color:var(--nav-link)]"
              onClick={() => {
                setOpen((value) => !value)
                setThemeMenuOpen(false)
              }}
            >
              <span className="material-symbols-outlined">{open ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
      </nav>

      {open ? (
        <div className="navbar-mobile-panel fixed top-[72px] left-0 w-full backdrop-blur-3xl border-b z-40 md:hidden flex flex-col p-6 gap-3 shadow-xl">
          {navItems.map(([page, label]) => (
            <button
              key={page}
              onClick={() => goTo(page)}
              className={`p-4 rounded-xl text-left font-bold transition-all ${
                activePage === page ? 'bg-primary/10 text-primary' : 'text-[color:var(--nav-link)]'
              }`}
            >
              {label}
            </button>
          ))}

          {user ? (
            <div className="p-4 rounded-xl mt-2 bg-slate-100 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {userInitial}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 leading-tight mb-1">{shortUserName}</span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-primary">{shortRole}</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  logout()
                  goTo('home')
                }}
                className="bg-white p-2.5 border border-slate-200 shadow-sm rounded-xl text-red-500 font-bold text-xs uppercase hover:bg-red-50 active:scale-95 transition-all"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                goTo('auth')
              }}
              className={`p-4 rounded-xl text-left font-bold transition-all ${
                activePage === 'auth' ? 'bg-primary/10 text-primary' : 'text-[color:var(--nav-link)]'
              }`}
            >
              Log In / Sign Up
            </button>
          )}

          <div className="mt-2 rounded-xl border border-[color:var(--theme-chip-border)] bg-[color:var(--theme-chip-bg)] p-3">
            <p className="text-[11px] mb-2 uppercase tracking-wider font-bold text-[color:var(--theme-chip-text)]">Theme Mode</p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => applyThemeMode(option.value)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[10px] font-extrabold uppercase transition-all ${
                    themeMode === option.value
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-white/70 text-[color:var(--theme-chip-text)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {onSMSDemo ? (
            <button
              onClick={() => {
                onSMSDemo()
                setOpen(false)
              }}
              className="mt-2 p-4 rounded-xl text-left font-bold bg-slate-200/80 text-[color:var(--theme-chip-text)]"
            >
              Open SMS Hub
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

