const ExamBooking = require('../models/ExamBooking');
const ExamRoom = require('../models/ExamRoom');
const Student = require('../models/Student');
const Coach = require('../models/Coach');
const Vehicle = require('../models/Vehicle');
const Schedule = require('../models/Schedule');
const { AppError } = require('../middleware/errorHandler');
const { formatDate, timeOverlap, addDays, diffHours } = require('../utils/dateUtils');
const { validateEnrollment } = require('./student.service');
const { notifyStudent, notifyCoach, notifyOperator } = require('./notification.service');

const checkStudyHoursQualified = (student, examType) => {
  const { studyHours } = student;

  if (examType === 'subject1') {
    return studyHours.theory >= 12;
  }
  if (examType === 'subject2') {
    return studyHours.theory >= 12 && studyHours.practical >= 16;
  }
  if (examType === 'subject3') {
    return studyHours.theory >= 12 && studyHours.practical >= 32;
  }
  if (examType === 'subject4') {
    return studyHours.theory >= 16 && studyHours.practical >= 48;
  }

  return false;
};

const getRequiredStudyHours = (examType) => {
  const requirements = {
    subject1: { theory: 12, practical: 0 },
    subject2: { theory: 12, practical: 16 },
    subject3: { theory: 12, practical: 32 },
    subject4: { theory: 16, practical: 48 },
  };
  return requirements[examType] || { theory: 0, practical: 0 };
};

const getCoachAvailability = async (coachId, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const schedules = await Schedule.find({
    coach: coachId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['scheduled', 'in_progress'] },
  });

  const bookings = await ExamBooking.find({
    coach: coachId,
    examDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed', 'locked'] },
  });

  const busySlots = [
    ...schedules.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      type: 'schedule',
    })),
    ...bookings.map((b) => ({
      startTime: b.timeSlot.startTime,
      endTime: b.timeSlot.endTime,
      type: 'exam',
    })),
  ];

  return busySlots;
};

const getExamRoomCapacity = async (examRoomId, date, timeSlot) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const examRoom = await ExamRoom.findById(examRoomId);
  if (!examRoom) {
    throw new AppError('考场不存在', 404);
  }

  const bookings = await ExamBooking.find({
    examRoom: examRoomId,
    examDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed', 'locked'] },
    'timeSlot.startTime': timeSlot.startTime,
    'timeSlot.endTime': timeSlot.endTime,
  });

  const slotConfig = examRoom.timeSlots.find(
    (s) => s.startTime === timeSlot.startTime && s.endTime === timeSlot.endTime
  );

  const capacity = slotConfig ? slotConfig.capacity : examRoom.capacity;

  return {
    total: capacity,
    used: bookings.length,
    available: capacity - bookings.length,
  };
};

const checkCoachAvailable = (busySlots, startTime, endTime) => {
  for (const slot of busySlots) {
    if (timeOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
      return { available: false, conflict: slot };
    }
  }
  return { available: true, conflict: null };
};

const findAvailableCoaches = async (licenseType, date, timeSlot) => {
  const coaches = await Coach.find({
    status: 'active',
    licenseTypes: licenseType,
  });

  const availableCoaches = [];

  for (const coach of coaches) {
    const busySlots = await getCoachAvailability(coach._id, date);
    const { available } = checkCoachAvailable(
      busySlots,
      timeSlot.startTime,
      timeSlot.endTime
    );
    if (available) {
      availableCoaches.push(coach);
    }
  }

  return availableCoaches;
};

const findAvailableVehicles = async (licenseType, date, timeSlot) => {
  const vehicles = await Vehicle.find({
    status: 'available',
    licenseType,
  });

  const availableVehicles = [];

  for (const vehicle of vehicles) {
    const bookings = await ExamBooking.find({
      vehicle: vehicle._id,
      examDate: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999),
      },
      status: { $in: ['pending', 'confirmed', 'locked'] },
      'timeSlot.startTime': timeSlot.startTime,
      'timeSlot.endTime': timeSlot.endTime,
    });

    if (bookings.length === 0) {
      availableVehicles.push(vehicle);
    }
  }

  return availableVehicles;
};

const suggestAlternativeSlots = async (examType, licenseType, preferredDate, days = 7) => {
  const suggestions = [];
  const examRooms = await ExamRoom.find({
    examType,
    status: 'active',
  });

  for (let i = 1; i <= days; i++) {
    const checkDate = addDays(preferredDate, i);
    const dayOfWeek = checkDate.getDay();

    for (const room of examRooms) {
      if (!room.workDays.includes(dayOfWeek)) continue;

      for (const slot of room.timeSlots) {
        const capacity = await getExamRoomCapacity(room._id, checkDate, slot);
        if (capacity.available > 0) {
          const coaches = await findAvailableCoaches(licenseType, checkDate, slot);
          const vehicles = await findAvailableVehicles(licenseType, checkDate, slot);

          if (coaches.length > 0 && (examType === 'subject1' || examType === 'subject4' || vehicles.length > 0)) {
            suggestions.push({
              date: checkDate,
              timeSlot: slot,
              examRoom: room._id,
              examRoomName: room.name,
              availableCoaches: coaches.length,
              availableVehicles: vehicles.length,
              remainingCapacity: capacity.available,
            });
          }
        }
      }
    }
  }

  return suggestions.slice(0, 10);
};

