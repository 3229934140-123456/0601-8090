const Schedule = require('../models/Schedule');
const Coach = require('../models/Coach');
const Student = require('../models/Student');
const Vehicle = require('../models/Vehicle');
const ShiftChangeRequest = require('../models/ShiftChangeRequest');
const { AppError } = require('../middleware/errorHandler');
const { formatDate, timeOverlap, getDatesBetween } = require('../utils/dateUtils');
const { notifyCoach, notifyStudent, notifyAdmin } = require('./notification.service');
const { addStudyHours } = require('./study.service');

const createSchedule = async (scheduleData) => {
  const {
    coachId,
    studentId,
    vehicleId,
    date,
    startTime,
    endTime,
    type,
    location,
    remark,
  } = scheduleData;

  const coach = await Coach.findById(coachId);
  if (!coach || coach.status !== 'active') {
    throw new AppError('教练不存在或不可用', 400);
  }

  if (studentId) {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new AppError('学员不存在', 404);
    }
  }

  if (vehicleId) {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || vehicle.status === 'disabled') {
      throw new AppError('车辆不存在或不可用', 400);
    }
  }

  const conflict = await checkScheduleConflict(coachId, date, startTime, endTime);
  if (conflict) {
    throw new AppError(
      `排班冲突：${formatDate(date)} ${startTime}-${endTime} 已有${conflict.type === 'exam' ? '考试' : '排班'}安排`,
      400
    );
  }

  const schedule = await Schedule.create({
    coach: coachId,
    student: studentId || null,
    vehicle: vehicleId || null,
    date,
    startTime,
    endTime,
    type,
    location,
    remark,
    status: 'scheduled',
  });

  await notifyCoach(
    coachId,
    'schedule_created',
    '新排班安排',
    `您有新的排班安排：${formatDate(date)} ${startTime}-${endTime}，类型：${getScheduleTypeName(type)}`,
    schedule._id,
    'Schedule'
  );

  if (studentId) {
    await notifyStudent(
      studentId,
      'schedule_created',
      '学习安排已确认',
      `您的学习安排已确认：${formatDate(date)} ${startTime}-${endTime}，教练：${coach.name}`,
      schedule._id,
      'Schedule'
    );
  }

  return schedule;
};

const getScheduleTypeName = (type) => {
  const names = {
    theory: '理论学习',
    practical: '实操训练',
    exam: '考试',
    rest: '休息',
    other: '其他',
  };
  return names[type] || type;
};

const checkScheduleConflict = async (coachId, date, startTime, endTime, excludeId = null) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const filter = {
    coach: coachId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['scheduled', 'in_progress'] },
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const schedules = await Schedule.find(filter);

  for (const schedule of schedules) {
    if (timeOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) {
      return {
        conflict: true,
        type: schedule.type,
        schedule,
      };
    }
  }

  const ExamBooking = require('../models/ExamBooking');
  const examBookings = await ExamBooking.find({
    coach: coachId,
    examDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed', 'locked'] },
  });

  for (const booking of examBookings) {
    if (timeOverlap(startTime, endTime, booking.timeSlot.startTime, booking.timeSlot.endTime)) {
      return {
        conflict: true,
        type: 'exam',
        booking,
      };
    }
  }

  return null;
};

