const ExamBooking = require('../models/ExamBooking');
const DrivingLicense = require('../models/DrivingLicense');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const Vehicle = require('../models/Vehicle');
const { AppError } = require('../middleware/errorHandler');
const { formatDate, addDays, generateLicenseNumber } = require('../utils/dateUtils');
const { notifyStudent, notifyCoach, notifyOperator } = require('./notification.service');
const { suggestAlternativeSlots } = require('./exam.service');

const getExamTypeName = (type) => {
  const names = {
    subject1: '科目一（理论）',
    subject2: '科目二（场地驾驶）',
    subject3: '科目三（道路驾驶）',
    subject4: '科目四（安全文明）',
  };
  return names[type] || type;
};

const EXAM_PASS_SCORES = {
  subject1: 90,
  subject2: 80,
  subject3: 90,
  subject4: 90,
};

const uploadExamResult = async (bookingId, resultData) => {
  const { score, details } = resultData;

  const booking = await ExamBooking.findById(bookingId)
    .populate('student')
    .populate('coach');

  if (!booking) {
    throw new AppError('考试预约不存在', 404);
  }

  if (booking.status === 'completed') {
    throw new AppError('该考试已有成绩，无法重复上传', 400);
  }

  if (!['confirmed', 'locked', 'no_show', 'late'].includes(booking.status)) {
    throw new AppError('该考试状态不允许上传成绩', 400);
  }

  const passScore = EXAM_PASS_SCORES[booking.examType];
  const passed = score >= passScore;

  booking.result = {
    score,
    passed,
    details,
  };
  booking.status = 'completed';
  await booking.save();

  if (booking.vehicle) {
    const vehicle = await Vehicle.findById(booking.vehicle);
    if (vehicle) {
      const otherBookings = await ExamBooking.countDocuments({
        vehicle: vehicle._id,
        status: { $in: ['pending', 'confirmed', 'locked'] },
        _id: { $ne: bookingId },
      });
      if (otherBookings === 0) {
        vehicle.status = 'available';
        await vehicle.save();
      }
    }
  }

  const schedule = await Schedule.findOne({ sourceBooking: bookingId });
  if (schedule) {
    schedule.status = 'completed';
    await schedule.save();
  }

  const student = booking.student;

  await notifyStudent(
    student._id,
    'exam_result',
    '考试成绩已发布',
    `您的${getExamTypeName(booking.examType)}成绩：${score}分，${passed ? '恭喜通过！' : '未通过。'}`,
    booking._id,
    'ExamBooking'
  );

  if (booking.coach) {
    await notifyCoach(
      booking.coach._id,
      'exam_result',
      '学员考试结果',
      `学员${student.name}的${getExamTypeName(booking.examType)}成绩：${score}分，${passed ? '通过' : '未通过'}。`,
      booking._id,
      'ExamBooking'
    );
  }

  if (passed) {
    await handleExamPassed(student, booking);
  } else {
    await handleExamFailed(student, booking);
  }

  return {
    booking,
    passed,
    score,
    passScore,
  };
};

const handleExamPassed = async (student, booking) => {
  const examOrder = ['subject1', 'subject2', 'subject3', 'subject4'];
  const currentIndex = examOrder.indexOf(booking.examType);

  if (currentIndex === examOrder.length - 1) {
    await generateDrivingLicense(student, booking);
  } else {
    await notifyStudent(
      student._id,
      'system_alert',
      '可以预约下一科目',
      `恭喜通过${getExamTypeName(booking.examType)}！您现在可以预约${getExamTypeName(examOrder[currentIndex + 1])}了。`,
      student._id,
      'Student'
    );
  }

  const allPassed = await checkAllExamsPassed(student._id);
  if (allPassed && currentIndex < examOrder.length - 1) {
    student.status = 'completed';
    await student.save();
  }
};

const handleExamFailed = async (student, booking) => {
  const makeupBooking = await createMakeupExam(booking);

  await notifyStudent(
    student._id,
    'makeup_exam',
    '补考安排已生成',
    `很遗憾您未通过${getExamTypeName(booking.examType)}。系统已为您生成补考安排，请查看详情。`,
    makeupBooking._id,
    'ExamBooking'
  );
};

