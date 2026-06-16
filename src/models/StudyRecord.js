const mongoose = require('mongoose');

const studyRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
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
  schedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
  },
  studyType: {
    type: String,
    required: true,
    enum: ['theory', 'practical'],
  },
  duration: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: String,
  endTime: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'confirmed',
  },
  content: String,
  remark: String,
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
  },
}, {
  timestamps: true,
});

studyRecordSchema.index({ student: 1, date: 1 });
studyRecordSchema.index({ coach: 1, date: 1 });
studyRecordSchema.index({ studyType: 1 });
studyRecordSchema.index({ status: 1 });

module.exports = mongoose.model('StudyRecord', studyRecordSchema);
