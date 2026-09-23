import mongoose from 'mongoose'

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI
}

export async function connectMongo() {
  const mongoUri = getMongoUri()
  if (!mongoUri) {
    console.warn('MongoDB not configured: set MONGO_URI or MONGODB_URI to enable /api/help and /api/auth/jwt routes.')
    return false
  }

  if (mongoose.connection.readyState === 1) {
    return true
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })
    console.log('MongoDB connected')
    return true
  } catch (error) {
    console.warn(`MongoDB connection failed: ${error.message}`)
    return false
  }
}

export function isMongoReady() {
  return mongoose.connection.readyState === 1
}
