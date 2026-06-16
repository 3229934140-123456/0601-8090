const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');

router.post('/', scheduleController.createSchedule);
router.get('/', scheduleController.getSchedules);
router.get('/:id', scheduleController.getSchedule);
router.put('/:id', scheduleController.updateSchedule);
router.post('/:id/complete', scheduleController.completeSchedule);
router.post('/:id/cancel', scheduleController.cancelSchedule);

router.post('/shift-change/request', scheduleController.requestShiftChange);
router.post('/shift-change/:id/approve', scheduleController.approveShiftChange);
router.post('/shift-change/:id/reject', scheduleController.rejectShiftChange);
router.get('/shift-change/list', scheduleController.getShiftChangeRequests);

module.exports = router;