const createMakeupExam = async (originalBooking) => {
  const student = await Student.findById(originalBooking.student);
  if (!student) {
    throw new AppError('学员不存在', 404);
  }

  const suggestedDate = addDays(originalBooking.examDate, 10);

  const suggestions = await suggestAlternativeSlots(
    originalBooking.examType,
    student.licenseType,
    suggestedDate
  );

  let bookingData = {
    student: originalBooking.student,
    examType: originalBooking.examType,
    examRoom: originalBooking.examRoom,
    coach: originalBooking.coach,
    vehicle: originalBooking.vehicle,
    isMakeup: true,
    originalBooking: originalBooking._id,
    status: 'pending',
  };

  if (suggestions.length > 0) {
    const suggestion = suggestions[0];
    bookingData.examDate = suggestion.date;
    bookingData.timeSlot = suggestion.timeSlot;
    bookingData.examRoom = suggestion.examRoom;
  } else {
    bookingData.examDate = suggestedDate;
    bookingData.timeSlot = originalBooking.timeSlot;
  }

  const makeupBooking = await ExamBooking.create(bookingData);

  return makeupBooking;
};

const generateDrivingLicense = async (student, booking) => {
  const existingLicense = await DrivingLicense.findOne({ student: student._id });
  if (existingLicense) {
    return existingLicense;
  }

  const examRecords = [];
  const examTypes = ['subject1', 'subject2', 'subject3', 'subject4'];

  for (const examType of examTypes) {
    const passedBooking = await ExamBooking.findOne({
      student: student._id,
      examType,
      status: 'completed',
      'result.passed': true,
    }).sort({ examDate: -1 });

    if (passedBooking) {
      examRecords.push({
        examType,
        score: passedBooking.result.score,
        passed: true,
        examDate: passedBooking.examDate,
      });
    }
  }

  const licenseNumber = generateLicenseNumber();
  const issueDate = new Date();
  const expiryDate = addDays(issueDate, 365 * 6);

  const drivingLicense = await DrivingLicense.create({
    student: student._id,
    licenseNumber,
    licenseType: student.licenseType,
    issueDate,
    expiryDate,
    status: 'valid',
    examRecords,
  });

  student.hasDrivingLicense = true;
  student.status = 'completed';
  await student.save();

  await notifyStudent(
    student._id,
    'driving_license',
    '电子驾照已生成',
    `恭喜您！您已通过所有考试，电子驾照已生成。驾照号码：${licenseNumber}，有效期至：${formatDate(expiryDate)}。`,
    drivingLicense._id,
    'DrivingLicense'
  );

  await notifyOperator(
    'system_admin',
    'driving_license',
    '新驾照生成',
    `学员${student.name}已通过所有考试，电子驾照已生成：${licenseNumber}`,
    drivingLicense._id,
    'DrivingLicense'
  );

  return drivingLicense;
};

const checkAllExamsPassed = async (studentId) => {
  const examTypes = ['subject1', 'subject2', 'subject3', 'subject4'];

  for (const examType of examTypes) {
    const passed = await ExamBooking.countDocuments({
      student: studentId,
      examType,
      status: 'completed',
      'result.passed': true,
    });
    if (passed === 0) {
      return false;
    }
  }

  return true;
};

const getDrivingLicenseByStudent = async (studentId) => {
  const license = await DrivingLicense.findOne({ student: studentId })
    .populate('student', 'name idCard licenseType');

  if (!license) {
    throw new AppError('未找到驾照信息', 404);
  }

  return license;
};

const getDrivingLicenseByNumber = async (licenseNumber) => {
  const license = await DrivingLicense.findOne({ licenseNumber })
    .populate('student', 'name idCard licenseType');

  if (!license) {
    throw new AppError('未找到驾照信息', 404);
  }

  return license;
};

