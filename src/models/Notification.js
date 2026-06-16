const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  recipientType: {
    type: String,
    required: true,
    enum: ['student', 'coach', 'admin', 'operator'],
  },
  type: {
    type: String,
    required: true,
    enum: [
      'enrollment_approved',
      'enrollment_rejected',
      'exam_booked',
      'exam_cancelled',
      'exam_result',
      'makeup_exam',
      'schedule_created',
      'schedule_changed',
      'shift_request',
      'shift_approved',
      'shift_rejected',
      'maintenance_created',
      'maintenance_escalated',
      'booking_restricted',
      'driving_license',
      'system_alert',
      'report_ready',
    ],
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  relatedType: String,
  read: {
    type: Boolean,
    default: false,
  },
  readAt: Date,
  pushed: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipientType: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
