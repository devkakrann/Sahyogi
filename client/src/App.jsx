import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import SMSDemo from './components/SMSDemo.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { useSocket } from './hooks/useSocket.js'
import LandingPage from './pages/LandingPage.jsx'
import MapDashboard from './pages/MapDashboard.jsx'
import RequestHelp from './pages/RequestHelp.jsx'
import NGODashboard from './pages/NGODashboard.jsx'
import Analytics from './pages/Analytics.jsx'
import AuthPage from './pages/AuthPage.jsx'
import VolunteerDashboard from './pages/VolunteerDashboard.jsx'
import UserDashboard from './pages/UserDashboard.jsx'

function AppContent() {
  const [currentPage, setCurrentPage] = useState('home')
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const socketData = useSocket()
  const { user } = useAuth()
  const role = String(user?.role || '').toLowerCase()

  const navigate = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <LandingPage navigate={navigate} socketData={socketData} />
      case 'map':
        return <MapDashboard navigate={navigate} socketData={socketData} />
      case 'request':
        return <RequestHelp navigate={navigate} socketData={socketData} />
      case 'user-dashboard':
        return <UserDashboard navigate={navigate} />
      case 'volunteer':
      case 'volunteer-dashboard':
        return <VolunteerDashboard navigate={navigate} socketData={socketData} />
      case 'ngo':
      case 'ngo-dashboard':
        return <NGODashboard navigate={navigate} socketData={socketData} currentPage={currentPage} />
      case 'analytics':
        return <Analytics socketData={socketData} />
      case 'auth':
        return <AuthPage navigate={navigate} />
      case 'auth-user':
        return <AuthPage navigate={navigate} initialRole="user" />
      case 'auth-volunteer':
        return <AuthPage navigate={navigate} initialRole="volunteer" />
      case 'auth-ngo':
        return <AuthPage navigate={navigate} initialRole="ngo" />
      default:
        return <LandingPage navigate={navigate} socketData={socketData} />
    }
  }

  const hideNavbar =
    currentPage === 'auth' ||
    currentPage === 'auth-user' ||
    currentPage === 'auth-volunteer' ||
    currentPage === 'auth-ngo'

  return (
    <div className="min-h-screen bg-background">
      {!hideNavbar ? (
        <Navbar
          currentPage={currentPage}
          navigate={navigate}
          connected={socketData.connected}
          onSMSDemo={() => setSmsModalOpen(true)}
        />
      ) : null}
      <main>{renderPage()}</main>
      <SMSDemo isOpen={smsModalOpen} onClose={() => setSmsModalOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
