const reportService = require('../services/report.service');

const getDailyReport = async (req, res, next) => {
  try {
    const { date } = req.query;
    const report = await reportService.generateDailyReport(date ? new Date(date) : new Date());
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

const getDateRangeReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '请提供起始日期和结束日期',
      });
    }

    const report = await reportService.generateDateRangeReport(startDate, endDate);
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

const exportExcel = async (req, res, next) => {
  try {
    const { startDate, endDate, type } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '请提供起始日期和结束日期',
      });
    }

    const buffer = await reportService.exportReportToExcel(startDate, endDate, type || 'all');

    const fileName = `运营报表_${startDate}_${endDate}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const getVehicleUtilization = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: '请提供起始日期和结束日期',
      });
    }

    const report = await reportService.getVehicleUtilizationReport(startDate, endDate);
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDailyReport,
  getDateRangeReport,
  exportExcel,
  getVehicleUtilization,
};
