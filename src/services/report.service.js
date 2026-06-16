const Student = require('../models/Student');
const ExamBooking = require('../models/ExamBooking');
const Vehicle = require('../models/Vehicle');
const Schedule = require('../models/Schedule');
const ExamRoom = require('../models/ExamRoom');
const DrivingLicense = require('../models/DrivingLicense');
const ExcelJS = require('exceljs');
const { formatDate, getDatesBetween } = require('../utils/dateUtils');

const generateDailyReport = async (date = new Date(), examRoomId = null) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const examRoomFilter = examRoomId ? { examRoom: examRoomId } : {};

  const examRoom = examRoomId ? await ExamRoom.findById(examRoomId) : null;
  const examRoomName = examRoom ? examRoom.name : '全部场地';

  const enrollmentCount = await Student.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const approvedCount = await Student.countDocuments({
    status: 'approved',
    updatedAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const rejectedCount = await Student.countDocuments({
    status: 'rejected',
    updatedAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const examQuery = {
    examDate: { $gte: startOfDay, $lte: endOfDay },
    ...examRoomFilter,
  };

  const examBookings = await ExamBooking.countDocuments(examQuery);

  const completedExamQuery = {
    ...examQuery,
    status: 'completed',
  };

  const completedExams = await ExamBooking.find(completedExamQuery);

  const passedExams = completedExams.filter((e) => e.result && e.result.passed).length;
  const failedExams = completedExams.filter((e) => e.result && !e.result.passed).length;
  const passRate = completedExams.length > 0 ? (passedExams / completedExams.length * 100).toFixed(2) : 0;

  const vehicleIdsFromBookings = [];
  if (examRoomId) {
    const relatedBookings = await ExamBooking.find(examQuery);
    relatedBookings.forEach((b) => {
      if (b.vehicle) vehicleIdsFromBookings.push(b.vehicle.toString());
    });
  }

  const vehicleFilter = examRoomId
    ? { _id: { $in: [...new Set(vehicleIdsFromBookings)] } }
    : { status: { $ne: 'disabled' } };

  const totalVehicles = examRoomId
    ? vehicleIdsFromBookings.length > 0 ? await Vehicle.countDocuments(vehicleFilter) : 0
    : await Vehicle.countDocuments({ status: { $ne: 'disabled' } });

  let inUseVehicles = 0;
  let maintenanceVehicles = 0;

  if (totalVehicles > 0) {
    if (examRoomId) {
      const inUseBookingIds = await ExamBooking.find({
        ...examQuery,
        status: { $in: ['pending', 'confirmed', 'locked'] },
      }).distinct('vehicle');
      inUseVehicles = inUseBookingIds.filter((v) => v).length;

      const vehiclesInList = await Vehicle.find(vehicleFilter);
      maintenanceVehicles = vehiclesInList.filter((v) =>
        ['maintenance', 'repairing'].includes(v.status)
      ).length;
    } else {
      inUseVehicles = await Vehicle.countDocuments({ status: 'in_use' });
      maintenanceVehicles = await Vehicle.countDocuments({
        status: { $in: ['maintenance', 'repairing'] },
      });
    }
  }

  const vehicleUtilization = totalVehicles > 0 ? (inUseVehicles / totalVehicles * 100).toFixed(2) : 0;

  const scheduleFilter = examRoomId
    ? {
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: 'cancelled' },
      }
    : {
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: 'cancelled' },
      };

  const scheduleCount = await Schedule.countDocuments(scheduleFilter);

  const completedScheduleFilter = examRoomId
    ? { ...scheduleFilter, status: 'completed' }
    : { ...scheduleFilter, status: 'completed' };

  const completedSchedules = await Schedule.countDocuments(completedScheduleFilter);

  const noShowQuery = {
    ...examQuery,
    status: 'no_show',
  };
  const noShowCount = await ExamBooking.countDocuments(noShowQuery);

  const lateQuery = {
    ...examQuery,
    status: 'late',
  };
  const lateCount = await ExamBooking.countDocuments(lateQuery);

  const examRooms = examRoomId
    ? [examRoom]
    : await ExamRoom.find({ status: 'active' });

  const examRoomStats = [];
  for (const room of examRooms) {
    if (!room) continue;
    const roomBookings = await ExamBooking.countDocuments({
      examRoom: room._id,
      examDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'cancelled' },
    });

    examRoomStats.push({
      id: room._id,
      name: room.name,
      examType: room.examType,
      capacity: room.capacity,
      bookings: roomBookings,
      utilization: room.capacity > 0 ? (roomBookings / room.capacity * 100).toFixed(2) : 0,
    });
  }

  const newLicenseCount = examRoomId
    ? 0
    : await DrivingLicense.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

  return {
    date: formatDate(date),
    filterExamRoom: examRoomId ? { id: examRoomId, name: examRoomName } : null,
    enrollment: {
      total: enrollmentCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
    exams: {
      totalBookings: examBookings,
      completed: completedExams.length,
      passed: passedExams,
      failed: failedExams,
      passRate: parseFloat(passRate),
      noShow: noShowCount,
      late: lateCount,
      newLicenses: newLicenseCount,
    },
    vehicles: {
      total: totalVehicles,
      inUse: inUseVehicles,
      maintenance: maintenanceVehicles,
      available: totalVehicles - inUseVehicles - maintenanceVehicles,
      utilizationRate: parseFloat(vehicleUtilization),
    },
    schedules: {
      total: scheduleCount,
      completed: completedSchedules,
    },
    examRooms: examRoomStats,
    generatedAt: new Date(),
  };
};

const generateDateRangeReport = async (startDate, endDate, examRoomId = null) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const examRoom = examRoomId ? await ExamRoom.findById(examRoomId) : null;
  const examRoomName = examRoom ? examRoom.name : '全部场地';

  const dates = getDatesBetween(start, end);
  const dailyReports = [];

  for (const date of dates) {
    const report = await generateDailyReport(date, examRoomId);
    dailyReports.push(report);
  }

  const summary = {
    startDate: formatDate(start),
    endDate: formatDate(end),
    filterExamRoom: examRoomId ? { id: examRoomId, name: examRoomName } : null,
    totalDays: dates.length,
    totalEnrollment: dailyReports.reduce((sum, r) => sum + r.enrollment.total, 0),
    totalApproved: dailyReports.reduce((sum, r) => sum + r.enrollment.approved, 0),
    totalRejected: dailyReports.reduce((sum, r) => sum + r.enrollment.rejected, 0),
    totalExamBookings: dailyReports.reduce((sum, r) => sum + r.exams.totalBookings, 0),
    totalCompletedExams: dailyReports.reduce((sum, r) => sum + r.exams.completed, 0),
    totalPassedExams: dailyReports.reduce((sum, r) => sum + r.exams.passed, 0),
    totalFailedExams: dailyReports.reduce((sum, r) => sum + r.exams.failed, 0),
    averagePassRate: dailyReports.length > 0
      ? (dailyReports.reduce((sum, r) => sum + r.exams.passRate, 0) / dailyReports.length).toFixed(2)
      : 0,
    averageVehicleUtilization: dailyReports.length > 0
      ? (dailyReports.reduce((sum, r) => sum + r.vehicles.utilizationRate, 0) / dailyReports.length).toFixed(2)
      : 0,
    totalNoShow: dailyReports.reduce((sum, r) => sum + r.exams.noShow, 0),
    totalLate: dailyReports.reduce((sum, r) => sum + r.exams.late, 0),
    totalNewLicenses: dailyReports.reduce((sum, r) => sum + (r.exams.newLicenses || 0), 0),
  };

  const examTypeStats = await getExamTypeStats(start, end, examRoomId);
  const licenseTypeStats = await getLicenseTypeStats(start, end);

  return {
    summary,
    dailyReports,
    examTypeStats,
    licenseTypeStats,
  };
};

