# 🙏 Sahayak — Smart Help Mapping System

> "Right Help. Right Place. Right Now."
> 
> Team ASUR · Hacknovate 7.0 · Theme: No Poverty

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start frontend
npm run dev        # → http://localhost:5173

# 4. (Optional) Start backend API
npm install express cors dotenv @anthropic-ai/sdk
node server/index.js   # → http://localhost:3001
```

---

## 🏗️ Architecture

```
sahayak/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx        # Navigation with live counter
│   │   └── AITriage.jsx      # 🤖 AI Needs Analyzer (Innovation #1)
│   ├── pages/
│   │   ├── LandingPage.jsx   # Hero + how-it-works + role selector
│   │   ├── MapDashboard.jsx  # 🗺️ Live heatmap + filters
│   │   ├── RequestHelp.jsx   # Multi-step request form
│   │   └── NGODashboard.jsx  # Operational hub
│   ├── data/
│   │   └── mockData.js       # Realistic Agra/UP demo data
│   ├── App.jsx               # State-based routing
│   ├── main.jsx              # Entry point
│   └── index.css             # Design tokens + animations
├── server/
│   └── index.js              # Node.js + Express + Claude API
└── index.html                # Google Fonts + Leaflet CSS
```

---

## ✨ 3 Innovation Features (Winning Edge)

### 🤖 #1: AI Triage Engine
**Component:** `AITriage.jsx` → `server/index.js (POST /api/triage)`

Users describe their situation in plain language. Claude AI analyzes the text and returns:
- **Urgency level** (critical / high / medium / low)
- **Need category** (food / shelter / medical / education)
- **AI Priority Score** (0–100)
- **Estimated response time**
- **Recommended action** for the NGO

*Demo line: "I haven't eaten in 2 days and my kids are crying"*
→ AI returns: CRITICAL, Food, Score: 94, Response: < 2 hours

### 🔮 #2: Predictive Hotspot Analysis
**Component:** `MapDashboard.jsx` → Prediction rings on map + `NGODashboard.jsx` → Hotspots tab

Based on historical request patterns and time-series analysis, predicts which geographic zones will see a **surge in need within the next 24 hours**. NGOs can pre-position resources proactively.

Toggle "🔮 Predict" on the map to see dashed rings around predicted hotspots.

### 🏆 #3: Volunteer Gamification System
**Component:** `NGODashboard.jsx` → Leaderboard tab

- Points awarded per delivery (25 pts per fulfillment)
- Badge tiers: Starter → Bronze → Silver → Gold
- Live leaderboard creates healthy competition
- Proven to increase volunteer retention by 3x (gamification research)

---

## 🗺️ Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing | `home` | Hero, stats, how it works, role selector |
| Live Map | `map` | Leaflet heatmap with filters, NGO markers, predictions |
| Get Help | `request` | 4-step form with AI triage |
| Dashboard | `ngo` | Priority queue, leaderboard, predictions, resources |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Maps | Leaflet + react-leaflet + leaflet.heat |
| AI | Claude API (claude-sonnet-4-20250514) |
| Backend | Node.js + Express |
| Database | MongoDB (mongoose) |
| Fonts | Sora + DM Sans (Google Fonts) |

---

## 🧩 Key Design Decisions

1. **State-based routing** — no react-router-dom dependency, easier to demo
2. **Offline-first AI fallback** — local keyword classifier if API unavailable
3. **Agra/UP mock data** — realistic coordinates for the demo region
4. **CSS variables design system** — consistent theming, easy to rebrand
5. **Leaflet over Google Maps** — free, no API key needed for demo

---

## 📊 Impact Metrics (Demo Data)

- 🌍 4,820+ lives impacted
- ⚡ 23 min average response time
- 🦸 89 active volunteers
- ✅ 31 requests fulfilled today (demo)

---

## 👥 Team ASUR

Built for Hacknovate 7.0 · Theme: No Poverty (UN SDG Goal 1)