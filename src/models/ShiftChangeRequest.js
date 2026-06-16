const mongoose = require('mongoose');

const shiftChangeRequestSchema = new mongoose.Schema({
  schedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    required: true,
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
    required: true,
  },
  originalSchedule: {
    date: Date,
    startTime: String,
    endTime: String,
  },
  requestedSchedule: {
    date: Date,
    startTime: String,
    endTime: String,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
  },
  approvalDate: Date,
  rejectReason: String,
  replacementCoach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
  },
}, {
  timestamps: true,
});

shiftChangeRequestSchema.index({ coach: 1, status: 1 });
shiftChangeRequestSchema.index({ status: 1 });

module.exports = mongoose.model('ShiftChangeRequest', shiftChangeRequestSchema);
