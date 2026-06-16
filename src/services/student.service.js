const Student = require('../models/Student');
const Coach = require('../models/Coach');
const { AppError } = require('../middleware/errorHandler');
const { isDateExpired, isValidIdCard } = require('../utils/dateUtils');
const { notifyStudent, notifyCoach, notifyOperator } = require('./notification.service');

const enrollStudent = async (studentData) => {
  const {
    name,
    idCard,
    idCardExpiryDate,
    phone,
    address,
    licenseType,
    healthReportUrl,
  } = studentData;

  if (!isValidIdCard(idCard)) {
    throw new AppError('身份证号码格式不正确', 400);
  }

  const existing = await Student.findOne({ idCard });
  if (existing) {
    throw new AppError('该身份证已注册学员', 400);
  }

  if (isDateExpired(idCardExpiryDate)) {
    const student = await Student.create({
      name,
      idCard,
      idCardExpiryDate,
      phone,
      address,
      licenseType,
      status: 'rejected',
      rejectReason: '身份证已过期，请更新有效身份证件',
      healthReport: {
        status: 'rejected',
        remark: '身份证过期导致报名失败',
      },
    });

    await notifyStudent(
      student._id,
      'enrollment_rejected',
      '报名未通过',
      '您的报名未通过，原因：身份证已过期，请更新有效身份证件后重新报名。',
      student._id,
      'Student'
    );

    return {
      success: false,
      student,
      reason: '身份证已过期，请更新有效身份证件',
    };
  }

  const healthReport = healthReportUrl
    ? {
        status: 'pending',
        reportUrl: healthReportUrl,
        uploadDate: new Date(),
      }
    : { status: 'pending' };

  const student = await Student.create({
    name,
    idCard,
    idCardExpiryDate,
    phone,
    address,
    licenseType,
    healthReport,
    status: 'pending_review',
  });

  await notifyOperator(
    'system_admin',
    'enrollment_approved',
    '新学员报名待审核',
    `新学员 ${name} 提交了报名申请，请及时审核。`,
    student._id,
    'Student'
  );

  return {
    success: true,
    student,
    message: '报名提交成功，等待审核',
  };
};

const verifyHealthReport = async (studentId, result) => {
  const { passed, remark } = result;

  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('学员不存在', 404);
  }

  if (student.status !== 'pending_review') {
    if (student.status === 'approved') {
      return {
        success: true,
        student,
        message: '该学员已审核通过',
      };
    }
    throw new AppError('该学员状态不允许审核', 400);
  }

  if (!passed) {
    student.healthReport.status = 'rejected';
    student.healthReport.remark = remark || '体检报告不合格';
    student.healthReport.checkDate = new Date();
    student.status = 'rejected';
    student.rejectReason = `体检报告不合格：${remark || '不符合报考条件'}`;
    await student.save();

    try {
      await notifyStudent(
        student._id,
        'enrollment_rejected',
        '报名未通过',
        `您的报名未通过，原因：${student.rejectReason}`,
        student._id,
        'Student'
      );
    } catch (notifyErr) {
      console.error('发送学员驳回通知失败:', notifyErr.message);
    }

    return {
      success: false,
      student,
      reason: student.rejectReason,
    };
  }

  if (isDateExpired(student.idCardExpiryDate)) {
    student.status = 'rejected';
    student.rejectReason = '身份证已过期，请更新有效身份证件';
    student.healthReport.status = 'approved';
    student.healthReport.checkDate = new Date();
    await student.save();

    try {
      await notifyStudent(
        student._id,
        'enrollment_rejected',
        '报名未通过',
        '您的报名未通过，原因：身份证已过期，请更新有效身份证件后重新报名。',
        student._id,
        'Student'
      );
    } catch (notifyErr) {
      console.error('发送学员身份证驳回通知失败:', notifyErr.message);
    }

    return {
      success: false,
      student,
      reason: '身份证已过期，请更新有效身份证件',
    };
  }

  let assignedCoach = null;

  if (student.assignedCoach) {
    assignedCoach = await Coach.findById(student.assignedCoach);
    if (assignedCoach && assignedCoach.status !== 'active') {
      assignedCoach = null;
    }
  }

  if (!assignedCoach) {
    const Student2 = require('../models/Student');
    const coachesWithCounts = await Coach.aggregate([
      {
        $match: {
          status: 'active',
          licenseTypes: student.licenseType,
        },
      },
      {
        $lookup: {
          from: Student2.collection.name,
          localField: '_id',
          foreignField: 'assignedCoach',
          as: 'students',
        },
      },
      {
        $addFields: {
          studentCount: { $size: '$students' },
        },
      },
      {
        $sort: {
          studentCount: 1,
          createdAt: 1,
        },
      },
      {
        $limit: 1,
      },
    ]);

    if (coachesWithCounts.length > 0) {
      assignedCoach = coachesWithCounts[0];
    }
  }

  if (!assignedCoach) {
    assignedCoach = await Coach.findOne({
      status: 'active',
    }).sort({ createdAt: 1 });
  }

  student.healthReport.status = 'approved';
  student.healthReport.checkDate = new Date();
  student.status = 'approved';
  student.assignedCoach = assignedCoach ? assignedCoach._id : null;

  await student.save();

  const populatedStudent = await Student.findById(student._id)
    .populate('assignedCoach', 'name phone');

  try {
    await notifyStudent(
      student._id,
      'enrollment_approved',
      '报名审核通过',
      assignedCoach
        ? `恭喜！您的报名已通过审核，分配教练：${assignedCoach.name}，可以开始学习了。`
        : '恭喜！您的报名已通过审核，稍后将为您分配教练。',
      student._id,
      'Student'
    );
  } catch (notifyErr) {
    console.error('发送学员审核通过通知失败:', notifyErr.message);
  }

  if (assignedCoach) {
    try {
      await notifyCoach(
        assignedCoach._id,
        'enrollment_approved',
        '新学员分配',
        `新学员 ${student.name}（${student.licenseType}）已分配给您，请做好教学准备。`,
        student._id,
        'Student'
      );
    } catch (notifyErr) {
      console.error('发送教练分配通知失败:', notifyErr.message);
    }
  }

  return {
    success: true,
    student: populatedStudent,
    assignedCoach: assignedCoach
      ? {
          _id: assignedCoach._id,
          name: assignedCoach.name,
          phone: assignedCoach.phone,
        }
      : null,
    message: assignedCoach ? '审核通过，已分配教练' : '审核通过，暂无可用教练，将稍后分配',
  };
};

