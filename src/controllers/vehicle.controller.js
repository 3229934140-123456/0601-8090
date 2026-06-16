const vehicleService = require('../services/vehicle.service');

const createVehicle = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.createVehicle(req.body);
    res.status(201).json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

const getVehicles = async (req, res, next) => {
  try {
    const result = await vehicleService.getVehicles(req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getVehicle = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.getVehicleById(req.params.id);
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.updateVehicle(req.params.id, req.body);
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

const deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.deleteVehicle(req.params.id);
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

const updateMileage = async (req, res, next) => {
  try {
    const result = await vehicleService.updateMileage(
      req.params.id,
      req.body.mileage
    );
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getMaintenanceHistory = async (req, res, next) => {
  try {
    const result = await vehicleService.getMaintenanceHistory(req.params.id);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const createRepairOrder = async (req, res, next) => {
  try {
    const result = await vehicleService.createRepairOrder(
      req.params.id,
      req.body
    );
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVehicle,
  getVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle,
  updateMileage,
  getMaintenanceHistory,
  createRepairOrder,
};
