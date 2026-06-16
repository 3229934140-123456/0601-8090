const mongoose = require('mongoose');

const coachSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  idCard: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  licenseTypes: [{
    type: String,
    enum: ['C1', 'C2', 'B1', 'B2', 'A1', 'A2'],
  }],
  coachLicenseNumber: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'leave', 'disabled'],
    default: 'active',
  },
  assignedVehicles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  }],
  skills: [{
    type: String,
  }],
  hireDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

coachSchema.index({ employeeId: 1 });
coachSchema.index({ status: 1 });
coachSchema.index({ licenseTypes: 1 });

module.exports = mongoose.model('Coach', coachSchema);
