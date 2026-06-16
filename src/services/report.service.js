const Student = require('../models/Student');
const ExamBooking = require('../models/ExamBooking');
const Vehicle = require('../models/Vehicle');
const Schedule = require('../models/Schedule');
const ExamRoom = require('../models/ExamRoom');
const ExcelJS = require('exceljs');
const { formatDate, getDatesBetween } = require('../utils/dateUtils');

const generateDailyReport = async (date = new Date()) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

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

  const examBookings = await ExamBooking.countDocuments({
    examDate: { $gte: startOfDay, $lte: endOfDay },
  });

  const completedExams = await ExamBooking.find({
    examDate: { $gte: startOfDay, $lte: endOfDay },
    status: 'completed',
  });

  const passedExams = completedExams.filter((e) => e.result && e.result.passed).length;
  const failedExams = completedExams.filter((e) => e.result && !e.result.passed).length;
  const passRate = completedExams.length > 0 ? (passedExams / completedExams.length * 100).toFixed(2) : 0;

  const totalVehicles = await Vehicle.countDocuments({ status: { $ne: 'disabled' } });
  const inUseVehicles = await Vehicle.countDocuments({ status: 'in_use' });
  const maintenanceVehicles = await Vehicle.countDocuments({
    status: { $in: ['maintenance', 'repairing'] },
  });
  const vehicleUtilization = totalVehicles > 0 ? (inUseVehicles / totalVehicles * 100).toFixed(2) : 0;

  const scheduleCount = await Schedule.countDocuments({
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: 'cancelled' },
  });

  const completedSchedules = await Schedule.countDocuments({
    date: { $gte: startOfDay, $lte: endOfDay },
    status: 'completed',
  });

  const noShowCount = await ExamBooking.countDocuments({
    examDate: { $gte: startOfDay, $lte: endOfDay },
    status: 'no_show',
  });

  const lateCount = await ExamBooking.countDocuments({
    examDate: { $gte: startOfDay, $lte: endOfDay },
    status: 'late',
  });

  const examRooms = await ExamRoom.find({ status: 'active' });
  const examRoomStats = [];

  for (const room of examRooms) {
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

  return {
    date: formatDate(date),
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

const generateDateRangeReport = async (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const dates = getDatesBetween(start, end);
  const dailyReports = [];

  for (const date of dates) {
    const report = await generateDailyReport(date);
    dailyReports.push(report);
  }

  const summary = {
    startDate: formatDate(start),
    endDate: formatDate(end),
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
  };

  const examTypeStats = await getExamTypeStats(start, end);
  const licenseTypeStats = await getLicenseTypeStats(start, end);

  return {
    summary,
    dailyReports,
    examTypeStats,
    licenseTypeStats,
  };
};

const getExamTypeStats = async (startDate, endDate) => {
  const stats = await ExamBooking.aggregate([
    {
      $match: {
        examDate: { $gte: startDate, $lte: endDate },
        status: 'completed',
      },
    },
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

const exportReportToExcel = async (startDate, endDate, type = 'summary') => {
  const report = await generateDateRangeReport(startDate, endDate);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '驾校管理系统';
  workbook.created = new Date();

  if (type === 'summary' || type === 'all') {
    const summarySheet = workbook.addWorksheet('汇总报表');

    summarySheet.columns = [
      { header: '指标', key: 'metric', width: 25 },
      { header: '数值', key: 'value', width: 20 },
    ];

    const { summary } = report;
    summarySheet.addRows([
      { metric: '统计起始日期', value: summary.startDate },
      { metric: '统计结束日期', value: summary.endDate },
      { metric: '统计天数', value: summary.totalDays },
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
      { metric: '', value: '' },
      { metric: '【车辆统计】', value: '' },
      { metric: '平均车辆利用率(%)', value: summary.averageVehicleUtilization },
    ]);

    summarySheet.getRow(1).font = { bold: true, size: 12 };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
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

    const students = await Student.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    }).sort({ createdAt: -1 });

    enrollmentSheet.columns = [
      { header: '姓名', key: 'name', width: 12 },
      { header: '身份证号', key: 'idCard', width: 20 },
      { header: '联系电话', key: 'phone', width: 14 },
      { header: '驾照类型', key: 'licenseType', width: 10 },
      { header: '状态', key: 'status', width: 12 },
      { header: '报名日期', key: 'enrollmentDate', width: 12 },
    ];

    students.forEach((s) => {
      enrollmentSheet.addRow({
        name: s.name,
        idCard: s.idCard,
        phone: s.phone,
        licenseType: s.licenseType,
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

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
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

const getVehicleUtilizationReport = async (startDate, endDate) => {
  const vehicles = await Vehicle.find({ status: { $ne: 'disabled' } });
  const result = [];

  for (const vehicle of vehicles) {
    const schedules = await Schedule.find({
      vehicle: vehicle._id,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
      status: { $ne: 'cancelled' },
    });

    const totalHours = schedules.reduce((sum, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      return sum + (eh * 60 + em - sh * 60 - sm) / 60;
    }, 0);

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
    });
  }

  return result.sort((a, b) => b.utilizationRate - a.utilizationRate);
};

module.exports = {
  generateDailyReport,
  generateDateRangeReport,
  exportReportToExcel,
  getVehicleUtilizationReport,
  getExamTypeStats: getExamTypeStats,
};
