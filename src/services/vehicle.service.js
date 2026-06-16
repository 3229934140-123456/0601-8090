const Vehicle = require('../models/Vehicle');
const { AppError } = require('../middleware/errorHandler');
const maintenanceService = require('./maintenance.service');

const createVehicle = async (vehicleData) => {
  const existing = await Vehicle.findOne({ plateNumber: vehicleData.plateNumber });
  if (existing) {
    throw new AppError('该车牌号已存在', 400);
  }

  const vehicle = await Vehicle.create(vehicleData);
  return vehicle;
};

const getVehicles = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    licenseType,
    assignedCoach,
    keyword,
  } = query;

  const filter = {};
  if (status) filter.status = status;
  if (licenseType) filter.licenseType = licenseType;
  if (assignedCoach) filter.assignedCoach = assignedCoach;
  if (keyword) {
    filter.$or = [
      { plateNumber: { $regex: keyword, $options: 'i' } },
      { brand: { $regex: keyword, $options: 'i' } },
      { model: { $regex: keyword, $options: 'i' } },
    ];
  }

  const vehicles = await Vehicle.find(filter)
    .populate('assignedCoach', 'name phone')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Vehicle.countDocuments(filter);

  const stats = await Vehicle.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    vehicles,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats,
  };
};

const getVehicleById = async (vehicleId) => {
  const vehicle = await Vehicle.findById(vehicleId)
    .populate('assignedCoach', 'name phone');

  if (!vehicle) {
    throw new AppError('车辆不存在', 404);
  }

  return vehicle;
};

const updateVehicle = async (vehicleId, updateData) => {
  const vehicle = await Vehicle.findByIdAndUpdate(
    vehicleId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!vehicle) {
    throw new AppError('车辆不存在', 404);
  }

  return vehicle;
};

const deleteVehicle = async (vehicleId) => {
  const vehicle = await Vehicle.findByIdAndUpdate(
    vehicleId,
    { status: 'disabled' },
    { new: true }
  );

  if (!vehicle) {
    throw new AppError('车辆不存在', 404);
  }

  return vehicle;
};

const updateMileage = async (vehicleId, mileage) => {
  return maintenanceService.updateVehicleMileage(vehicleId, mileage);
};

const getMaintenanceHistory = async (vehicleId) => {
  return maintenanceService.getVehicleMaintenanceHistory(vehicleId);
};

const createRepairOrder = async (vehicleId, repairData) => {
  return maintenanceService.createRepairOrder(vehicleId, repairData);
};

module.exports = {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  updateMileage,
  getMaintenanceHistory,
  createRepairOrder,
};
