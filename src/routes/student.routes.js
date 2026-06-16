const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');

router.post('/enroll', studentController.enroll);
router.post('/:id/verify-health', studentController.verifyHealth);
router.get('/:id', studentController.getStudent);
router.get('/', studentController.getStudents);
router.put('/:id', studentController.updateStudent);
router.get('/:id/validate', studentController.validateEnrollment);

module.exports = router;
