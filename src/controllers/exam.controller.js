const examService = require('../services/exam.service');
const examResultService = require('../services/examResult.service');

const bookExam = async (req, res, next) => {
  try {
    const result = await examService.bookExam({
      ...req.body,
      studentId: req.body.studentId,
    });
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const cancelBooking = async (req, res, next) => {
  try {
    const result = await examService.cancelBooking(
      req.params.id,
      req.body.reason
    );
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const lockBooking = async (req, res, next) => {
  try {
    const booking = await examService.lockBooking(req.params.id);
    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

const getBookings = async (req, res, next) => {
  try {
    const result = await examService.getBookings(req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getBooking = async (req, res, next) => {
  try {
    const booking = await examService.getBookingById(req.params.id);
    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

const getAvailableSlots = async (req, res, next) => {
  try {
    const { examType, examRoomId, date } = req.query;
    const slots = await examService.getAvailableSlots(examType, examRoomId, date);
    res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

const suggestAlternatives = async (req, res, next) => {
  try {
    const { examType, licenseType, preferredDate } = req.body;
    const suggestions = await examService.suggestAlternativeSlots(
      examType,
      licenseType,
      preferredDate
    );
    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
};

const uploadResult = async (req, res, next) => {
  try {
    const result = await examResultService.uploadExamResult(
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const recordNoShow = async (req, res, next) => {
  try {
    const result = await examResultService.recordNoShow(req.params.id);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const recordLate = async (req, res, next) => {
  try {
    const result = await examResultService.recordLate(
      req.params.id,
      req.body.minutesLate
    );
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getExamResults = async (req, res, next) => {
  try {
    const result = await examResultService.getExamResults(req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getDrivingLicense = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const license = await examResultService.getDrivingLicenseByStudent(studentId);
    res.json({
      success: true,
      data: license,
    });
  } catch (error) {
    next(error);
  }
};

const checkRestriction = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const result = await examResultService.checkBookingRestriction(studentId);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bookExam,
  cancelBooking,
  lockBooking,
  getBookings,
  getBooking,
  getAvailableSlots,
  suggestAlternatives,
  uploadResult,
  recordNoShow,
  recordLate,
  getExamResults,
  getDrivingLicense,
  checkRestriction,
};
