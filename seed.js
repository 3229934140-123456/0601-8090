const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Coach = require('./src/models/Coach');
const Vehicle = require('./src/models/Vehicle');
const ExamRoom = require('./src/models/ExamRoom');
const Student = require('./src/models/Student');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('开始初始化数据...');

    await Coach.deleteMany({});
    await Vehicle.deleteMany({});
    await ExamRoom.deleteMany({});

    const coaches = await Coach.create([
      {
        name: '张教练',
        employeeId: 'C001',
        idCard: '110101198001011234',
        phone: '13800138001',
        licenseTypes: ['C1', 'C2'],
        coachLicenseNumber: 'JL20200101001',
        status: 'active',
        skills: ['常规保养', '安全检测', '发动机维修'],
        hireDate: new Date('2020-01-15'),
      },
      {
        name: '李教练',
        employeeId: 'C002',
        idCard: '110101198202022345',
        phone: '13800138002',
        licenseTypes: ['C1', 'B2'],
        coachLicenseNumber: 'JL20200202002',
        status: 'active',
        skills: ['常规保养', '机油更换', '制动系统'],
        hireDate: new Date('2020-03-20'),
      },
      {
        name: '王教练',
        employeeId: 'C003',
        idCard: '110101198503033456',
        phone: '13800138003',
        licenseTypes: ['C2', 'B1'],
        coachLicenseNumber: 'JL20200303003',
        status: 'active',
        skills: ['电气系统', '轮胎检查', '常规保养'],
        hireDate: new Date('2021-05-10'),
      },
      {
        name: '赵技师',
        employeeId: 'T001',
        idCard: '110101197805055678',
        phone: '13900139001',
        licenseTypes: ['C1'],
        coachLicenseNumber: 'JL20190505004',
        status: 'active',
        skills: ['发动机维修', '变速箱维修', '底盘维修', '电气系统', '制动系统'],
        hireDate: new Date('2019-08-01'),
      },
    ]);

    console.log(`创建了 ${coaches.length} 个教练`);

    const vehicles = await Vehicle.create([
      {
        plateNumber: '京A12345',
        brand: '大众',
        model: '桑塔纳',
        licenseType: 'C1',
        status: 'available',
        mileage: 12000,
        lastMaintenanceMileage: 10000,
        nextMaintenanceMileage: 15000,
        maintenanceInterval: 5000,
        purchaseDate: new Date('2022-06-15'),
        assignedCoach: coaches[0]._id,
        currentLocation: '驾校停车场',
      },
      {
        plateNumber: '京B23456',
        brand: '丰田',
        model: '卡罗拉',
        licenseType: 'C2',
        status: 'available',
        mileage: 8500,
        lastMaintenanceMileage: 5000,
        nextMaintenanceMileage: 10000,
        maintenanceInterval: 5000,
        purchaseDate: new Date('2023-01-20'),
        assignedCoach: coaches[2]._id,
        currentLocation: '驾校停车场',
      },
      {
        plateNumber: '京C34567',
        brand: '大众',
        model: '朗逸',
        licenseType: 'C1',
        status: 'in_use',
        mileage: 25000,
        lastMaintenanceMileage: 25000,
        nextMaintenanceMileage: 30000,
        maintenanceInterval: 5000,
        purchaseDate: new Date('2021-11-10'),
        assignedCoach: coaches[1]._id,
        currentLocation: '训练场地',
      },
      {
        plateNumber: '京D45678',
        brand: '日产',
        model: '轩逸',
        licenseType: 'C2',
        status: 'available',
        mileage: 15000,
        lastMaintenanceMileage: 10000,
        nextMaintenanceMileage: 15000,
        maintenanceInterval: 5000,
        purchaseDate: new Date('2022-09-01'),
        assignedCoach: coaches[0]._id,
        currentLocation: '驾校停车场',
      },
    ]);

    console.log(`创建了 ${vehicles.length} 辆车`);

    const examRooms = await ExamRoom.create([
      {
        name: '科目一考场A',
        address: '驾校综合楼3层',
        examType: 'subject1',
        capacity: 50,
        workDays: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00',
        timeSlots: [
          { startTime: '09:00', endTime: '10:30', capacity: 50 },
          { startTime: '10:30', endTime: '12:00', capacity: 50 },
          { startTime: '14:00', endTime: '15:30', capacity: 50 },
          { startTime: '15:30', endTime: '17:00', capacity: 50 },
        ],
        status: 'active',
      },
      {
        name: '科目二考场A',
        address: '驾校东区训练场',
        examType: 'subject2',
        capacity: 20,
        workDays: [1, 2, 3, 4, 5, 6],
        startTime: '08:00',
        endTime: '18:00',
        timeSlots: [
          { startTime: '08:00', endTime: '10:00', capacity: 10 },
          { startTime: '10:00', endTime: '12:00', capacity: 10 },
          { startTime: '14:00', endTime: '16:00', capacity: 10 },
          { startTime: '16:00', endTime: '18:00', capacity: 10 },
        ],
        status: 'active',
      },
      {
        name: '科目三考场A',
        address: '驾校考试路段',
        examType: 'subject3',
        capacity: 15,
        workDays: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '17:00',
        timeSlots: [
          { startTime: '08:00', endTime: '09:30', capacity: 5 },
          { startTime: '09:30', endTime: '11:00', capacity: 5 },
          { startTime: '14:00', endTime: '15:30', capacity: 5 },
          { startTime: '15:30', endTime: '17:00', capacity: 5 },
        ],
        status: 'active',
      },
      {
        name: '科目四考场A',
        address: '驾校综合楼4层',
        examType: 'subject4',
        capacity: 40,
        workDays: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00',
        timeSlots: [
          { startTime: '09:00', endTime: '10:00', capacity: 40 },
          { startTime: '10:00', endTime: '11:00', capacity: 40 },
          { startTime: '14:00', endTime: '15:00', capacity: 40 },
          { startTime: '15:00', endTime: '16:00', capacity: 40 },
        ],
        status: 'active',
      },
    ]);

    console.log(`创建了 ${examRooms.length} 个考场`);

    const students = await Student.create([
      {
        name: '学员小明',
        idCard: '110101200001011234',
        idCardExpiryDate: new Date('2035-01-01'),
        phone: '13900139011',
        address: '北京市朝阳区',
        licenseType: 'C1',
        healthReport: {
          status: 'approved',
          reportUrl: '/reports/health/001.pdf',
          uploadDate: new Date('2024-01-10'),
          checkDate: new Date('2024-01-11'),
          remark: '体检合格',
        },
        status: 'learning',
        studyHours: {
          theory: 15,
          practical: 20,
          requiredTheory: 12,
          requiredPractical: 48,
        },
        noShowCount: 0,
        lateCount: 0,
        assignedCoach: coaches[0]._id,
        enrollmentDate: new Date('2024-01-15'),
        hasDrivingLicense: false,
      },
      {
        name: '学员小红',
        idCard: '110101200102022345',
        idCardExpiryDate: new Date('2036-02-02'),
        phone: '13900139012',
        address: '北京市海淀区',
        licenseType: 'C2',
        healthReport: {
          status: 'approved',
          reportUrl: '/reports/health/002.pdf',
          uploadDate: new Date('2024-02-01'),
          checkDate: new Date('2024-02-02'),
          remark: '体检合格',
        },
        status: 'approved',
        studyHours: {
          theory: 10,
          practical: 5,
          requiredTheory: 12,
          requiredPractical: 48,
        },
        noShowCount: 0,
        lateCount: 0,
        assignedCoach: coaches[2]._id,
        enrollmentDate: new Date('2024-02-10'),
        hasDrivingLicense: false,
      },
    ]);

    console.log(`创建了 ${students.length} 个学员`);

    console.log('数据初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('初始化数据失败:', error.message);
    process.exit(1);
  }
};

seedData();
