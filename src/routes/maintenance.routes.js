const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');

router.get('/', maintenanceController.getOrders);
router.get('/check', maintenanceController.checkMaintenance);
router.post('/repair', maintenanceController.createRepairOrder);
router.get('/:id', maintenanceController.getOrder);
router.post('/:id/start', maintenanceController.startMaintenance);
router.post('/:id/complete', maintenanceController.completeMaintenance);
router.post('/:id/escalate', maintenanceController.escalateOrder);
router.post('/:id/cancel', maintenanceController.cancelOrder);

module.exports = router;