const getSchedules = async (query = {}) => {
  const {
    page = 1,
    limit = 20,
    coachId,
    studentId,
    vehicleId,
    startDate,
    endDate,
    type,
    status,
  } = query;

  const filter = {};
  if (coachId) filter.coach = coachId;
  if (studentId) filter.student = studentId;
  if (vehicleId) filter.vehicle = vehicleId;
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  const schedules = await Schedule.find(filter)
    .populate('coach', 'name phone')
    .populate('student', 'name phone licenseType')
    .populate('vehicle', 'plateNumber brand')
    .sort({ date: 1, startTime: 1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Schedule.countDocuments(filter);

  return {
    schedules,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getScheduleById = async (scheduleId) => {
  const schedule = await Schedule.findById(scheduleId)
    .populate('coach', 'name phone')
    .populate('student', 'name phone licenseType')
    .populate('vehicle', 'plateNumber brand');

  if (!schedule) {
    throw new AppError('排班不存在', 404);
  }

  return schedule;
};

const updateSchedule = async (scheduleId, updateData) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new AppError('排班不存在', 404);
  }

  if (schedule.status === 'completed') {
    throw new AppError('已完成的排班不能修改', 400);
  }

  const { date, startTime, endTime } = updateData;
  if (date || startTime || endTime) {
    const conflict = await checkScheduleConflict(
      schedule.coach,
      date || schedule.date,
      startTime || schedule.startTime,
      endTime || schedule.endTime,
      scheduleId
    );
    if (conflict) {
      throw new AppError('修改后存在排班冲突', 400);
    }
  }

  Object.assign(schedule, updateData);
  schedule.status = 'changed';
  await schedule.save();

  await notifyCoach(
    schedule.coach,
    'schedule_changed',
    '排班有变更',
    `您的排班已变更：${formatDate(schedule.date)} ${schedule.startTime}-${schedule.endTime}`,
    schedule._id,
    'Schedule'
  );

  if (schedule.student) {
    await notifyStudent(
      schedule.student,
      'schedule_changed',
      '学习安排有变更',
      `您的学习安排已变更：${formatDate(schedule.date)} ${schedule.startTime}-${schedule.endTime}`,
      schedule._id,
      'Schedule'
    );
  }

  return schedule;
};

const completeSchedule = async (scheduleId, studyData = {}) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new AppError('排班不存在', 404);
  }

  if (schedule.status !== 'scheduled' && schedule.status !== 'in_progress') {
    throw new AppError('该排班状态不允许完成', 400);
  }

  schedule.status = 'completed';
  await schedule.save();

  if (schedule.student && (schedule.type === 'theory' || schedule.type === 'practical')) {
    const duration = studyData.duration || calculateDuration(schedule.startTime, schedule.endTime);

    await addStudyHours({
      studentId: schedule.student,
      coachId: schedule.coach,
      vehicleId: schedule.vehicle,
      scheduleId: schedule._id,
      studyType: schedule.type,
      duration,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      content: studyData.content,
    });
  }

  return schedule;
};

const calculateDuration = (startTime, endTime) => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
};

const cancelSchedule = async (scheduleId, reason = '') => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new AppError('排班不存在', 404);
  }

  if (schedule.status === 'completed') {
    throw new AppError('已完成的排班不能取消', 400);
  }

  schedule.status = 'cancelled';
  schedule.remark = reason ? `${schedule.remark || ''} 取消原因：${reason}`.trim() : schedule.remark;
  await schedule.save();

  await notifyCoach(
    schedule.coach,
    'schedule_changed',
    '排班已取消',
    `排班已取消：${formatDate(schedule.date)} ${schedule.startTime}-${schedule.endTime}${reason ? `，原因：${reason}` : ''}`,
    schedule._id,
    'Schedule'
  );

  if (schedule.student) {
    await notifyStudent(
      schedule.student,
      'schedule_changed',
      '学习安排已取消',
      `学习安排已取消：${formatDate(schedule.date)} ${schedule.startTime}-${schedule.endTime}${reason ? `，原因：${reason}` : ''}`,
      schedule._id,
      'Schedule'
    );
  }

  return schedule;
};

const requestShiftChange = async (requestData) => {
  const {
    scheduleId,
    coachId,
    requestedDate,
    requestedStartTime,
    requestedEndTime,
    reason,
  } = requestData;

  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new AppError('排班不存在', 404);
  }

  if (schedule.coach.toString() !== coachId) {
    throw new AppError('只能申请自己的排班调班', 403);
  }

  if (schedule.status !== 'scheduled') {
    throw new AppError('只能申请已排班状态的调班', 400);
  }

  const existingRequest = await ShiftChangeRequest.findOne({
    schedule: scheduleId,
    status: 'pending',
  });

  if (existingRequest) {
    throw new AppError('该排班已有待审批的调班申请', 400);
  }

  const request = await ShiftChangeRequest.create({
    schedule: scheduleId,
    coach: coachId,
    originalSchedule: {
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    },
    requestedSchedule: {
      date: requestedDate,
      startTime: requestedStartTime,
      endTime: requestedEndTime,
    },
    reason,
    status: 'pending',
  });

  await notifyAdmin(
    'system_admin',
    'shift_request',
    '新调班申请',
    `教练申请调班，请及时审批。原排班：${formatDate(schedule.date)} ${schedule.startTime}-${schedule.endTime}`,
    request._id,
    'ShiftChangeRequest'
  );

  return request;
};

