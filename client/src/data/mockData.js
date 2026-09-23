/**
 * mockData.js
 * Realistic demo data centred around Agra / Western UP / Delhi NCR.
 * All coordinates are real locations; all names are fictional.
 */

// ── Heatmap intensity points  [lat, lng, intensity 0-1] ──────────────
export const heatmapPoints = [
  // Agra city – high density
  [27.1767, 78.0081, 0.95], [27.1850, 78.0200, 0.80], [27.1700, 78.0150, 0.75],
  [27.1920, 77.9900, 0.70], [27.1600, 78.0400, 0.65], [27.2000, 78.0300, 0.60],
  [27.1500, 77.9800, 0.55], [27.2100, 78.0500, 0.72], [27.1650, 78.0700, 0.50],
  // Mathura
  [27.4924, 77.6737, 0.60], [27.5000, 77.6800, 0.55], [27.4800, 77.6600, 0.45],
  // Firozabad
  [27.1500, 78.3950, 0.50], [27.1600, 78.4100, 0.45],
  // Aligarh
  [27.8974, 78.0880, 0.40], [27.9000, 78.1000, 0.35],
  // Rural pockets
  [27.3000, 77.8500, 0.30], [27.0500, 78.2000, 0.25], [27.6000, 78.1000, 0.20],
  [27.4000, 77.9000, 0.35], [27.2500, 78.1500, 0.40],
];

// ── Active help requests ──────────────────────────────────────────────
export const mockRequests = [
  {
    id: 'REQ-001',
    type: 'food',
    urgency: 'critical',
    name: 'Razia Begum',
    description: 'Single mother with 4 children. No food for 2 days. Husband left.',
    lat: 27.1767, lng: 78.0081,
    area: 'Tajganj, Agra',
    people: 5,
    submittedAt: '2 hours ago',
    status: 'pending',
    aiScore: 94,
    matchedNgo: null,
  },
  {
    id: 'REQ-002',
    type: 'medical',
    urgency: 'critical',
    name: 'Balram Yadav',
    description: 'Elderly man needs diabetes medicine. Cannot afford. Alone.',
    lat: 27.1850, lng: 78.0200,
    area: 'Lohamandi, Agra',
    people: 1,
    submittedAt: '45 min ago',
    status: 'matched',
    aiScore: 91,
    matchedNgo: 'Seva Charitable Trust',
  },
  {
    id: 'REQ-003',
    type: 'shelter',
    urgency: 'high',
    name: 'Meera Devi',
    description: 'Family of 6 displaced after landlord eviction. Need temporary shelter.',
    lat: 27.1920, lng: 77.9900,
    area: 'Sikandra, Agra',
    people: 6,
    submittedAt: '3 hours ago',
    status: 'pending',
    aiScore: 87,
    matchedNgo: null,
  },
  {
    id: 'REQ-004',
    type: 'food',
    urgency: 'high',
    name: 'Suresh Kumar',
    description: 'Lost daily wage job. Family of 3 with infant. Need food support.',
    lat: 27.1600, lng: 78.0400,
    area: 'Hari Parbat, Agra',
    people: 3,
    submittedAt: '5 hours ago',
    status: 'in_progress',
    aiScore: 82,
    matchedNgo: 'Rotary Club Agra',
  },
  {
    id: 'REQ-005',
    type: 'education',
    urgency: 'medium',
    name: 'Prem Shankar',
    description: '3 children dropped out due to fees. Seeking scholarship/support.',
    lat: 27.4924, lng: 77.6737,
    area: 'Mathura City',
    people: 3,
    submittedAt: '1 day ago',
    status: 'pending',
    aiScore: 65,
    matchedNgo: null,
  },
  {
    id: 'REQ-006',
    type: 'medical',
    urgency: 'high',
    name: 'Fatima Khatoon',
    description: 'Pregnant woman, 8 months. No access to prenatal care. Very poor.',
    lat: 27.2000, lng: 78.0300,
    area: 'Kalindi Vihar, Agra',
    people: 2,
    submittedAt: '6 hours ago',
    status: 'matched',
    aiScore: 89,
    matchedNgo: 'Health For All Foundation',
  },
  {
    id: 'REQ-007',
    type: 'food',
    urgency: 'medium',
    name: 'Ganesh Prasad',
    description: 'Flood displaced family. Ration card missing. Need interim food.',
    lat: 27.1500, lng: 77.9800,
    area: 'Etmadpur, Agra',
    people: 8,
    submittedAt: '2 days ago',
    status: 'fulfilled',
    aiScore: 72,
    matchedNgo: 'ISKCON Food Relief',
  },
  {
    id: 'REQ-008',
    type: 'shelter',
    urgency: 'medium',
    name: 'Deepak Rawat',
    description: 'Migrant labourer. Living under bridge. Seeking night shelter.',
    lat: 27.2100, lng: 78.0500,
    area: 'Yamuna Bridge, Agra',
    people: 1,
    submittedAt: '4 hours ago',
    status: 'pending',
    aiScore: 68,
    matchedNgo: null,
  },
];

