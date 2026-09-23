import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['citizen', 'user', 'ngo', 'volunteer', 'admin'],
      default: 'citizen',
    },
    area: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },

    // User (requester) fields
    people: { type: Number, default: 1 },

    // Volunteer fields
    skills: [{ type: String, trim: true }],
    points: { type: Number, default: 0 },
    badge: { type: String, default: 'starter' },
    deliveries: { type: Number, default: 0 },
    availableNow: { type: Boolean, default: true },
    parentNgoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // NGO fields
    orgName: { type: String, trim: true },
    regNumber: { type: String, trim: true },
    domains: [{ type: String, trim: true }],
    inviteCode: { type: String, trim: true },

    // Location
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [lng, lat]
      },
    },
  },
  { timestamps: true },
)

userSchema.index({ role: 1 })
userSchema.index({ parentNgoId: 1 })
userSchema.index({ inviteCode: 1 }, { sparse: true })
userSchema.index({ location: '2dsphere' }, { sparse: true })

export default mongoose.models.User || mongoose.model('User', userSchema)
