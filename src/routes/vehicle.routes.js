const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicle.controller');

router.post('/', vehicleController.createVehicle);
router.get('/', vehicleController.getVehicles);
router.get('/:id', vehicleController.getVehicle);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);
router.post('/:id/mileage', vehicleController.updateMileage);
router.get('/:id/maintenance', vehicleController.getMaintenanceHistory);
router.post('/:id/repair', vehicleController.createRepairOrder);

module.exports = router;
