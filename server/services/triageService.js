const CRITICAL_WORDS = ['unconscious', 'bleeding', 'fire', 'accident', 'trapped', 'heart attack', 'stroke']
const HIGH_WORDS = ['urgent', 'severe', 'no food', 'no water', 'injury', 'pregnant', 'child', 'elderly']
const MEDIUM_WORDS = ['need medicine', 'need shelter', 'need food', 'need help', 'support required']

export function classifyUrgency(selectedNeed, description) {
  const safeNeed = String(selectedNeed || 'food').toLowerCase()
  const text = String(description || '').toLowerCase()

  let urgencyLevel = 'low'
  let confidenceScore = 0.5

  if (CRITICAL_WORDS.some((word) => text.includes(word))) {
    urgencyLevel = 'critical'
    confidenceScore = 0.95
  } else if (HIGH_WORDS.some((word) => text.includes(word))) {
    urgencyLevel = 'high'
    confidenceScore = 0.85
  } else if (MEDIUM_WORDS.some((word) => text.includes(word))) {
    urgencyLevel = 'medium'
    confidenceScore = 0.75
  }

  return {
    aiCategory: safeNeed,
    urgencyLevel,
    confidenceScore,
  }
}

