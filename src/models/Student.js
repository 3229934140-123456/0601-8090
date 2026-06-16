const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  idCard: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  idCardExpiryDate: {
    type: Date,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  licenseType: {
    type: String,
    required: true,
    enum: ['C1', 'C2', 'B1', 'B2', 'A1', 'A2'],
  },
  healthReport: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reportUrl: String,
    uploadDate: Date,
    checkDate: Date,
    remark: String,
  },
  status: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected', 'learning', 'examining', 'completed', 'suspended'],
    default: 'pending_review',
  },
  rejectReason: {
    type: String,
  },
  studyHours: {
    theory: { type: Number, default: 0 },
    practical: { type: Number, default: 0 },
    requiredTheory: { type: Number, default: 12 },
    requiredPractical: { type: Number, default: 48 },
  },
  noShowCount: {
    type: Number,
    default: 0,
  },
  lateCount: {
    type: Number,
    default: 0,
  },
  bookingRestricted: {
    type: Boolean,
    default: false,
  },
  restrictionEndDate: Date,
  assignedCoach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
  },
  enrollmentDate: {
    type: Date,
    default: Date.now,
  },
  hasDrivingLicense: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

studentSchema.index({ idCard: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ bookingRestricted: 1 });

module.exports = mongoose.model('Student', studentSchema);