const approveShiftChange = async (requestId, approverId, replacementCoachId = null) => {
  const request = await ShiftChangeRequest.findById(requestId);
  if (!request) {
    throw new AppError('调班申请不存在', 404);
  }

  if (request.status !== 'pending') {
    throw new AppError('该申请已被处理', 400);
  }

  const schedule = await Schedule.findById(request.schedule);
  if (!schedule) {
    throw new AppError('关联排班不存在', 404);
  }

  const newCoachId = replacementCoachId || schedule.coach;
  const newDate = request.requestedSchedule.date;
  const newStartTime = request.requestedSchedule.startTime;
  const newEndTime = request.requestedSchedule.endTime;

  const coachConflict = await checkScheduleConflict(
    newCoachId,
    newDate,
    newStartTime,
    newEndTime,
    schedule._id
  );

  let conflictReason = null;

  if (coachConflict) {
    if (coachConflict.type === 'exam') {
      const conflictBooking = coachConflict.booking;
      conflictReason = `新时间与该教练的考试安排冲突：${formatDate(newDate)} ${conflictBooking.timeSlot.startTime}-${conflictBooking.timeSlot.endTime}（考试）`;
    } else {
      const conflictSchedule = coachConflict.schedule;
      conflictReason = `新时间与该教练的排班冲突：${formatDate(newDate)} ${conflictSchedule.startTime}-${conflictSchedule.endTime}（${getScheduleTypeName(conflictSchedule.type)}）`;
    }

    throw new AppError(`审批驳回：${conflictReason}`, 400);
  }

  if (schedule.vehicle) {
    const ExamBooking2 = require('../models/ExamBooking');
    const startOfDay = new Date(newDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(newDate);
    endOfDay.setHours(23, 59, 59, 999);

    const vehicleBookings = await ExamBooking2.find({
      vehicle: schedule.vehicle,
      examDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed', 'locked'] },
    });

    for (const vb of vehicleBookings) {
      if (timeOverlap(newStartTime, newEndTime, vb.timeSlot.startTime, vb.timeSlot.endTime)) {
        conflictReason = `新时间与车辆考试安排冲突：${formatDate(newDate)} ${vb.timeSlot.startTime}-${vb.timeSlot.endTime}（考试）`;
        throw new AppError(`审批驳回：${conflictReason}`, 400);
      }
    }

    const vehicleSchedules = await Schedule.find({
      vehicle: schedule.vehicle,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['scheduled', 'in_progress', 'changed'] },
      _id: { $ne: schedule._id },
    });

    for (const vs of vehicleSchedules) {
      if (timeOverlap(newStartTime, newEndTime, vs.startTime, vs.endTime)) {
        conflictReason = `新时间与车辆排班冲突：${formatDate(newDate)} ${vs.startTime}-${vs.endTime}（${getScheduleTypeName(vs.type)}）`;
        throw new AppError(`审批驳回：${conflictReason}`, 400);
      }
    }
  }

  if (schedule.student) {
    const ExamBooking3 = require('../models/ExamBooking');
    const startOfDay = new Date(newDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(newDate);
    endOfDay.setHours(23, 59, 59, 999);

    const studentBookings = await ExamBooking3.find({
      student: schedule.student,
      examDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed', 'locked'] },
    });

    for (const sb of studentBookings) {
      if (timeOverlap(newStartTime, newEndTime, sb.timeSlot.startTime, sb.timeSlot.endTime)) {
        conflictReason = `新时间与学员考试安排冲突：${formatDate(newDate)} ${sb.timeSlot.startTime}-${sb.timeSlot.endTime}（考试）`;
        throw new AppError(`审批驳回：${conflictReason}`, 400);
      }
    }

    const studentSchedules = await Schedule.find({
      student: schedule.student,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['scheduled', 'in_progress', 'changed'] },
      _id: { $ne: schedule._id },
    });

    for (const ss of studentSchedules) {
      if (timeOverlap(newStartTime, newEndTime, ss.startTime, ss.endTime)) {
        conflictReason = `新时间与学员其他排班冲突：${formatDate(newDate)} ${ss.startTime}-${ss.endTime}（${getScheduleTypeName(ss.type)}）`;
        throw new AppError(`审批驳回：${conflictReason}`, 400);
      }
    }
  }

  schedule.date = newDate;
  schedule.startTime = newStartTime;
  schedule.endTime = newEndTime;
  schedule.coach = newCoachId;
  schedule.status = 'changed';
  await schedule.save();

  request.status = 'approved';
  request.approvedBy = approverId;
  request.approvalDate = new Date();
  request.replacementCoach = replacementCoachId || null;
  await request.save();

  try {
    await notifyCoach(
      request.coach,
      'shift_approved',
      '调班申请已通过',
      `您的调班申请已通过。新排班：${formatDate(newDate)} ${newStartTime}-${newEndTime}${replacementCoachId ? '，教练已更换' : ''}`,
      request._id,
      'ShiftChangeRequest'
    );
  } catch (err) {
    console.error('发送调班通过通知失败:', err.message);
  }

  if (replacementCoachId) {
    try {
      await notifyCoach(
        replacementCoachId,
        'schedule_created',
        '您有新的排班安排',
        `您有新的排班安排：${formatDate(newDate)} ${newStartTime}-${newEndTime}（${getScheduleTypeName(schedule.type)}）`,
        schedule._id,
        'Schedule'
      );
    } catch (err) {
      console.error('发送新教练通知失败:', err.message);
    }
  }

  if (schedule.student) {
    try {
      await notifyStudent(
        schedule.student,
        'schedule_changed',
        '学习安排有变更',
        `您的学习安排已变更为：${formatDate(newDate)} ${newStartTime}-${newEndTime}${replacementCoachId ? '，教练已更换' : ''}`,
        schedule._id,
        'Schedule'
      );
    } catch (err) {
      console.error('发送学员变更通知失败:', err.message);
    }
  }

  return { request, schedule };
};

