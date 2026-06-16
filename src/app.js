const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');

dotenv.config();

const connectDB = require('./config/database');
const { initSocket } = require('./config/socket');

const studentRoutes = require('./routes/student.routes');
const coachRoutes = require('./routes/coach.routes');
const vehicleRoutes = require('./routes/vehicle.routes');
const examRoutes = require('./routes/exam.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const reportRoutes = require('./routes/report.routes');
const notificationRoutes = require('./routes/notification.routes');

const errorHandler = require('./middleware/errorHandler');
const { startCronJobs } = require('./services/cron.service');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '驾校管理系统运行正常' });
});

app.use('/api/students', studentRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB();
    initSocket(server);
    startCronJobs();
    
    server.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

start();

module.exports = app;
