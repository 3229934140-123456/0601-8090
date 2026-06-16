const Coach = require('../models/Coach');
const { AppError } = require('../middleware/errorHandler');

const createCoach = async (coachData) => {
  const existingByEmployeeId = await Coach.findOne({ employeeId: coachData.employeeId });
  if (existingByEmployeeId) {
    throw new AppError('该工号已存在', 400);
  }

  const existingByIdCard = await Coach.findOne({ idCard: coachData.idCard });
  if (existingByIdCard) {
    throw new AppError('该身份证已注册', 400);
  }

  const coach = await Coach.create(coachData);
  return coach;
};

const getCoaches = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    licenseType,
    keyword,
  } = query;

  const filter = {};
  if (status) filter.status = status;
  if (licenseType) filter.licenseTypes = licenseType;
  if (keyword) {
    filter.$or = [
      { name: { $regex: keyword, $options: 'i' } },
      { employeeId: { $regex: keyword, $options: 'i' } },
      { phone: { $regex: keyword, $options: 'i' } },
    ];
  }

  const coaches = await Coach.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Coach.countDocuments(filter);

  return {
    coaches,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getCoachById = async (coachId) => {
  const coach = await Coach.findById(coachId).populate('assignedVehicles');
  if (!coach) {
    throw new AppError('教练不存在', 404);
  }
  return coach;
};

const updateCoach = async (coachId, updateData) => {
  const coach = await Coach.findByIdAndUpdate(
    coachId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!coach) {
    throw new AppError('教练不存在', 404);
  }

  return coach;
};

const deleteCoach = async (coachId) => {
  const coach = await Coach.findByIdAndUpdate(
    coachId,
    { status: 'disabled' },
    { new: true }
  );

  if (!coach) {
    throw new AppError('教练不存在', 404);
  }

  return coach;
};

const getAvailableCoaches = async (licenseType, date, timeSlot) => {
  const { findAvailableCoaches } = require('./exam.service');
  return findAvailableCoaches(licenseType, date, timeSlot);
};

module.exports = {
  createCoach,
  getCoaches,
  getCoachById,
  updateCoach,
  deleteCoach,
  getAvailableCoaches,
};