const rejectShiftChange = async (requestId, approverId, rejectReason) => {
  const request = await ShiftChangeRequest.findById(requestId);
  if (!request) {
    throw new AppError('调班申请不存在', 404);
  }

  if (request.status !== 'pending') {
    throw new AppError('该申请已被处理', 400);
  }

  request.status = 'rejected';
  request.approvedBy = approverId;
  request.approvalDate = new Date();
  request.rejectReason = rejectReason;
  await request.save();

  await notifyCoach(
    request.coach,
    'shift_rejected',
    '调班申请被驳回',
    `您的调班申请被驳回。原因：${rejectReason}`,
    request._id,
    'ShiftChangeRequest'
  );

  return request;
};

const getShiftChangeRequests = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    coachId,
    status,
  } = query;

  const filter = {};
  if (coachId) filter.coach = coachId;
  if (status) filter.status = status;

  const requests = await ShiftChangeRequest.find(filter)
    .populate('coach', 'name phone')
    .populate('schedule')
    .populate('approvedBy', 'name')
    .populate('replacementCoach', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await ShiftChangeRequest.countDocuments(filter);

  return {
    requests,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const generateSchedulesFromBookings = async (startDate, endDate) => {
  const ExamBooking = require('../models/ExamBooking');

  const bookings = await ExamBooking.find({
    examDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
    status: { $in: ['pending', 'confirmed', 'locked'] },
  });

  const createdSchedules = [];

  for (const booking of bookings) {
    const existingSchedule = await Schedule.findOne({
      sourceBooking: booking._id,
      status: { $ne: 'cancelled' },
    });

    if (!existingSchedule) {
      const schedule = await Schedule.create({
        coach: booking.coach,
        student: booking.student,
        vehicle: booking.vehicle,
        date: booking.examDate,
        startTime: booking.timeSlot.startTime,
        endTime: booking.timeSlot.endTime,
        type: 'exam',
        status: 'scheduled',
        sourceBooking: booking._id,
      });
      createdSchedules.push(schedule);
    }
  }

  return createdSchedules;
};

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  completeSchedule,
  cancelSchedule,
  requestShiftChange,
  approveShiftChange,
  rejectShiftChange,
  getShiftChangeRequests,
  checkScheduleConflict,
  generateSchedulesFromBookings,
  getScheduleTypeName,
};
