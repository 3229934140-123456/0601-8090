const coachService = require('../services/coach.service');

const createCoach = async (req, res, next) => {
  try {
    const coach = await coachService.createCoach(req.body);
    res.status(201).json({
      success: true,
      data: coach,
    });
  } catch (error) {
    next(error);
  }
};

const getCoaches = async (req, res, next) => {
  try {
    const result = await coachService.getCoaches(req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getCoach = async (req, res, next) => {
  try {
    const coach = await coachService.getCoachById(req.params.id);
    res.json({
      success: true,
      data: coach,
    });
  } catch (error) {
    next(error);
  }
};

const updateCoach = async (req, res, next) => {
  try {
    const coach = await coachService.updateCoach(req.params.id, req.body);
    res.json({
      success: true,
      data: coach,
    });
  } catch (error) {
    next(error);
  }
};

const deleteCoach = async (req, res, next) => {
  try {
    const coach = await coachService.deleteCoach(req.params.id);
    res.json({
      success: true,
      data: coach,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCoach,
  getCoaches,
  getCoach,
  updateCoach,
  deleteCoach,
};
