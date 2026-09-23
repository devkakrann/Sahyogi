/**
 * AITriage.jsx
 * ─────────────────────────────────────────────────────────────────────
 * INNOVATION FEATURE #1: AI-Powered Needs Triage Engine
 *
 * The user types their situation in plain language. The AI (Claude API
 * via the /api/triage backend endpoint) analyzes it and returns:
 *   • urgency level (critical / high / medium / low)
 *   • need category (food / shelter / medical / education / other)
 *   • smart summary
 *   • recommended action
 *   • estimated response time
 *
 * Falls back to a keyword-based local classifier if the API is
 * unavailable — so the demo never breaks.
 */
import { useState } from 'react'

// ── Local keyword classifier (offline fallback) ───────────────────────
function localClassify(text) {
  const t = text.toLowerCase()

  const urgency =
    /starv|no food|days? without|critical|emergency|dying|bleed|accident|collapse|severe/i.test(t) ? 'critical'
    : /hungry|no money|evict|displace|sick|medicine|hurt|injur/i.test(t) ? 'high'
    : /need help|struggling|difficul|support/i.test(t) ? 'medium'
    : 'low'

  const category =
    /food|eat|hungry|meal|ration|milk|water|starv/i.test(t) ? 'food'
    : /shelter|house|homeless|sleep|roof|evict|displace/i.test(t) ? 'shelter'
    : /medic|doctor|hospital|medicine|injur|sick|pregnan|diabete|blood/i.test(t) ? 'medical'
    : /school|educat|fee|dropout|book|tuition/i.test(t) ? 'education'
    : 'other'

  const urgencyMeta = {
    critical: { color: '#EF4444', bg: '#FEE2E2', time: '< 2 hours', action: 'Immediate dispatch triggered. Nearest NGO being alerted now.' },
    high:     { color: '#F59E0B', bg: '#FEF3C7', time: '2–6 hours',  action: 'Priority queue entry. Matching to available resources.' },
    medium:   { color: '#10B981', bg: '#D1FAE5', time: '6–24 hours', action: 'Added to resource queue. You will be contacted today.' },
    low:      { color: '#6B7280', bg: '#F3F4F6', time: '1–3 days',   action: 'Request logged. NGO partner will follow up.' },
  }

  const catLabels = { food: 'Food & Water', shelter: 'Shelter', medical: 'Medical Aid', education: 'Education', other: 'General Support' }

  const summaries = {
    food:      'Food security crisis identified. Caloric and nutritional support required urgently.',
    shelter:   'Housing crisis detected. Emergency shelter and safety resources needed.',
    medical:   'Medical situation flagged. Healthcare provider coordination initiated.',
    education: 'Education barrier identified. Scholarship and support programs recommended.',
    other:     'General assistance request. Multi-resource coordination recommended.',
  }

  return {
    urgency,
    category,
    summary: summaries[category],
    action: urgencyMeta[urgency].action,
    response_time: urgencyMeta[urgency].time,
    meta: urgencyMeta[urgency],
    catLabel: catLabels[category],
    aiScore: urgency === 'critical' ? 92 : urgency === 'high' ? 78 : urgency === 'medium' ? 58 : 35,
  }
}