const bookExam = async (bookingData) => {
  const {
    studentId,
    examType,
    examDate,
    timeSlot,
    examRoomId,
    coachId,
    vehicleId,
  } = bookingData;

  const validation = await validateEnrollment(studentId);
  if (!validation.valid) {
    throw new AppError(`预约失败：${validation.issues.join('；')}`, 400);
  }

  const student = validation.student;

  if (!checkStudyHoursQualified(student, examType)) {
    const required = getRequiredStudyHours(examType);
    throw new AppError(
      `学时不足，无法预约。需要理论${required.theory}学时，实操${required.practical}学时；当前理论${student.studyHours.theory}学时，实操${student.studyHours.practical}学时。`,
      400
    );
  }

  const existingBooking = await ExamBooking.findOne({
    student: studentId,
    examType,
    status: { $in: ['pending', 'confirmed', 'locked'] },
  });

  if (existingBooking) {
    throw new AppError('您已有该科目的待考预约，无法重复预约', 400);
  }

  const examRoom = await ExamRoom.findById(examRoomId);
  if (!examRoom || examRoom.status !== 'active') {
    throw new AppError('考场不可用', 400);
  }

  if (examRoom.examType !== examType) {
    throw new AppError('该考场不支持此考试类型', 400);
  }

  const dayOfWeek = new Date(examDate).getDay();
  if (!examRoom.workDays.includes(dayOfWeek)) {
    throw new AppError('所选日期考场不开放', 400);
  }

  const capacity = await getExamRoomCapacity(examRoomId, examDate, timeSlot);
  if (capacity.available <= 0) {
    const suggestions = await suggestAlternativeSlots(
      examType,
      student.licenseType,
      examDate
    );
    return {
      success: false,
      conflict: true,
      reason: '所选时段考场已满',
      suggestions,
    };
  }

  const coach = await Coach.findById(coachId || student.assignedCoach);
  if (!coach || coach.status !== 'active') {
    throw new AppError('教练不可用', 400);
  }

  if (!coach.licenseTypes.includes(student.licenseType)) {
    throw new AppError('该教练不支持此驾照类型教学', 400);
  }

  const coachBusySlots = await getCoachAvailability(coach._id, examDate);
  const coachCheck = checkCoachAvailable(
    coachBusySlots,
    timeSlot.startTime,
    timeSlot.endTime
  );

  if (!coachCheck.available) {
    const suggestions = await suggestAlternativeSlots(
      examType,
      student.licenseType,
      examDate
    );
    return {
      success: false,
      conflict: true,
      reason: '所选时段教练有安排',
      conflictType: 'coach',
      suggestions,
    };
  }

  let vehicle = null;
  if (examType === 'subject2' || examType === 'subject3') {
    if (vehicleId) {
      vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle || vehicle.status !== 'available') {
        throw new AppError('所选车辆不可用', 400);
      }
    } else {
      const vehicles = await findAvailableVehicles(
        student.licenseType,
        examDate,
        timeSlot
      );
      if (vehicles.length === 0) {
        const suggestions = await suggestAlternativeSlots(
          examType,
          student.licenseType,
          examDate
        );
        return {
          success: false,
          conflict: true,
          reason: '所选时段无可用车辆',
          conflictType: 'vehicle',
          suggestions,
        };
      }
      vehicle = vehicles[0];
    }
  }

  const booking = await ExamBooking.create({
    student: studentId,
    examType,
    examRoom: examRoomId,
    coach: coach._id,
    vehicle: vehicle ? vehicle._id : null,
    examDate,
    timeSlot,
    status: 'confirmed',
  });

  await Schedule.create({
    coach: coach._id,
    student: studentId,
    vehicle: vehicle ? vehicle._id : null,
    date: examDate,
    startTime: timeSlot.startTime,
    endTime: timeSlot.endTime,
    type: 'exam',
    status: 'scheduled',
    sourceBooking: booking._id,
  });

  if (vehicle) {
    vehicle.status = 'in_use';
    await vehicle.save();
  }

  await notifyStudent(
    studentId,
    'exam_booked',
    '考试预约成功',
    `您的${getExamTypeName(examType)}预约已成功，时间：${formatDate(examDate)} ${timeSlot.startTime}-${timeSlot.endTime}，考场：${examRoom.name}`,
    booking._id,
    'ExamBooking'
  );

  await notifyCoach(
    coach._id,
    'exam_booked',
    '新考试预约',
    `学员${student.name}预约了${formatDate(examDate)} ${timeSlot.startTime}-${timeSlot.endTime}的${getExamTypeName(examType)}考试。`,
    booking._id,
    'ExamBooking'
  );

  return {
    success: true,
    booking,
    message: '预约成功',
  };
};

