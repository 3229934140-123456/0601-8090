const mongoose = require('mongoose');

const examRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  examType: {
    type: String,
    required: true,
    enum: ['subject1', 'subject2', 'subject3', 'subject4'],
  },
  capacity: {
    type: Number,
    required: true,
    default: 30,
  },
  workDays: [{
    type: Number,
    enum: [0, 1, 2, 3, 4, 5, 6],
    default: [1, 2, 3, 4, 5],
  }],
  startTime: {
    type: String,
    default: '09:00',
  },
  endTime: {
    type: String,
    default: '17:00',
  },
  timeSlots: [{
    startTime: String,
    endTime: String,
    capacity: Number,
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active',
  },
}, {
  timestamps: true,
});

examRoomSchema.index({ examType: 1 });
examRoomSchema.index({ status: 1 });

module.exports = mongoose.model('ExamRoom', examRoomSchema);