const getExamTypeStats = async (startDate, endDate, examRoomId = null) => {
  const matchCondition = {
    examDate: { $gte: startDate, $lte: endDate },
    status: 'completed',
  };
  if (examRoomId) {
    matchCondition.examRoom = new mongoose.Types.ObjectId(examRoomId);
  }

  const mongoose = require('mongoose');
  const stats = await ExamBooking.aggregate([
    { $match: matchCondition },
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
    { $sort: { _id: 1 } },
  ]);

  return stats.map((s) => ({
    examType: s._id,
    examTypeName: getExamTypeName(s._id),
    total: s.total,
    passed: s.passed,
    failed: s.failed,
    passRate: s.total > 0 ? (s.passed / s.total * 100).toFixed(2) : 0,
    avgScore: s.avgScore ? s.avgScore.toFixed(1) : 0,
  }));
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

const getLicenseTypeStats = async (startDate, endDate) => {
  const stats = await Student.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$licenseType',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return stats;
};

const exportReportToExcel = async (startDate, endDate, type = 'all', examRoomId = null) => {
  const report = await generateDateRangeReport(startDate, endDate, examRoomId);
  const examRoom = examRoomId ? await ExamRoom.findById(examRoomId) : null;
  const filterLabel = examRoom ? `_${examRoom.name}` : '';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '驾校管理系统';
  workbook.created = new Date();

  if (type === 'summary' || type === 'all') {
    const summarySheet = workbook.addWorksheet('汇总报表');

    summarySheet.columns = [
      { header: '指标', key: 'metric', width: 30 },
      { header: '数值', key: 'value', width: 22 },
    ];

    const { summary } = report;
    const rows = [
      { metric: '统计起始日期', value: summary.startDate },
      { metric: '统计结束日期', value: summary.endDate },
      { metric: '统计天数', value: summary.totalDays },
      { metric: '筛选场地', value: summary.filterExamRoom ? summary.filterExamRoom.name : '全部场地' },
      { metric: '', value: '' },
      { metric: '【报名统计】', value: '' },
      { metric: '总报名人数', value: summary.totalEnrollment },
      { metric: '审核通过人数', value: summary.totalApproved },
      { metric: '审核驳回人数', value: summary.totalRejected },
      { metric: '', value: '' },
      { metric: '【考试统计】', value: '' },
      { metric: '总预约考试数', value: summary.totalExamBookings },
      { metric: '已完成考试数', value: summary.totalCompletedExams },
      { metric: '通过考试数', value: summary.totalPassedExams },
      { metric: '未通过考试数', value: summary.totalFailedExams },
      { metric: '平均通过率(%)', value: summary.averagePassRate },
      { metric: '缺考人数', value: summary.totalNoShow },
      { metric: '迟到人数', value: summary.totalLate },
      { metric: '新发证数量', value: summary.totalNewLicenses },
      { metric: '', value: '' },
      { metric: '【车辆统计】', value: '' },
      { metric: '平均车辆利用率(%)', value: summary.averageVehicleUtilization },
    ];

    rows.forEach((r) => summarySheet.addRow(r));

    summarySheet.getRow(1).font = { bold: true, size: 12 };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    ['【报名统计】', '【考试统计】', '【车辆统计】'].forEach((label, idx) => {
      const rowIdx = rows.findIndex((r) => r.metric === label) + 1;
      if (rowIdx > 0) {
        summarySheet.getRow(rowIdx).font = { bold: true, size: 11, color: { argb: 'FF1F4E79' } };
      }
    });
  }

  if (type === 'daily' || type === 'all') {
    const dailySheet = workbook.addWorksheet('每日明细');

    dailySheet.columns = [
      { header: '日期', key: 'date', width: 12 },
      { header: '报名人数', key: 'enrollment', width: 10 },
      { header: '通过人数', key: 'approved', width: 10 },
      { header: '考试预约数', key: 'examBookings', width: 12 },
      { header: '完成考试数', key: 'completedExams', width: 12 },
      { header: '通过数', key: 'passed', width: 8 },
      { header: '通过率(%)', key: 'passRate', width: 10 },
      { header: '新发证数', key: 'newLicenses', width: 10 },
      { header: '车辆利用率(%)', key: 'vehicleUtil', width: 14 },
      { header: '缺考数', key: 'noShow', width: 8 },
      { header: '迟到数', key: 'late', width: 8 },
    ];

    report.dailyReports.forEach((r) => {
      dailySheet.addRow({
        date: r.date,
        enrollment: r.enrollment.total,
        approved: r.enrollment.approved,
        examBookings: r.exams.totalBookings,
        completedExams: r.exams.completed,
        passed: r.exams.passed,
        passRate: r.exams.passRate,
        newLicenses: r.exams.newLicenses || 0,
        vehicleUtil: r.vehicles.utilizationRate,
        noShow: r.exams.noShow,
        late: r.exams.late,
      });
    });

    dailySheet.getRow(1).font = { bold: true, size: 11 };
    dailySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  if (type === 'examType' || type === 'all') {
    const examSheet = workbook.addWorksheet('各科目统计');

    examSheet.columns = [
      { header: '考试科目', key: 'examType', width: 12 },
      { header: '考试名称', key: 'examTypeName', width: 12 },
      { header: '考试总数', key: 'total', width: 10 },
      { header: '通过数', key: 'passed', width: 10 },
      { header: '未通过数', key: 'failed', width: 10 },
      { header: '通过率(%)', key: 'passRate', width: 10 },
      { header: '平均分数', key: 'avgScore', width: 10 },
    ];

    report.examTypeStats.forEach((s) => {
      examSheet.addRow(s);
    });

    examSheet.getRow(1).font = { bold: true, size: 11 };
    examSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  if (type === 'enrollment' || type === 'all') {
    const enrollmentSheet = workbook.addWorksheet('报名明细');

    const studentQuery = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    const students = await Student.find(studentQuery)
      .populate('assignedCoach', 'name')
      .sort({ createdAt: -1 });

    enrollmentSheet.columns = [
      { header: '姓名', key: 'name', width: 12 },
      { header: '身份证号', key: 'idCard', width: 20 },
      { header: '联系电话', key: 'phone', width: 14 },
      { header: '驾照类型', key: 'licenseType', width: 10 },
      { header: '分配教练', key: 'coachName', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '报名日期', key: 'enrollmentDate', width: 12 },
    ];

    students.forEach((s) => {
      enrollmentSheet.addRow({
        name: s.name,
        idCard: s.idCard,
        phone: s.phone,
        licenseType: s.licenseType,
        coachName: s.assignedCoach ? s.assignedCoach.name : '未分配',
        status: getStudentStatusName(s.status),
        enrollmentDate: formatDate(s.enrollmentDate),
      });
    });

    enrollmentSheet.getRow(1).font = { bold: true, size: 11 };
    enrollmentSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  if (type === 'examDetail' || type === 'all') {
    const examDetailSheet = workbook.addWorksheet('考试明细');

    const mongoose = require('mongoose');
    const examDetailQuery = {
      examDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };
    if (examRoomId) {
      examDetailQuery.examRoom = new mongoose.Types.ObjectId(examRoomId);
    }

    const examBookings = await ExamBooking.find(examDetailQuery)
      .populate('student', 'name licenseType')
      .populate('examRoom', 'name')
      .populate('coach', 'name')
      .populate('vehicle', 'plateNumber')
      .sort({ examDate: -1, 'timeSlot.startTime': 1 });

    examDetailSheet.columns = [
      { header: '考试日期', key: 'examDate', width: 12 },
      { header: '时段', key: 'timeSlot', width: 14 },
      { header: '考场', key: 'examRoom', width: 14 },
      { header: '科目', key: 'examType', width: 10 },
      { header: '学员姓名', key: 'studentName', width: 12 },
      { header: '驾照类型', key: 'licenseType', width: 10 },
      { header: '教练', key: 'coachName', width: 12 },
      { header: '车辆', key: 'plateNumber', width: 12 },
      { header: '状态', key: 'status', width: 10 },
      { header: '分数', key: 'score', width: 8 },
      { header: '是否通过', key: 'passed', width: 10 },
    ];

    examBookings.forEach((b) => {
      examDetailSheet.addRow({
        examDate: formatDate(b.examDate),
        timeSlot: `${b.timeSlot.startTime}-${b.timeSlot.endTime}`,
        examRoom: b.examRoom ? b.examRoom.name : '',
        examType: getExamTypeName(b.examType),
        studentName: b.student ? b.student.name : '',
        licenseType: b.student ? b.student.licenseType : '',
        coachName: b.coach ? b.coach.name : '',
        plateNumber: b.vehicle ? b.vehicle.plateNumber : '',
        status: getExamStatusName(b.status),
        score: b.result ? b.result.score : '',
        passed: b.result ? (b.result.passed ? '是' : '否') : '',
      });
    });

    examDetailSheet.getRow(1).font = { bold: true, size: 11 };
    examDetailSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, fileName: `运营报表${filterLabel}_${formatDate(startDate)}_至${formatDate(endDate)}.xlsx` };
};

const getStudentStatusName = (status) => {
  const names = {
    pending_review: '待审核',
    approved: '已通过',
    rejected: '已驳回',
    learning: '学习中',
    examining: '考试中',
    completed: '已完成',
    suspended: '已暂停',
  };
  return names[status] || status;
};

const getExamStatusName = (status) => {
  const names = {
    pending: '待确认',
    confirmed: '已确认',
    locked: '已锁定',
    cancelled: '已取消',
    completed: '已完成',
    no_show: '缺考',
    late: '迟到',
  };
  return names[status] || status;
};

const getVehicleUtilizationReport = async (startDate, endDate, examRoomId = null) => {
  let vehicleFilter = { status: { $ne: 'disabled' } };

  if (examRoomId) {
    const mongoose = require('mongoose');
    const relatedVehicleIds = await ExamBooking.aggregate([
      {
        $match: {
          examRoom: new mongoose.Types.ObjectId(examRoomId),
          examDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
          vehicle: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$vehicle' } },
    ]);
    const ids = relatedVehicleIds.map((v) => v._id);
    vehicleFilter = { _id: { $in: ids } };
  }

  const vehicles = await Vehicle.find(vehicleFilter);
  const result = [];

  for (const vehicle of vehicles) {
    const examQuery = examRoomId
      ? {
          vehicle: vehicle._id,
          examRoom: examRoomId,
          examDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        }
      : {
          vehicle: vehicle._id,
          examDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };

    const bookings = await ExamBooking.find({
      ...examQuery,
      status: { $ne: 'cancelled' },
    });

    const scheduleQuery = examRoomId
      ? {
          vehicle: vehicle._id,
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        }
      : {
          vehicle: vehicle._id,
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };

    const schedules = await Schedule.find({
      ...scheduleQuery,
      status: { $ne: 'cancelled' },
    });

    let totalHours = 0;
    [...bookings, ...schedules].forEach((item) => {
      const startTime = item.timeSlot ? item.timeSlot.startTime : item.startTime;
      const endTime = item.timeSlot ? item.timeSlot.endTime : item.endTime;
      if (startTime && endTime) {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        totalHours += (eh * 60 + em - sh * 60 - sm) / 60;
      }
    });

    const dates = getDatesBetween(startDate, endDate);
    const maxHours = dates.length * 8;
    const utilization = maxHours > 0 ? (totalHours / maxHours * 100).toFixed(2) : 0;

    result.push({
      vehicleId: vehicle._id,
      plateNumber: vehicle.plateNumber,
      brand: vehicle.brand,
      model: vehicle.model,
      licenseType: vehicle.licenseType,
      status: vehicle.status,
      totalUsageHours: totalHours.toFixed(1),
      utilizationRate: parseFloat(utilization),
      scheduleCount: schedules.length,
      examCount: bookings.length,
    });
  }

  return result.sort((a, b) => b.utilizationRate - a.utilizationRate);
};

module.exports = {
  generateDailyReport,
  generateDateRangeReport,
  exportReportToExcel,
  getVehicleUtilizationReport,
  getExamTypeStats,
};