const recordNoShow = async (bookingId) => {
  const booking = await ExamBooking.findById(bookingId).populate('student');
  if (!booking) {
    throw new AppError('预约不存在', 404);
  }

  if (booking.status !== 'confirmed' && booking.status !== 'locked') {
    throw new AppError('该预约状态不允许标记为未到', 400);
  }

  booking.status = 'no_show';
  booking.result = {
    score: 0,
    passed: false,
    details: '学员未按时参加考试',
  };
  await booking.save();

  const student = booking.student;
  student.noShowCount = (student.noShowCount || 0) + 1;

  const totalMissed = student.noShowCount + student.lateCount;
  if (totalMissed >= 3) {
    student.bookingRestricted = true;
    student.restrictionEndDate = addDays(new Date(), 30);

    await notifyStudent(
      student._id,
      'booking_restricted',
      '预约权限已被限制',
      '由于您累计迟到或缺席考试达到3次，您的预约权限已被限制30天。',
      student._id,
      'Student'
    );
  }

  await student.save();

  await createMakeupExam(booking);

  return {
    booking,
    noShowCount: student.noShowCount,
    bookingRestricted: student.bookingRestricted,
  };
};

const recordLate = async (bookingId, minutesLate) => {
  const booking = await ExamBooking.findById(bookingId).populate('student');
  if (!booking) {
    throw new AppError('预约不存在', 404);
  }

  if (booking.status !== 'confirmed' && booking.status !== 'locked') {
    throw new AppError('该预约状态不允许标记为迟到', 400);
  }

  booking.status = 'late';
  booking.checkInTime = new Date();
  await booking.save();

  const student = booking.student;
  student.lateCount = (student.lateCount || 0) + 1;

  const totalMissed = student.noShowCount + student.lateCount;
  if (totalMissed >= 3) {
    student.bookingRestricted = true;
    student.restrictionEndDate = addDays(new Date(), 30);

    await notifyStudent(
      student._id,
      'booking_restricted',
      '预约权限已被限制',
      '由于您累计迟到或缺席考试达到3次，您的预约权限已被限制30天。',
      student._id,
      'Student'
    );
  }

  await student.save();

  return {
    booking,
    lateCount: student.lateCount,
    minutesLate,
    bookingRestricted: student.bookingRestricted,
  };
};

const checkBookingRestriction = async (studentId) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('学员不存在', 404);
  }

  if (student.bookingRestricted && student.restrictionEndDate) {
    if (new Date() > student.restrictionEndDate) {
      student.bookingRestricted = false;
      student.restrictionEndDate = null;
      student.noShowCount = 0;
      student.lateCount = 0;
      await student.save();

      await notifyStudent(
        student._id,
        'system_alert',
        '预约权限已恢复',
        '您的预约权限已恢复，请按时参加考试。',
        student._id,
        'Student'
      );

      return {
        restricted: false,
        message: '预约权限已恢复',
      };
    }
  }

  return {
    restricted: student.bookingRestricted,
    restrictionEndDate: student.restrictionEndDate,
    noShowCount: student.noShowCount,
    lateCount: student.lateCount,
  };
};

const getExamResults = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    studentId,
    examType,
    passed,
    startDate,
    endDate,
  } = query;

  const filter = {
    status: 'completed',
  };
  if (studentId) filter.student = studentId;
  if (examType) filter.examType = examType;
  if (passed !== undefined) filter['result.passed'] = passed === 'true' || passed === true;
  if (startDate || endDate) {
    filter.examDate = {};
    if (startDate) filter.examDate.$gte = new Date(startDate);
    if (endDate) filter.examDate.$lte = new Date(endDate);
  }

  const results = await ExamBooking.find(filter)
    .populate('student', 'name phone licenseType')
    .populate('examRoom', 'name')
    .populate('coach', 'name')
    .sort({ examDate: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await ExamBooking.countDocuments(filter);

  const stats = await ExamBooking.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$examType',
        total: { $sum: 1 },
        passed: {
          $sum: { $cond: ['$result.passed', 1, 0] },
        },
        failed: {
          $sum: { $cond: ['$result.passed', 0, 1] },
        },
        avgScore: { $avg: '$result.score' },
      },
    },
  ]);

  return {
    results,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats,
  };
};

module.exports = {
  uploadExamResult,
  createMakeupExam,
  generateDrivingLicense,
  getDrivingLicenseByStudent,
  getDrivingLicenseByNumber,
  checkAllExamsPassed,
  recordNoShow,
  recordLate,
  checkBookingRestriction,
  getExamResults,
  getExamTypeName,
  EXAM_PASS_SCORES,
};
