const express = require('express');
const router = express.Router();
const examController = require('../controllers/exam.controller');

router.post('/book', examController.bookExam);
router.post('/:id/cancel', examController.cancelBooking);
router.post('/:id/lock', examController.lockBooking);
router.post('/:id/result', examController.uploadResult);
router.post('/:id/no-show', examController.recordNoShow);
router.post('/:id/late', examController.recordLate);
router.get('/available-slots', examController.getAvailableSlots);
router.post('/suggest-alternatives', examController.suggestAlternatives);
router.get('/results/list', examController.getExamResults);
router.get('/driving-license/:studentId', examController.getDrivingLicense);
router.get('/restriction/:studentId', examController.checkRestriction);
router.get('/:id', examController.getBooking);
router.get('/', examController.getBookings);

module.exports = router;