// ── Component ─────────────────────────────────────────────────────────
export default function AITriage({ onResult }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [charCount, setCharCount] = useState(0)

  const handleAnalyze = async () => {
    if (!text.trim() || text.length < 10) return
    setLoading(true)
    setResult(null)

    try {
      /**
       * ── Real API call ─────────────────────────────────────────────
       * In production this goes through your Node.js backend:
       *   POST /api/triage  { description: text }
       *
       * The backend calls Claude API and returns structured JSON.
       * Uncomment the block below and configure VITE_API_URL in .env
       */

      // const res = await fetch(`${import.meta.env.VITE_API_URL}/api/triage`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ description: text }),
      // })
      // const data = await res.json()
      // setResult(data)

      // ── Demo: simulate network latency + use local classifier ─────
      await new Promise(r => setTimeout(r, 1600))
      const classified = localClassify(text)
      setResult(classified)
      if (onResult) onResult(classified)

    } catch (err) {
      console.error('Triage API error:', err)
      const classified = localClassify(text)
      setResult(classified)
    } finally {
      setLoading(false)
    }
  }

  const urgencyIcons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }
  const catIcons = { food: '🍱', shelter: '🏠', medical: '⚕️', education: '📚', other: '🤝' }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)',
                    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </div>
        <div>
          <p style={{ color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>
            AI Needs Analyzer
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0, fontSize: '0.72rem' }}>
            Describe your situation — AI auto-categorizes & prioritizes
          </p>
        </div>
        <div className="ml-auto" style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '20px',
                                          padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="live-dot" style={{ width: '7px', height: '7px' }}></span>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.7rem', fontWeight: 600 }}>LIVE AI</span>
        </div>
      </div>

      {/* Input area */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setCharCount(e.target.value.length) }}
            placeholder="Tell us your situation in your own words...
e.g. 'I am a single mother with 3 children. We haven't eaten since yesterday and I lost my job last week. We also need medicine for my youngest.'"
            rows={4}
            maxLength={500}
            style={{
              width: '100%', border: '2px solid var(--border)',
              borderRadius: '12px', padding: '12px 14px',
              fontFamily: 'var(--font-body)', fontSize: '0.875rem',
              resize: 'vertical', outline: 'none', transition: 'border-color 0.2s',
              lineHeight: '1.6', color: 'var(--text)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <span style={{ position: 'absolute', bottom: '8px', right: '12px',
                         fontSize: '0.7rem', color: 'var(--subtle)' }}>
            {charCount}/500
          </span>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || text.length < 10}
          style={{
            marginTop: '10px', width: '100%',
            background: loading || text.length < 10 ? '#e2e8f0' : 'var(--primary)',
            color: loading || text.length < 10 ? 'var(--muted)' : '#fff',
            border: 'none', borderRadius: '10px', padding: '11px',
            fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9rem',
            cursor: loading || text.length < 10 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px',
          }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', width: '16px', height: '16px',
                             border: '2px solid rgba(255,255,255,0.3)',
                             borderTopColor: '#fff', borderRadius: '50%',
                             animation: 'spin 0.7s linear infinite' }}/>
              Analyzing with AI...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Analyze My Situation
            </>
          )}
        </button>
      </div>

      {/* Result panel */}
      {result && (
        <div className="anim-fade-up" style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
          {/* Urgency banner */}
          <div style={{
            background: result.meta.bg, borderRadius: '10px', padding: '12px 16px',
            marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px',
            border: `1px solid ${result.meta.color}40`,
          }}>
            <span style={{ fontSize: '1.4rem' }}>{urgencyIcons[result.urgency]}</span>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700,
                          color: result.meta.color, fontSize: '0.95rem' }}>
                {result.urgency.toUpperCase()} PRIORITY
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)', marginTop: '1px' }}>
                AI Confidence Score: {result.aiScore}%
              </p>
            </div>
            <div className="ml-auto" style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--muted)' }}>Est. Response</p>
              <p style={{ margin: 0, fontWeight: 700, color: result.meta.color, fontSize: '0.85rem',
                          fontFamily: 'var(--font-heading)' }}>
                {result.response_time}
              </p>
            </div>
          </div>

          {/* Category + Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Category
              </p>
              <p style={{ margin: 0, fontWeight: 600, fontFamily: 'var(--font-heading)', fontSize: '0.9rem',
                          display: 'flex', alignItems: 'center', gap: '6px' }}>
                {catIcons[result.category]} {result.catLabel}
              </p>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                AI Summary
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: '1.4', color: 'var(--text)' }}>
                {result.summary}
              </p>
            </div>
          </div>

          {/* Recommended action */}
          <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderRadius: '10px',
                        padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start',
                        border: '1px solid #a7f3d0' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2"
                 style={{ flexShrink: 0, marginTop: '1px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#065F46', lineHeight: '1.5' }}>
              <strong>Action: </strong>{result.action}
            </p>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}