const getExamTypeName = (type) => {
  const names = {
    subject1: '科目一（理论）',
    subject2: '科目二（场地驾驶）',
    subject3: '科目三（道路驾驶）',
    subject4: '科目四（安全文明）',
  };
  return names[type] || type;
};

const cancelBooking = async (bookingId, reason = '') => {
  const booking = await ExamBooking.findById(bookingId);
  if (!booking) {
    throw new AppError('预约不存在', 404);
  }

  if (!['pending', 'confirmed', 'locked'].includes(booking.status)) {
    throw new AppError('该预约状态不允许取消', 400);
  }

  booking.status = 'cancelled';
  booking.cancelReason = reason;
  await booking.save();

  const schedule = await Schedule.findOne({ sourceBooking: bookingId });
  if (schedule) {
    schedule.status = 'cancelled';
    await schedule.save();
  }

  if (booking.vehicle) {
    const vehicle = await Vehicle.findById(booking.vehicle);
    if (vehicle) {
      const hasOtherBookings = await ExamBooking.countDocuments({
        vehicle: vehicle._id,
        status: { $in: ['pending', 'confirmed', 'locked'] },
        _id: { $ne: bookingId },
      });
      if (hasOtherBookings === 0) {
        vehicle.status = 'available';
        await vehicle.save();
      }
    }
  }

  await notifyStudent(
    booking.student,
    'exam_cancelled',
    '考试预约已取消',
    `您的${getExamTypeName(booking.examType)}预约已取消${reason ? `，原因：${reason}` : ''}。`,
    booking._id,
    'ExamBooking'
  );

  return {
    success: true,
    booking,
    message: '取消成功',
  };
};

const lockBooking = async (bookingId) => {
  const booking = await ExamBooking.findById(bookingId);
  if (!booking) {
    throw new AppError('预约不存在', 404);
  }

  if (booking.status !== 'confirmed') {
    throw new AppError('只有已确认的预约可以锁定', 400);
  }

  booking.status = 'locked';
  await booking.save();

  return booking;
};

const getBookings = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    studentId,
    coachId,
    examType,
    status,
    startDate,
    endDate,
  } = query;

  const filter = {};
  if (studentId) filter.student = studentId;
  if (coachId) filter.coach = coachId;
  if (examType) filter.examType = examType;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.examDate = {};
    if (startDate) filter.examDate.$gte = new Date(startDate);
    if (endDate) filter.examDate.$lte = new Date(endDate);
  }

  const bookings = await ExamBooking.find(filter)
    .populate('student', 'name phone licenseType')
    .populate('examRoom', 'name address')
    .populate('coach', 'name phone')
    .populate('vehicle', 'plateNumber brand')
    .sort({ examDate: 1, 'timeSlot.startTime': 1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await ExamBooking.countDocuments(filter);

  return {
    bookings,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getBookingById = async (bookingId) => {
  const booking = await ExamBooking.findById(bookingId)
    .populate('student', 'name phone licenseType')
    .populate('examRoom', 'name address')
    .populate('coach', 'name phone')
    .populate('vehicle', 'plateNumber brand');

  if (!booking) {
    throw new AppError('预约不存在', 404);
  }

  return booking;
};

const getAvailableSlots = async (examType, examRoomId, date) => {
  const examRoom = await ExamRoom.findById(examRoomId);
  if (!examRoom) {
    throw new AppError('考场不存在', 404);
  }

  if (examRoom.examType !== examType) {
    throw new AppError('该考场不支持此考试类型', 400);
  }

  const dayOfWeek = new Date(date).getDay();
  if (!examRoom.workDays.includes(dayOfWeek)) {
    return [];
  }

  const slots = [];
  for (const slot of examRoom.timeSlots) {
    const capacity = await getExamRoomCapacity(examRoomId, date, slot);
    slots.push({
      ...slot,
      total: capacity.total,
      used: capacity.used,
      available: capacity.available,
    });
  }

  return slots;
};

module.exports = {
  bookExam,
  cancelBooking,
  lockBooking,
  getBookings,
  getBookingById,
  getAvailableSlots,
  getCoachAvailability,
  getExamRoomCapacity,
  checkStudyHoursQualified,
  getRequiredStudyHours,
  suggestAlternativeSlots,
  findAvailableCoaches,
  findAvailableVehicles,
  getExamTypeName,
};
