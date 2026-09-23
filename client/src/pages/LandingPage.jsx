
export default function LandingPage({ navigate, socketData }) {
  // Use real socket data if available, otherwise default to static
  const requestsToday = socketData?.stats?.requestsToday ?? 4820;
  const avgResponse = socketData?.stats?.avgResponseMin ?? 23;
  const activeVolunteers = socketData?.stats?.activeVolunteers ?? 89;
  const successRate = 85;

  return (
    <div className="bg-background text-on-background font-body selection:bg-primary/30 min-h-screen">
      {/* Hero Section */}
      <header className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 hero-gradient overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]"></div>
        </div>
        <div className="relative z-10 max-w-5xl text-center space-y-8">
          <h1 className="font-headline text-5xl md:text-8xl font-extrabold tracking-tighter leading-[1.1]">
            Right Help.<br/>
            <span className="text-secondary text-6xl md:text-9xl block my-2">Right Place.</span>
            Right Now.
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-on-surface-variant font-medium leading-relaxed">
            India's first SMS-enabled AI resource mapper. We bridge the critical gap between disaster victims and nearby responders in real-time, even without mobile internet.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
            <button onClick={() => navigate('request')} className="w-full sm:w-auto bg-gradient-to-r from-secondary to-secondary-container text-on-secondary-fixed font-bold px-10 py-5 rounded-lg text-lg flex items-center justify-center gap-3 shadow-xl shadow-secondary/20 hover:-translate-y-1 active:scale-[0.96] transition-all">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
              Request Help Now
            </button>
            <button onClick={() => navigate('map')} className="w-full sm:w-auto border-2 border-primary text-primary font-bold px-10 py-5 rounded-lg text-lg flex items-center justify-center gap-3 hover:bg-primary/5 active:scale-[0.96] transition-all">
              <span className="material-symbols-outlined">map</span>
              View Live Map
            </button>
          </div>
        </div>

        {/* Floating Stats */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mt-24 max-w-6xl w-full">
          <div className="glass-panel p-6 rounded shadow-sm border border-white/10 flex flex-col items-center text-center transform hover:-translate-y-2 transition-transform">
            <span className="text-3xl font-headline font-extrabold text-primary">{requestsToday}</span>
            <span className="text-sm font-label text-slate-500 uppercase tracking-widest mt-1">Lives Helped</span>
          </div>
          <div className="glass-panel p-6 rounded shadow-sm border border-white/10 flex flex-col items-center text-center transform translate-y-8 hover:-translate-y-2 transition-transform">
            <span className="text-3xl font-headline font-extrabold text-secondary">{avgResponse} min</span>
            <span className="text-sm font-label text-slate-500 uppercase tracking-widest mt-1">Response</span>
          </div>
          <div className="glass-panel p-6 rounded shadow-sm border border-white/10 flex flex-col items-center text-center transform hover:-translate-y-2 transition-transform">
            <span className="text-3xl font-headline font-extrabold text-primary">{activeVolunteers}</span>
            <span className="text-sm font-label text-slate-500 uppercase tracking-widest mt-1">Volunteers</span>
          </div>
          <div className="glass-panel p-6 rounded shadow-sm border border-white/10 flex flex-col items-center text-center transform translate-y-8 hover:-translate-y-2 transition-transform">
            <span className="text-3xl font-headline font-extrabold text-teal-600">{successRate}%</span>
            <span className="text-sm font-label text-slate-500 uppercase tracking-widest mt-1">Success Rate</span>
          </div>
        </div>
      </header>

      {/* Live Ticker */}
      <div className="w-full bg-primary py-4 overflow-hidden border-y border-white/10">
        <div className="flex whitespace-nowrap animate-scroll">
          <div className="flex items-center gap-12 px-12 text-on-primary font-medium text-sm tracking-wide">
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">check_circle</span> Food delivered to Tajganj - 2 min ago</span>
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">check_circle</span> Medical kit dispatched to Sector 12 - 5 min ago</span>
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">check_circle</span> 4 Volunteers joined in Mumbai South - 8 min ago</span>
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">check_circle</span> Shelter capacity updated for Pune - 12 min ago</span>
          </div>
          <div className="flex items-center gap-12 px-12 text-on-primary font-medium text-sm tracking-wide">
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">check_circle</span> Food delivered to Tajganj - 2 min ago</span>
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">check_circle</span> Medical kit dispatched to Sector 12 - 5 min ago</span>
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">check_circle</span> 4 Volunteers joined in Mumbai South - 8 min ago</span>
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">check_circle</span> Shelter capacity updated for Pune - 12 min ago</span>
          </div>
        </div>
      </div>

      {/* Resource Bento */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="max-w-2xl">
            <span className="text-primary font-label font-bold tracking-[0.2em] uppercase text-sm mb-4 block">Ecosystem</span>
            <h2 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight">Rapid Resource Deployment</h2>
          </div>
          <p className="text-on-surface-variant max-w-sm mb-2">Our multi-channel platform coordinates essential services with surgical precision.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div onClick={() => navigate('request')} className="resource-bento-card resource-tone-food group p-8 rounded-lg text-center transition-all duration-500 cursor-pointer">
            <div className="resource-bento-icon mb-4 transform group-hover:rotate-12 transition-transform duration-300">
              <span className="material-symbols-outlined text-4xl">restaurant</span>
            </div>
            <span className="font-bold text-lg">Food</span>
          </div>
          <div onClick={() => navigate('request')} className="resource-bento-card resource-tone-medical group p-8 rounded-lg text-center transition-all duration-500 cursor-pointer">
            <div className="resource-bento-icon mb-4 transform group-hover:rotate-12 transition-transform duration-300">
              <span className="material-symbols-outlined text-4xl">medical_services</span>
            </div>
            <span className="font-bold text-lg">Medical</span>
          </div>
          <div onClick={() => navigate('request')} className="resource-bento-card resource-tone-shelter group p-8 rounded-lg text-center transition-all duration-500 cursor-pointer">
            <div className="resource-bento-icon mb-4 transform group-hover:rotate-12 transition-transform duration-300">
              <span className="material-symbols-outlined text-4xl">home</span>
            </div>
            <span className="font-bold text-lg">Shelter</span>
          </div>
          <div onClick={() => navigate('request')} className="resource-bento-card resource-tone-water group p-8 rounded-lg text-center transition-all duration-500 cursor-pointer">
            <div className="resource-bento-icon mb-4 transform group-hover:rotate-12 transition-transform duration-300">
              <span className="material-symbols-outlined text-4xl">water_drop</span>
            </div>
            <span className="font-bold text-lg">Water</span>
          </div>
          <div onClick={() => navigate('request')} className="resource-bento-card resource-tone-rescue group p-8 rounded-lg text-center transition-all duration-500 cursor-pointer">
            <div className="resource-bento-icon mb-4 transform group-hover:rotate-12 transition-transform duration-300">
              <span className="material-symbols-outlined text-4xl">ambulance</span>
            </div>
            <span className="font-bold text-lg">Rescue</span>
          </div>
          <div onClick={() => navigate('request')} className="resource-bento-card resource-tone-education group p-8 rounded-lg text-center transition-all duration-500 cursor-pointer">
            <div className="resource-bento-icon mb-4 transform group-hover:rotate-12 transition-transform duration-300">
              <span className="material-symbols-outlined text-4xl">school</span>
            </div>
            <span className="font-bold text-lg">Education</span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight mb-6">4 Steps to Recovery</h2>
            <div className="w-24 h-1.5 bg-primary mx-auto rounded-full"></div>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Dotted Line Background */}
            <div className="hidden md:block absolute top-1/4 left-0 w-full h-0.5 border-t-2 border-dashed border-outline-variant -z-10"></div>
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-2xl shadow-xl shadow-primary/20 ring-8 ring-background">1</div>
              <div className="space-y-2">
                <h3 className="font-headline font-bold text-xl">Submit Request</h3>
                <p className="text-on-surface-variant text-sm px-4">Send an SMS or use the web app to report your location and immediate needs.</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-2xl shadow-xl shadow-primary/20 ring-8 ring-background">2</div>
              <div className="space-y-2">
                <h3 className="font-headline font-bold text-xl">AI Triage</h3>
                <p className="text-on-surface-variant text-sm px-4">Our engine prioritizes requests based on urgency and resource proximity.</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-2xl shadow-xl shadow-primary/20 ring-8 ring-background">3</div>
              <div className="space-y-2">
                <h3 className="font-headline font-bold text-xl">Geo-Match</h3>
                <p className="text-on-surface-variant text-sm px-4">We instantly ping the nearest 5 verified NGOs or volunteers for the task.</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-2xl shadow-xl shadow-primary/20 ring-8 ring-background">4</div>
              <div className="space-y-2">
                <h3 className="font-headline font-bold text-xl">Help Dispatched</h3>
                <p className="text-on-surface-variant text-sm px-4">Responders reach your GPS pin using Sahyogi's offline navigation.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Selector */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div onClick={() => navigate('request')} className="group relative overflow-hidden p-10 rounded-lg bg-surface-container-low border border-transparent hover:border-tertiary transition-all duration-500 hover:-translate-y-4 cursor-pointer">
            <div className="absolute top-6 right-6 text-tertiary opacity-30 transform transition-all duration-500 group-hover:scale-110 group-hover:opacity-50">
              <span
                className="material-symbols-outlined text-5xl leading-none"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 100, 'opsz' 48" }}
              >
                sos
              </span>
            </div>
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 bg-tertiary text-on-tertiary rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">personal_injury</span>
              </div>
              <h3 className="font-headline text-3xl font-extrabold">I Need Help</h3>
              <p className="text-on-surface-variant">Immediate assistance for you or your community. SMS-based reporting available.</p>
              <button className="flex items-center gap-2 text-tertiary font-bold group-hover:gap-4 transition-all">Get Assist Now <span className="material-symbols-outlined">arrow_forward</span></button>
            </div>
          </div>
          
          <div onClick={() => navigate('auth-ngo')} className="group relative overflow-hidden p-10 rounded-lg bg-surface-container-low border border-transparent hover:border-primary transition-all duration-500 hover:-translate-y-4 cursor-pointer">
            <div className="absolute top-6 right-6 text-primary opacity-30 transform transition-all duration-500 group-hover:scale-110 group-hover:opacity-50">
              <span
                className="material-symbols-outlined text-5xl leading-none"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 100, 'opsz' 48" }}
              >
                corporate_fare
              </span>
            </div>
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 bg-primary text-on-primary rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
              <h3 className="font-headline text-3xl font-extrabold">I'm an NGO</h3>
              <p className="text-on-surface-variant">Manage relief efforts, coordinate teams, and view real-time heatmaps of demand.</p>
              <button className="flex items-center gap-2 text-primary font-bold group-hover:gap-4 transition-all">Onboard Organization <span className="material-symbols-outlined">arrow_forward</span></button>
            </div>
          </div>
          
          <div onClick={() => navigate('auth-volunteer')} className="group relative overflow-hidden p-10 rounded-lg bg-surface-container-low border border-transparent hover:border-blue-600 transition-all duration-500 hover:-translate-y-4 cursor-pointer">
            <div className="absolute top-6 right-6 text-blue-600 opacity-30 transform transition-all duration-500 group-hover:scale-110 group-hover:opacity-50">
              <span
                className="material-symbols-outlined text-5xl leading-none"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 100, 'opsz' 48" }}
              >
                volunteer_activism
              </span>
            </div>
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">handshake</span>
              </div>
              <h3 className="font-headline text-3xl font-extrabold">I'm a Volunteer</h3>
              <p className="text-on-surface-variant">Offer your time, skills, or resources to neighbors in need. Local task matching.</p>
              <button className="flex items-center gap-2 text-blue-600 font-bold group-hover:gap-4 transition-all">Join the Force <span className="material-symbols-outlined">arrow_forward</span></button>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Banner */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto rounded-lg bg-gradient-to-br from-primary to-primary-container p-12 md:p-24 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
          <div className="relative z-10 flex flex-col items-center text-center space-y-8">
            <h2 className="font-headline text-4xl md:text-7xl font-extrabold text-on-primary leading-tight">
              Right help to the<br/> right person, always.
            </h2>
            <p className="text-on-primary/80 max-w-2xl text-lg md:text-xl font-medium">
              Because in a disaster, seconds save lives. Our mission is to ensure no distress signal goes unheard, regardless of connectivity.
            </p>
            <div className="pt-8 flex flex-wrap justify-center gap-4">
              <img alt="Official United Nations SDG Goal 1 No Poverty badge icon" className="h-24 w-24 object-contain rounded-full shadow-lg" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMwTexbsW8Fr3eC_GQ6ZagA0Mm6SsQeCTlCUwn2eWlxUGhJUXD5aQhotNDUcwXnG5N7RdLn9YoBhnJKwcurqJHwiIIiAFiR_SZvXfjoM168O60exT8fTjJgs3kdu2OhoGSpsUDOLm5AnlBoRKjhS_P_o8RrvjbxeIzASJZak0rVIAJ6U4bBtJX8QkemTzF6C55Rh4_dF_Io-KLwQMZICeopiUMTINawVrivx16YnDPWTRfNlvWzU3_hwITQzrXfx0Xev4rwAh85Fig" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 py-16 max-w-7xl mx-auto">
          <div className="space-y-6">
            <div className="text-2xl font-headline font-bold text-primary">Sahyogi</div>
            <p className="text-on-surface-variant leading-relaxed text-sm">
              Connecting resilience with pulse. Sahyogi is India's leading AI-powered disaster relief infrastructure, optimized for low-bandwidth regions.
            </p>
            <div className="flex gap-4">
              <button className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all"><span className="material-symbols-outlined text-sm">public</span></button>
              <button className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all"><span className="material-symbols-outlined text-sm">mail</span></button>
              <button className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all"><span className="material-symbols-outlined text-sm">forum</span></button>
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="font-bold text-on-surface">Quick Links</h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li><button onClick={() => navigate('request')} className="hover:text-primary transition-colors">Emergency Protocol</button></li>
              <li><button onClick={() => navigate('ngo')} className="hover:text-primary transition-colors">NGO Dashboard</button></li>
              <li><button onClick={() => navigate('auth')} className="hover:text-primary transition-colors">Volunteer Network</button></li>
              <li><button onClick={() => navigate('map')} className="hover:text-primary transition-colors">Live Resource Map</button></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-bold text-on-surface">Resources</h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li><button onClick={() => navigate('home')} className="hover:text-primary transition-colors">API Documentation</button></li>
              <li><button onClick={() => navigate('home')} className="hover:text-primary transition-colors">Safety Guidelines</button></li>
              <li><button onClick={() => navigate('home')} className="hover:text-primary transition-colors">SMS Command List</button></li>
              <li><button onClick={() => navigate('home')} className="hover:text-primary transition-colors">Case Studies</button></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="font-bold text-on-surface">Stay Updated</h4>
            <p className="text-xs text-on-surface-variant">Get critical alerts and platform updates.</p>
            <form className="flex flex-col gap-2" onSubmit={(e) => e.preventDefault()}>
              <input className="bg-surface-container-lowest border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary" placeholder="email@address.com" type="email" />
              <button className="bg-primary text-on-primary p-3 rounded-lg text-sm font-bold active:scale-95 transition-all">Subscribe</button>
            </form>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 py-8 border-t border-outline-variant/10 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-label text-slate-500 dark:text-slate-400">
          <div>Â© {new Date().getFullYear()} Sahyogi Disaster Relief Platform. All Rights Reserved.</div>
          <div className="flex gap-8">
            <button className="hover:text-primary">Privacy Policy</button>
            <button className="hover:text-primary">Terms of Service</button>
            <button className="hover:text-primary">SDG Goal 1</button>
          </div>
        </div>
      </footer>

      {/* FAB - Fixed Action Button for quick help */}
      <div className="fixed bottom-8 right-8 z-50 group">
        <span className="pointer-events-none absolute -inset-4 rounded-full bg-gradient-to-r from-yellow-300/65 via-orange-400/55 to-red-500/55 blur-2xl animate-pulse transition-all duration-300 group-hover:scale-110 group-hover:opacity-100" />
        <span
          className="pointer-events-none absolute -inset-2 rounded-full border-2 border-amber-200/80 animate-ping"
          style={{ animationDuration: '1.8s' }}
        />
        <button
          onClick={() => navigate('request')}
          aria-label="Emergency SOS help"
          className="relative w-16 h-16 rounded-full border border-orange-100/80 bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600 text-white ring-[3px] ring-white/75 shadow-[0_0_0_4px_rgba(251,191,36,0.32),0_22px_42px_-12px_rgba(234,88,12,0.95)] flex items-center justify-center saturate-[1.15] transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:from-yellow-200 hover:via-orange-400 hover:to-red-500 hover:shadow-[0_0_0_6px_rgba(251,191,36,0.45),0_30px_50px_-12px_rgba(220,38,38,0.95)] active:scale-95"
        >
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-orange-600 text-[13px] font-black leading-none flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110">
            🚨
          </span>
          <span
            className="material-symbols-outlined text-[30px] transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 200, 'opsz' 48", letterSpacing: '0.02em' }}
          >
            sos
          </span>
        </button>
        <span className="pointer-events-none absolute right-[4.8rem] top-1/2 -translate-y-1/2 rounded-full border border-orange-100 bg-white/95 px-4 py-2 text-xs font-bold text-slate-800 shadow-xl backdrop-blur whitespace-nowrap opacity-0 translate-x-3 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
          SOS Help in 1 tap
        </span>
      </div>
    </div>
  );
}

