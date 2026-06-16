const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  plateNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  brand: {
    type: String,
    required: true,
    trim: true,
  },
  model: {
    type: String,
    required: true,
    trim: true,
  },
  licenseType: {
    type: String,
    required: true,
    enum: ['C1', 'C2', 'B1', 'B2', 'A1', 'A2'],
  },
  status: {
    type: String,
    enum: ['available', 'in_use', 'maintenance', 'repairing', 'disabled'],
    default: 'available',
  },
  mileage: {
    type: Number,
    default: 0,
  },
  lastMaintenanceMileage: {
    type: Number,
    default: 0,
  },
  nextMaintenanceMileage: {
    type: Number,
    default: 5000,
  },
  maintenanceInterval: {
    type: Number,
    default: 5000,
  },
  purchaseDate: {
    type: Date,
    required: true,
  },
  assignedCoach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coach',
  },
  currentLocation: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

vehicleSchema.index({ plateNumber: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ licenseType: 1 });
vehicleSchema.index({ mileage: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
