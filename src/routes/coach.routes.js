const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coach.controller');

router.post('/', coachController.createCoach);
router.get('/', coachController.getCoaches);
router.get('/:id', coachController.getCoach);
router.put('/:id', coachController.updateCoach);
router.delete('/:id', coachController.deleteCoach);

module.exports = router;
