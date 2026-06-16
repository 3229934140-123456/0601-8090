const studentService = require('../services/student.service');

const enroll = async (req, res, next) => {
  try {
    const result = await studentService.enrollStudent(req.body);
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const verifyHealth = async (req, res, next) => {
  try {
    const result = await studentService.verifyHealthReport(
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

const getStudent = async (req, res, next) => {
  try {
    const student = await studentService.getStudentById(req.params.id);
    res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

const getStudents = async (req, res, next) => {
  try {
    const result = await studentService.getStudents(req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);
    res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

const validateEnrollment = async (req, res, next) => {
  try {
    const result = await studentService.validateEnrollment(req.params.id);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enroll,
  verifyHealth,
  getStudent,
  getStudents,
  updateStudent,
  validateEnrollment,
};
