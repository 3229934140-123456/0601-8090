const maintenanceService = require('../services/maintenance.service');

const getOrders = async (req, res, next) => {
  try {
    const result = await maintenanceService.getMaintenanceOrders(req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await maintenanceService.getMaintenanceOrderById(req.params.id);
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const startMaintenance = async (req, res, next) => {
  try {
    const order = await maintenanceService.startMaintenance(
      req.params.id,
      req.body.technicianId
    );
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const completeMaintenance = async (req, res, next) => {
  try {
    const order = await maintenanceService.completeMaintenance(
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const escalateOrder = async (req, res, next) => {
  try {
    const order = await maintenanceService.escalateOrder(
      req.params.id,
      req.body.reason
    );
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await maintenanceService.cancelMaintenanceOrder(
      req.params.id,
      req.body.reason
    );
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const createRepairOrder = async (req, res, next) => {
  try {
    const result = await maintenanceService.createRepairOrder(
      req.body.vehicleId,
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

const checkMaintenance = async (req, res, next) => {
  try {
    const orders = await maintenanceService.checkAndCreateMaintenanceOrders();
    res.json({
      success: true,
      createdCount: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrders,
  getOrder,
  startMaintenance,
  completeMaintenance,
  escalateOrder,
  cancelOrder,
  createRepairOrder,
  checkMaintenance,
};
