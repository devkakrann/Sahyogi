import mongoose from 'mongoose'

const ngoProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    ngoName: { type: String, required: true, trim: true },
    servicesOffered: [
      {
        type: String,
        enum: ['food', 'medical', 'shelter', 'water', 'rescue', 'education'],
      },
    ],
    priorityLevelsHandled: [
      {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
      },
    ],
    availableNow: { type: Boolean, default: true },
    coverageRadiusKm: { type: Number, default: 10, min: 1, max: 300 },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
  },
  { timestamps: true },
)

ngoProfileSchema.index({ location: '2dsphere' })
ngoProfileSchema.index({ servicesOffered: 1, availableNow: 1 })

export default mongoose.models.NGOProfile || mongoose.model('NGOProfile', ngoProfileSchema)

