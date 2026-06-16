const scheduleService = require('../services/schedule.service');

const createSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.createSchedule(req.body);
    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

const getSchedules = async (req, res, next) => {
  try {
    const result = await scheduleService.getSchedules(req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id);
    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.updateSchedule(req.params.id, req.body);
    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

const completeSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.completeSchedule(req.params.id, req.body);
    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

const cancelSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.cancelSchedule(
      req.params.id,
      req.body.reason
    );
    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

const requestShiftChange = async (req, res, next) => {
  try {
    const request = await scheduleService.requestShiftChange(req.body);
    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const approveShiftChange = async (req, res, next) => {
  try {
    const result = await scheduleService.approveShiftChange(
      req.params.id,
      req.body.approverId,
      req.body.replacementCoachId
    );
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const rejectShiftChange = async (req, res, next) => {
  try {
    const request = await scheduleService.rejectShiftChange(
      req.params.id,
      req.body.approverId,
      req.body.rejectReason
    );
    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

const getShiftChangeRequests = async (req, res, next) => {
  try {
    const result = await scheduleService.getShiftChangeRequests(req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSchedule,
  getSchedules,
  getSchedule,
  updateSchedule,
  completeSchedule,
  cancelSchedule,
  requestShiftChange,
  approveShiftChange,
  rejectShiftChange,
  getShiftChangeRequests,
};