// ── Registered NGOs / Donors ──────────────────────────────────────────
export const mockNGOs = [
  {
    id: 'NGO-001',
    name: 'Seva Charitable Trust',
    type: 'ngo',
    focus: ['food', 'medical'],
    lat: 27.1780, lng: 78.0120,
    area: 'Agra',
    capacity: 50,
    available: 35,
    rating: 4.8,
    verified: true,
    volunteersActive: 12,
  },
  {
    id: 'NGO-002',
    name: 'Health For All Foundation',
    type: 'ngo',
    focus: ['medical'],
    lat: 27.1900, lng: 78.0250,
    area: 'Agra',
    capacity: 30,
    available: 20,
    rating: 4.9,
    verified: true,
    volunteersActive: 8,
  },
  {
    id: 'NGO-003',
    name: 'Rotary Club Agra',
    type: 'donor',
    focus: ['food', 'education'],
    lat: 27.1650, lng: 78.0450,
    area: 'Agra',
    capacity: 100,
    available: 60,
    rating: 4.6,
    verified: true,
    volunteersActive: 22,
  },
  {
    id: 'NGO-004',
    name: 'ISKCON Food Relief',
    type: 'ngo',
    focus: ['food'],
    lat: 27.4900, lng: 77.6750,
    area: 'Mathura',
    capacity: 200,
    available: 180,
    rating: 5.0,
    verified: true,
    volunteersActive: 40,
  },
];

// ── Volunteers leaderboard ─────────────────────────────────────────────
export const mockVolunteers = [
  { id: 'V-001', name: 'Arjun Sharma', points: 0, fulfilled: 0, badge: 'starter', avatar: 'AS', area: 'Agra' },
  { id: 'V-002', name: 'Priya Gupta',  points: 0, fulfilled: 0, badge: 'starter', avatar: 'PG', area: 'Agra' },
  { id: 'V-003', name: 'Rahul Verma',  points: 0, fulfilled: 0, badge: 'starter', avatar: 'RV', area: 'Mathura' },
  { id: 'V-004', name: 'Sneha Jain',   points: 0, fulfilled: 0, badge: 'starter', avatar: 'SJ', area: 'Agra' },
  { id: 'V-005', name: 'Mohit Tiwari', points: 0, fulfilled: 0, badge: 'starter', avatar: 'MT', area: 'Firozabad' },
  { id: 'V-006', name: 'Divya Singh',  points: 0, fulfilled: 0, badge: 'starter', avatar: 'DS', area: 'Aligarh' },
  { id: 'V-007', name: 'Kiran Mishra', points: 0, fulfilled: 0, badge: 'starter', avatar: 'KM', area: 'Agra' },
];

// ── Dashboard KPI stats ───────────────────────────────────────────────
export const dashboardStats = {
  requestsToday: 47,
  fulfilledToday: 31,
  activeVolunteers: 89,
  ngosOnline: 12,
  avgResponseMin: 23,
  livesPacted: 4820,
};

// ── Predicted hotspots (AI-generated for next 24 hrs) ─────────────────
export const predictedHotspots = [
  { lat: 27.1767, lng: 78.0081, label: 'Tajganj', risk: 'very high', delta: '+18%' },
  { lat: 27.4924, lng: 77.6737, label: 'Mathura West', risk: 'high',      delta: '+12%' },
  { lat: 27.1500, lng: 78.3950, label: 'Firozabad', risk: 'medium', delta: '+7%'  },
  { lat: 27.0500, lng: 78.2000, label: 'Khandoli',  risk: 'medium', delta: '+5%'  },
];

// ── Need type config ──────────────────────────────────────────────────
export const needTypes = {
  food:      { label: 'Food',      color: '#F59E0B', bg: '#FEF3C7', icon: '🍱' },
  shelter:   { label: 'Shelter',   color: '#3B82F6', bg: '#DBEAFE', icon: '🏠' },
  medical:   { label: 'Medical',   color: '#EF4444', bg: '#FEE2E2', icon: '⚕️' },
  education: { label: 'Education', color: '#8B5CF6', bg: '#EDE9FE', icon: '📚' },
  other:     { label: 'Other',     color: '#6B7280', bg: '#F3F4F6', icon: '🤝' },
};

export const urgencyConfig = {
  critical: { label: 'Critical', color: '#EF4444', bg: '#FEE2E2', score: 90 },
  high:     { label: 'High',     color: '#F59E0B', bg: '#FEF3C7', score: 70 },
  medium:   { label: 'Medium',   color: '#10B981', bg: '#D1FAE5', score: 50 },
  low:      { label: 'Low',      color: '#6B7280', bg: '#F3F4F6', score: 25 },
};

// ── Recent activity feed ──────────────────────────────────────────────
export const activityFeed = [
  { id: 1, text: 'Seva Trust fulfilled food request in Tajganj', time: '2 min ago',  type: 'success' },
  { id: 2, text: 'New critical medical request in Lohamandi',     time: '5 min ago',  type: 'urgent'  },
  { id: 3, text: 'Volunteer Arjun completed shelter drop in Sikandra', time: '11 min ago', type: 'success' },
  { id: 4, text: 'ISKCON matched food request for 8 people',      time: '18 min ago', type: 'success' },
  { id: 5, text: 'New shelter request — family of 6 displaced',   time: '24 min ago', type: 'info'    },
  { id: 6, text: 'Priya Gupta earned Silver Volunteer badge',      time: '31 min ago', type: 'badge'   },
];
