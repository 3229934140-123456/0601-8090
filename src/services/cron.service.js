const cron = require('node-cron');
const maintenanceService = require('./maintenance.service');
const reportService = require('./report.service');
const { checkIdCardExpiry } = require('./student.service');
const { notifyOperator } = require('./notification.service');
const { formatDate } = require('../utils/dateUtils');

const startCronJobs = () => {
  console.log('定时任务已启动');

  cron.schedule('0 1 * * *', async () => {
    console.log('执行每日保养检查...');
    try {
      const orders = await maintenanceService.checkAndCreateMaintenanceOrders();
      console.log(`生成 ${orders.length} 个保养工单`);
    } catch (error) {
      console.error('保养检查失败:', error.message);
    }
  });

  cron.schedule('0 * * * *', async () => {
    console.log('执行超时工单检查...');
    try {
      const overdueCount = await maintenanceService.checkOverdueOrders();
      console.log(`发现 ${overdueCount} 个超时工单`);
    } catch (error) {
      console.error('超时检查失败:', error.message);
    }
  });

  cron.schedule('0 2 * * *', async () => {
    console.log('执行身份证过期检查...');
    try {
      const count = await checkIdCardExpiry();
      console.log(`发现 ${count} 个即将过期的身份证`);
    } catch (error) {
      console.error('身份证检查失败:', error.message);
    }
  });

  cron.schedule('0 8 * * *', async () => {
    console.log('生成每日运营报表...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const report = await reportService.generateDailyReport(yesterday);

      await notifyOperator(
        'system_admin',
        'report_ready',
        '每日运营报表已生成',
        `${formatDate(yesterday)} 运营报表已生成。报名：${report.enrollment.total}人，考试通过率：${report.exams.passRate}%，车辆利用率：${report.vehicles.utilizationRate}%`,
        null,
        'Report'
      );

      console.log('每日报表已生成并通知');
    } catch (error) {
      console.error('生成每日报表失败:', error.message);
    }
  });

  console.log('已注册定时任务：');
  console.log('  - 每日 01:00 保养工单检查');
  console.log('  - 每 1 小时 超时工单检查');
  console.log('  - 每日 02:00 身份证过期检查');
  console.log('  - 每日 08:00 生成运营报表');
};

module.exports = {
  startCronJobs,
};
