export function getRawUserName(user) {
  const value = String(user?.fullName || user?.name || 'User').trim()
  return value || 'User'
}

export function getUserInitial(user) {
  return getRawUserName(user).charAt(0).toUpperCase() || 'U'
}

export function getShortUserName(user, maxChars = 10) {
  const firstName = getRawUserName(user).split(/\s+/)[0] || 'User'
  return firstName.length > maxChars ? `${firstName.slice(0, maxChars)}...` : firstName
}