const getStudentById = async (studentId) => {
  const student = await Student.findById(studentId)
    .populate('assignedCoach', 'name phone')
    .select('-__v');
  if (!student) {
    throw new AppError('学员不存在', 404);
  }
  return student;
};

const getStudents = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    licenseType,
    keyword,
  } = query;

  const filter = {};
  if (status) filter.status = status;
  if (licenseType) filter.licenseType = licenseType;
  if (keyword) {
    filter.$or = [
      { name: { $regex: keyword, $options: 'i' } },
      { idCard: { $regex: keyword, $options: 'i' } },
      { phone: { $regex: keyword, $options: 'i' } },
    ];
  }

  const students = await Student.find(filter)
    .populate('assignedCoach', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select('-__v');

  const total = await Student.countDocuments(filter);

  return {
    students,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const updateStudent = async (studentId, updateData) => {
  const student = await Student.findByIdAndUpdate(
    studentId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!student) {
    throw new AppError('学员不存在', 404);
  }

  return student;
};

const validateEnrollment = async (studentId) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError('学员不存在', 404);
  }

  const issues = [];

  if (student.status !== 'approved' && student.status !== 'learning') {
    issues.push(`学员状态为${student.status}，不允许操作`);
  }

  if (isDateExpired(student.idCardExpiryDate)) {
    issues.push('身份证已过期');
  }

  if (student.healthReport.status !== 'approved') {
    issues.push('体检报告未通过审核');
  }

  if (student.bookingRestricted) {
    issues.push('预约权限已被限制');
  }

  return {
    valid: issues.length === 0,
    issues,
    student,
  };
};

const checkIdCardExpiry = async () => {
  const now = new Date();
  const warningDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiringStudents = await Student.find({
    status: { $in: ['approved', 'learning', 'examining'] },
    idCardExpiryDate: { $lte: warningDate, $gte: now },
  });

  for (const student of expiringStudents) {
    await notifyStudent(
      student._id,
      'system_alert',
      '身份证即将过期提醒',
      '您的身份证即将过期，请及时更新，以免影响您的学习和考试。',
      student._id,
      'Student'
    );
  }

  return expiringStudents.length;
};

module.exports = {
  enrollStudent,
  verifyHealthReport,
  getStudentById,
  getStudents,
  updateStudent,
  validateEnrollment,
  checkIdCardExpiry,
};
