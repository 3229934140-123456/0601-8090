const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['theory', 'practical', 'exam', 'rest', 'other'],
    required: true,
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'changed'],
    default: 'scheduled',
  },
  studyHours: {
    type: Number,
    default: 0,
  },
  location: String,
  remark: String,
  sourceBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamBooking',
  },
}, {
  timestamps: true,
});

scheduleSchema.index({ coach: 1, date: 1 });
scheduleSchema.index({ student: 1, date: 1 });
scheduleSchema.index({ status: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
