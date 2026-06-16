const mongoose = require('mongoose');

const examBookingSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  examType: {
    type: String,
    required: true,
    enum: ['subject1', 'subject2', 'subject3', 'subject4'],
  },
  examRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamRoom',
    required: true,
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
    required: true,
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  examDate: {
    type: Date,
    required: true,
  },
  timeSlot: {
    startTime: String,
    endTime: String,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'late', 'locked'],
    default: 'pending',
  },
  isMakeup: {
    type: Boolean,
    default: false,
  },
  originalBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamBooking',
  },
  result: {
    score: Number,
    passed: Boolean,
    details: String,
  },
  checkInTime: Date,
  cancelReason: String,
  remark: String,
}, {
  timestamps: true,
});

examBookingSchema.index({ student: 1 });
examBookingSchema.index({ examDate: 1, examType: 1 });
examBookingSchema.index({ examRoom: 1, examDate: 1 });
examBookingSchema.index({ coach: 1, examDate: 1 });
examBookingSchema.index({ status: 1 });

module.exports = mongoose.model('ExamBooking', examBookingSchema);
