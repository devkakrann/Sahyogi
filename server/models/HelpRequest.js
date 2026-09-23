import mongoose from 'mongoose'

const helpRequestSchema = new mongoose.Schema(
  {
    // Requester info
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    area: { type: String, trim: true },
    pincode: { type: String, trim: true },
    people: { type: Number, default: 1 },

    // Need & description
    selectedNeed: {
      type: String,
      enum: ['food', 'medical', 'shelter', 'water', 'rescue', 'education', 'clothing', 'other'],
      required: true,
    },
    description: { type: String, trim: true },
    notes: { type: String, trim: true },
    requestedType: { type: String, trim: true },

    // Location
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

    // AI triage results
    aiCategory: { type: String },
    urgencyLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    confidenceScore: { type: Number, default: 0 },
    aiSummary: { type: String },
    aiAction: { type: String },
    aiScore: { type: Number, default: 0 },
    priorityScore: { type: Number, default: 0 },

    // Assignment
    matchedNgos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NGOProfile' }],
    assignedNgoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedNgoName: { type: String, trim: true },
    assignedVolunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedVolunteerName: { type: String, trim: true },

    // Status tracking
    status: {
      type: String,
      enum: ['open', 'pending', 'matched', 'assigned', 'in_progress', 'fulfilled', 'cancelled'],
      default: 'pending',
    },
    claimedAt: { type: Date },
    assignedAt: { type: Date },
    fulfilledAt: { type: Date },

    // Source
    source: { type: String, default: 'web', enum: ['web', 'sms', 'voice', 'api'] },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true },
)

helpRequestSchema.index({ location: '2dsphere' })
helpRequestSchema.index({ selectedNeed: 1, urgencyLevel: 1, status: 1, createdAt: -1 })
helpRequestSchema.index({ userId: 1, createdAt: -1 })
helpRequestSchema.index({ assignedNgoId: 1, status: 1 })
helpRequestSchema.index({ assignedVolunteerId: 1, status: 1 })
helpRequestSchema.index({ status: 1, createdAt: -1 })

export default mongoose.models.HelpRequest || mongoose.model('HelpRequest', helpRequestSchema)
