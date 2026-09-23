import jwt from 'jsonwebtoken'
import { isMongoReady } from '../db/mongoose.js'
import User from '../models/User.js'

const jwtSecret = process.env.JWT_SECRET || 'sahayak-dev-secret'

export default async function authJwt(req, res, next) {
  if (!isMongoReady()) {
    return res.status(503).json({ message: 'MongoDB not connected. Configure MONGO_URI and restart server.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token' })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    return res.status(401).json({ message: 'No token' })
  }

  try {
    const decoded = jwt.verify(token, jwtSecret)
    const user = await User.findById(decoded.userId).select('_id role fullName phone email')
    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    req.user = {
      userId: String(user._id),
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
    }
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Requires role: ${roles.join(', ')}` })
    }
    return next()
  }
}

