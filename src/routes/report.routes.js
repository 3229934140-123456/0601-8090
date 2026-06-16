const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');

router.get('/daily', reportController.getDailyReport);
router.get('/range', reportController.getDateRangeReport);
router.get('/export', reportController.exportExcel);
router.get('/vehicle-utilization', reportController.getVehicleUtilization);

module.exports = router;
