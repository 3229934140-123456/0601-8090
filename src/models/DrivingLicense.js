const mongoose = require('mongoose');

const drivingLicenseSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    unique: true,
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
  },
  licenseType: {
    type: String,
    required: true,
    enum: ['C1', 'C2', 'B1', 'B2', 'A1', 'A2'],
  },
  issueDate: {
    type: Date,
    required: true,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['valid', 'expired', 'revoked', 'suspended'],
    default: 'valid',
  },
  examRecords: [{
    examType: String,
    score: Number,
    passed: Boolean,
    examDate: Date,
  }],
  qrCodeUrl: String,
  issueAuthority: {
    type: String,
    default: '本地车辆管理所',
  },
}, {
  timestamps: true,
});

drivingLicenseSchema.index({ student: 1 });
drivingLicenseSchema.index({ licenseNumber: 1 });
drivingLicenseSchema.index({ status: 1 });

module.exports = mongoose.model('DrivingLicense', drivingLicenseSchema);
