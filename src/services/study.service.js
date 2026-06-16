const StudyRecord = require('../models/StudyRecord');
const Student = require('../models/Student');
const ExamBooking = require('../models/ExamBooking');
const { AppError } = require('../middleware/errorHandler');
const { formatDate, parseTimeToMinutes } = require('../utils/dateUtils');
const { notifyStudent, notifyCoach } = require('./notification.service');
const { getRequiredStudyHours } = require('./exam.service');

const addStudyHours = async (recordData) => {
  const {
    studentId,
    coachId,
    vehicleId,
    scheduleId,
    studyType,
    duration,
    date,
    startTime,
    endTime,
    content,
    recordedBy,
  } = recordData;

  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('学员不存在', 404);
  }

  if (student.status !== 'approved' && student.status !== 'learning') {
    throw new AppError('学员状态不允许记录学时', 400);
  }

  let actualDuration = duration;
  if (startTime && endTime && !duration) {
    actualDuration = (parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime)) / 60;
  }

  if (actualDuration <= 0) {
    throw new AppError('学时时长必须大于0', 400);
  }

  if (student.status === 'approved') {
    student.status = 'learning';
  }

  if (studyType === 'theory') {
    student.studyHours.theory += actualDuration;
  } else if (studyType === 'practical') {
    student.studyHours.practical += actualDuration;
  }

  await student.save();

  const record = await StudyRecord.create({
    student: studentId,
    coach: coachId,
    vehicle: vehicleId,
    schedule: scheduleId,
    studyType,
    duration: actualDuration,
    date,
    startTime,
    endTime,
    content,
    recordedBy: recordedBy || coachId,
    status: 'confirmed',
  });

  checkAndNotifyExamQualification(student);

  return {
    record,
    totalTheory: student.studyHours.theory,
    totalPractical: student.studyHours.practical,
  };
};

const checkAndNotifyExamQualification = async (student) => {
  const { studyHours } = student;

  const examTypes = ['subject1', 'subject2', 'subject3', 'subject4'];

  for (const examType of examTypes) {
    const required = getRequiredStudyHours(examType);
    const previousType = examTypes[examTypes.indexOf(examType) - 1];

    const theoryQualified = studyHours.theory >= required.theory;
    const practicalQualified = studyHours.practical >= required.practical;

    if (theoryQualified && practicalQualified) {
      const existingBooking = await ExamBooking.findOne({
        student: student._id,
        examType,
        status: { $in: ['pending', 'confirmed', 'locked', 'completed'] },
      });

      if (!existingBooking) {
        const passedPrevious = !previousType || (await hasPassedExam(student._id, previousType));

        if (passedPrevious) {
          await notifyStudent(
            student._id,
            'system_alert',
            '学时已达标',
            `您的学时已达到${getExamTypeName(examType)}要求，可以预约考试了。`,
            student._id,
            'Student'
          );
        }
      }
    }
  }
};

const hasPassedExam = async (studentId, examType) => {
  const booking = await ExamBooking.findOne({
    student: studentId,
    examType,
    status: 'completed',
    'result.passed': true,
  });
  return !!booking;
};

const getExamTypeName = (type) => {
  const names = {
    subject1: '科目一',
    subject2: '科目二',
    subject3: '科目三',
    subject4: '科目四',
  };
  return names[type] || type;
};

const checkExamQualification = async (studentId, examType) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('学员不存在', 404);
  }

  const required = getRequiredStudyHours(examType);
  const { studyHours } = student;

  const theoryGap = Math.max(0, required.theory - studyHours.theory);
  const practicalGap = Math.max(0, required.practical - studyHours.practical);

  const qualified = theoryGap === 0 && practicalGap === 0;

  return {
    qualified,
    examType,
    examTypeName: getExamTypeName(examType),
    current: {
      theory: studyHours.theory,
      practical: studyHours.practical,
    },
    required,
    gap: {
      theory: theoryGap,
      practical: practicalGap,
    },
  };
};

const getStudyRecords = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    studentId,
    coachId,
    studyType,
    startDate,
    endDate,
  } = query;

  const filter = {};
  if (studentId) filter.student = studentId;
  if (coachId) filter.coach = coachId;
  if (studyType) filter.studyType = studyType;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  const records = await StudyRecord.find(filter)
    .populate('student', 'name')
    .populate('coach', 'name')
    .populate('vehicle', 'plateNumber')
    .sort({ date: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await StudyRecord.countDocuments(filter);

  const totals = await StudyRecord.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$studyType',
        total: { $sum: '$duration' },
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = {
    theory: 0,
    practical: 0,
    total: 0,
  };

  totals.forEach((t) => {
    summary[t._id] = t.total;
    summary.total += t.total;
  });

  return {
    records,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    summary,
  };
};

const getStudentStudySummary = async (studentId) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('学员不存在', 404);
  }

  const qualifications = {};
  const examTypes = ['subject1', 'subject2', 'subject3', 'subject4'];

  for (const examType of examTypes) {
    qualifications[examType] = await checkExamQualification(studentId, examType);
  }

  return {
    student: {
      id: student._id,
      name: student.name,
      licenseType: student.licenseType,
      status: student.status,
    },
    studyHours: student.studyHours,
    qualifications,
  };
};

const lockExamIfInsufficientHours = async (studentId, examType) => {
  const qualification = await checkExamQualification(studentId, examType);

  if (!qualification.qualified) {
    const bookings = await ExamBooking.find({
      student: studentId,
      examType,
      status: { $in: ['pending', 'confirmed'] },
    });

    for (const booking of bookings) {
      booking.status = 'locked';
      await booking.save();

      await notifyStudent(
        studentId,
        'exam_cancelled',
        '考试资格已锁定',
        `您的${getExamTypeName(examType)}考试资格已被锁定，原因：学时不达标。请完成学时后再解锁。`,
        booking._id,
        'ExamBooking'
      );
    }

    return {
      locked: true,
      bookingsAffected: bookings.length,
      reason: '学时不达标',
    };
  }

  return { locked: false, bookingsAffected: 0 };
};

const unlockExamAfterSufficientHours = async (studentId, examType) => {
  const qualification = await checkExamQualification(studentId, examType);

  if (qualification.qualified) {
    const bookings = await ExamBooking.find({
      student: studentId,
      examType,
      status: 'locked',
    });

    for (const booking of bookings) {
      booking.status = 'confirmed';
      await booking.save();

      await notifyStudent(
        studentId,
        'exam_booked',
        '考试资格已恢复',
        `您的${getExamTypeName(examType)}考试资格已恢复，学时已达标。`,
        booking._id,
        'ExamBooking'
      );
    }

    return {
      unlocked: true,
      bookingsAffected: bookings.length,
    };
  }

  return { unlocked: false, bookingsAffected: 0 };
};

module.exports = {
  addStudyHours,
  checkExamQualification,
  getStudyRecords,
  getStudentStudySummary,
  lockExamIfInsufficientHours,
  unlockExamAfterSufficientHours,
  getExamTypeName,
};
