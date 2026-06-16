const mongoose = require('mongoose');

const maintenanceOrderSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true,
  },
  orderType: {
    type: String,
    required: true,
    enum: ['routine_maintenance', 'repair', 'inspection'],
    default: 'routine_maintenance',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'escalated'],
    default: 'pending',
  },
  mileageAtCreation: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  assignedTechnician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
  },
  technicianSkills: [{
    type: String,
  }],
  scheduledDate: Date,
  startDate: Date,
  completionDate: Date,
  deadline: Date,
  isOverdue: {
    type: Boolean,
    default: false,
  },
  overdueHours: {
    type: Number,
    default: 0,
  },
  cost: {
    type: Number,
    default: 0,
  },
  parts: [{
    name: String,
    quantity: Number,
    unitPrice: Number,
  }],
  notes: String,
}, {
  timestamps: true,
});

maintenanceOrderSchema.index({ vehicle: 1 });
maintenanceOrderSchema.index({ status: 1 });
maintenanceOrderSchema.index({ priority: 1 });
maintenanceOrderSchema.index({ assignedTechnician: 1 });
maintenanceOrderSchema.index({ createdAt: 1 });

module.exports = mongoose.model('MaintenanceOrder', maintenanceOrderSchema);
