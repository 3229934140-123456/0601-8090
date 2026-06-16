const MaintenanceOrder = require('../models/MaintenanceOrder');
const Vehicle = require('../models/Vehicle');
const Coach = require('../models/Coach');
const { AppError } = require('../middleware/errorHandler');
const { formatDate, addHours, diffHours } = require('../utils/dateUtils');
const { notifyCoach, notifyAdmin, notifyOperator } = require('./notification.service');

const MAINTENANCE_INTERVAL = 5000;
const MAINTENANCE_DEADLINE_HOURS = 48;
const ESCALATION_HOURS = 24;

const TECHNICIAN_SKILLS = {
  routine_maintenance: ['常规保养', '机油更换', '滤芯更换', '轮胎检查'],
  repair: ['发动机维修', '变速箱维修', '制动系统', '电气系统', '底盘维修'],
  inspection: ['安全检测', '年检', '综合检测'],
};

const checkAndCreateMaintenanceOrders = async () => {
  const vehicles = await Vehicle.find({
    status: { $in: ['available', 'in_use'] },
  });

  const createdOrders = [];

  for (const vehicle of vehicles) {
    const mileageSinceLast = vehicle.mileage - vehicle.lastMaintenanceMileage;

    if (mileageSinceLast >= vehicle.maintenanceInterval) {
      const existingPending = await MaintenanceOrder.countDocuments({
        vehicle: vehicle._id,
        status: { $in: ['pending', 'assigned', 'in_progress'] },
        orderType: 'routine_maintenance',
      });

      if (existingPending === 0) {
        const order = await createRoutineMaintenance(vehicle);
        createdOrders.push(order);
      }
    }
  }

  return createdOrders;
};

const createRoutineMaintenance = async (vehicle) => {
  const description = `车辆里程达到 ${vehicle.mileage} 公里，需要进行例行保养。上次保养里程：${vehicle.lastMaintenanceMileage} 公里，保养间隔：${vehicle.maintenanceInterval} 公里。`;

  const order = await MaintenanceOrder.create({
    vehicle: vehicle._id,
    orderType: 'routine_maintenance',
    priority: 'medium',
    status: 'pending',
    mileageAtCreation: vehicle.mileage,
    description,
    deadline: addHours(new Date(), MAINTENANCE_DEADLINE_HOURS),
  });

  vehicle.status = 'maintenance';
  await vehicle.save();

  const technician = await assignTechnician(order, vehicle);

  await notifyOperator(
    'system_admin',
    'maintenance_created',
    '新保养工单',
    `车辆 ${vehicle.plateNumber} 已生成保养工单，里程：${vehicle.mileage} 公里。`,
    order._id,
    'MaintenanceOrder'
  );

  if (vehicle.assignedCoach) {
    await notifyCoach(
      vehicle.assignedCoach,
      'maintenance_created',
      '车辆保养通知',
      `您负责的车辆 ${vehicle.plateNumber} 已安排保养，暂时无法使用。`,
      order._id,
      'MaintenanceOrder'
    );
  }

  return order;
};

const assignTechnician = async (order, vehicle) => {
  const requiredSkills = TECHNICIAN_SKILLS[order.orderType] || [];

  const technicians = await Coach.find({
    status: 'active',
    skills: { $in: requiredSkills },
  });

  let bestTechnician = null;
  let maxSkillMatch = 0;

  for (const tech of technicians) {
    const skillMatch = tech.skills.filter((s) => requiredSkills.includes(s)).length;

    const activeOrders = await MaintenanceOrder.countDocuments({
      assignedTechnician: tech._id,
      status: { $in: ['assigned', 'in_progress'] },
    });

    if (skillMatch > maxSkillMatch || (skillMatch === maxSkillMatch && activeOrders < 3)) {
      bestTechnician = tech;
      maxSkillMatch = skillMatch;
    }
  }

  if (bestTechnician) {
    order.assignedTechnician = bestTechnician._id;
    order.technicianSkills = bestTechnician.skills.filter((s) => requiredSkills.includes(s));
    order.status = 'assigned';
    order.scheduledDate = new Date();
    await order.save();

    await notifyCoach(
      bestTechnician._id,
      'maintenance_created',
      '新维修任务',
      `您有新的维修任务：车辆 ${vehicle.plateNumber}，类型：${getOrderTypeName(order.orderType)}。`,
      order._id,
      'MaintenanceOrder'
    );
  }

  return bestTechnician;
};

const getOrderTypeName = (type) => {
  const names = {
    routine_maintenance: '例行保养',
    repair: '故障维修',
    inspection: '安全检测',
  };
  return names[type] || type;
};

const createRepairOrder = async (vehicleId, repairData) => {
  const { description, priority = 'medium', reportedBy } = repairData;

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) {
    throw new AppError('车辆不存在', 404);
  }

  const order = await MaintenanceOrder.create({
    vehicle: vehicleId,
    orderType: 'repair',
    priority,
    status: 'pending',
    mileageAtCreation: vehicle.mileage,
    description,
    deadline: priority === 'urgent' ? addHours(new Date(), 4) : addHours(new Date(), MAINTENANCE_DEADLINE_HOURS),
  });

  const technician = await assignTechnician(order, vehicle);

  vehicle.status = 'repairing';
  await vehicle.save();

  await notifyOperator(
    'system_admin',
    'maintenance_created',
    '新维修工单',
    `车辆 ${vehicle.plateNumber} 已生成维修工单：${description.substring(0, 30)}...`,
    order._id,
    'MaintenanceOrder'
  );

  return {
    order,
    technician,
  };
};

const getMaintenanceOrders = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    vehicleId,
    technicianId,
    orderType,
    status,
    priority,
  } = query;

  try {
    await checkOverdueOrders();
  } catch (checkErr) {
    console.error('查询工单前自动检查超时失败:', checkErr.message);
  }

  const filter = {};
  if (vehicleId) filter.vehicle = vehicleId;
  if (technicianId) filter.assignedTechnician = technicianId;
  if (orderType) filter.orderType = orderType;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const orders = await MaintenanceOrder.find(filter)
    .populate('vehicle', 'plateNumber brand model licenseType status')
    .populate('assignedTechnician', 'name phone skills')
    .sort({ priority: -1, createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await MaintenanceOrder.countDocuments(filter);

  const stats = await MaintenanceOrder.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    orders,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats,
  };
};

const getMaintenanceOrderById = async (orderId) => {
  const order = await MaintenanceOrder.findById(orderId)
    .populate('vehicle', 'plateNumber brand model licenseType status')
    .populate('assignedTechnician', 'name phone skills');

  if (!order) {
    throw new AppError('工单不存在', 404);
  }

  return order;
};

const startMaintenance = async (orderId, technicianId) => {
  const order = await MaintenanceOrder.findById(orderId).populate('vehicle');
  if (!order) {
    throw new AppError('工单不存在', 404);
  }

  if (!['assigned', 'pending', 'escalated'].includes(order.status)) {
    throw new AppError('该工单状态不允许开始', 400);
  }

  order.status = 'in_progress';
  order.startDate = new Date();
  if (technicianId) {
    order.assignedTechnician = technicianId;
  }
  await order.save();

  return order;
};

const completeMaintenance = async (orderId, completionData = {}) => {
  const { cost, parts, notes } = completionData;

  const order = await MaintenanceOrder.findById(orderId).populate('vehicle');
  if (!order) {
    throw new AppError('工单不存在', 404);
  }

  if (order.status !== 'in_progress') {
    throw new AppError('该工单状态不允许完成', 400);
  }

  order.status = 'completed';
  order.completionDate = new Date();
  order.cost = cost || 0;
  order.parts = parts || [];
  order.notes = notes || '';
  await order.save();

  const vehicle = order.vehicle;
  if (vehicle) {
    if (order.orderType === 'routine_maintenance') {
      vehicle.lastMaintenanceMileage = order.mileageAtCreation;
      vehicle.nextMaintenanceMileage = vehicle.mileage + vehicle.maintenanceInterval;
    }

    const pendingOrders = await MaintenanceOrder.countDocuments({
      vehicle: vehicle._id,
      status: { $in: ['pending', 'assigned', 'in_progress', 'escalated'] },
      _id: { $ne: orderId },
    });

    if (pendingOrders === 0) {
      vehicle.status = 'available';
      await vehicle.save();
    }
  }

  await notifyOperator(
    'system_admin',
    'system_alert',
    '保养工单已完成',
    `工单 ${order._id} 已完成，费用：${order.cost} 元。`,
    order._id,
    'MaintenanceOrder'
  );

  if (vehicle && vehicle.assignedCoach) {
    await notifyCoach(
      vehicle.assignedCoach,
      'system_alert',
      '车辆保养完成',
      `您负责的车辆 ${vehicle.plateNumber} 保养已完成，可以使用了。`,
      order._id,
      'MaintenanceOrder'
    );
  }

  return order;
};

const checkOverdueOrders = async () => {
  const now = new Date();

  const justOverdue = await MaintenanceOrder.find({
    status: { $in: ['pending', 'assigned', 'in_progress'] },
    deadline: { $lt: now },
    isOverdue: false,
  }).populate('vehicle');

  const alreadyOverdue = await MaintenanceOrder.find({
    status: { $in: ['pending', 'assigned', 'in_progress', 'escalated'] },
    isOverdue: true,
  }).populate('vehicle');

  let processedCount = 0;

  for (const order of justOverdue) {
    order.isOverdue = true;
    order.overdueHours = Math.max(0.1, Math.abs(diffHours(now, order.deadline)));
    order.status = 'escalated';
    order.priority = order.priority === 'low' ? 'medium'
      : order.priority === 'medium' ? 'high'
      : 'urgent';
    order.notes = `系统自动升级：工单已超时 ${order.overdueHours.toFixed(1)} 小时${order.notes ? '；' + order.notes : ''}`;

    await order.save();
    processedCount++;

    try {
      await notifyAdmin(
        'system_admin',
        'maintenance_escalated',
        '工单已超时并自动升级',
        `工单 ${order._id}（${order.vehicle.plateNumber}）已超时 ${order.overdueHours.toFixed(1)} 小时，状态已自动升级为待跟进，优先级升级为 ${getPriorityName(order.priority)}，请尽快处理。`,
        order._id,
        'MaintenanceOrder'
      );
    } catch (notifyErr) {
      console.error('发送超时通知失败:', notifyErr.message);
    }
  }

  for (const order of alreadyOverdue) {
    const currentOverdueHours = Math.max(0.1, Math.abs(diffHours(now, order.deadline)));
    const previousOverdueHours = order.overdueHours || 0;
    order.overdueHours = currentOverdueHours;

    let needUpgrade = false;
    let newPriority = order.priority;
    const upgradeThresholds = [
      { hours: 4, from: 'low', to: 'medium' },
      { hours: 8, from: 'medium', to: 'high' },
      { hours: 12, from: 'high', to: 'urgent' },
    ];

    for (const threshold of upgradeThresholds) {
      if (currentOverdueHours >= threshold.hours &&
          previousOverdueHours < threshold.hours &&
          order.priority === threshold.from) {
        newPriority = threshold.to;
        needUpgrade = true;
        break;
      }
    }

    if (order.status !== 'escalated') {
      order.status = 'escalated';
      needUpgrade = true;
    }

    if (needUpgrade) {
      order.priority = newPriority;
      order.notes = `系统自动升级（超时 ${currentOverdueHours.toFixed(1)} 小时）${order.notes ? '；' + order.notes : ''}`;
      await order.save();
      processedCount++;

      try {
        await notifyAdmin(
          'system_admin',
          'maintenance_escalated',
          '工单优先级升级',
          `工单 ${order._id}（${order.vehicle.plateNumber}）已超时 ${currentOverdueHours.toFixed(1)} 小时，优先级已升级为 ${getPriorityName(order.priority)}，请尽快处理。`,
          order._id,
          'MaintenanceOrder'
        );
      } catch (notifyErr) {
        console.error('发送升级通知失败:', notifyErr.message);
      }
    } else {
      await order.save();
    }
  }

  return processedCount;
};

const escalateOrder = async (orderId, reason = '') => {
  const order = await MaintenanceOrder.findById(orderId).populate('vehicle');
  if (!order) {
    throw new AppError('工单不存在', 404);
  }

  if (order.status === 'completed' || order.status === 'cancelled') {
    throw new AppError('该工单状态不允许升级', 400);
  }

  order.status = 'escalated';
  order.priority = order.priority === 'low' ? 'medium' :
                   order.priority === 'medium' ? 'high' : 'urgent';
  order.notes = reason ? `${order.notes || ''} 升级原因：${reason}`.trim() : order.notes;
  await order.save();

  await notifyAdmin(
    'system_admin',
    'maintenance_escalated',
    '工单已升级',
    `工单 ${order._id}（${order.vehicle.plateNumber}）已升级为 ${getPriorityName(order.priority)} 优先级，请及时处理。`,
    order._id,
    'MaintenanceOrder'
  );

  return order;
};

const getPriorityName = (priority) => {
  const names = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急',
  };
  return names[priority] || priority;
};

const cancelMaintenanceOrder = async (orderId, reason = '') => {
  const order = await MaintenanceOrder.findById(orderId).populate('vehicle');
  if (!order) {
    throw new AppError('工单不存在', 404);
  }

  if (order.status === 'completed') {
    throw new AppError('已完成的工单不能取消', 400);
  }

  order.status = 'cancelled';
  order.notes = reason ? `${order.notes || ''} 取消原因：${reason}`.trim() : order.notes;
  await order.save();

  const vehicle = order.vehicle;
  if (vehicle) {
    const pendingOrders = await MaintenanceOrder.countDocuments({
      vehicle: vehicle._id,
      status: { $in: ['pending', 'assigned', 'in_progress', 'escalated'] },
      _id: { $ne: orderId },
    });

    if (pendingOrders === 0) {
      vehicle.status = 'available';
      await vehicle.save();
    }
  }

  return order;
};

const updateVehicleMileage = async (vehicleId, mileage) => {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) {
    throw new AppError('车辆不存在', 404);
  }

  if (mileage < vehicle.mileage) {
    throw new AppError('里程数不能小于当前里程', 400);
  }

  vehicle.mileage = mileage;
  await vehicle.save();

  const mileageSinceLast = vehicle.mileage - vehicle.lastMaintenanceMileage;
  const maintenanceDue = mileageSinceLast >= vehicle.maintenanceInterval;

  if (maintenanceDue) {
    await checkAndCreateMaintenanceOrders();
  }

  return {
    vehicle,
    maintenanceDue,
    mileageSinceLast,
    nextMaintenanceAt: vehicle.lastMaintenanceMileage + vehicle.maintenanceInterval,
  };
};

const getVehicleMaintenanceHistory = async (vehicleId) => {
  const orders = await MaintenanceOrder.find({ vehicle: vehicleId })
    .sort({ createdAt: -1 })
    .populate('assignedTechnician', 'name');

  const vehicle = await Vehicle.findById(vehicleId);

  return {
    vehicle: {
      id: vehicle._id,
      plateNumber: vehicle.plateNumber,
      brand: vehicle.brand,
      model: vehicle.model,
      mileage: vehicle.mileage,
      lastMaintenanceMileage: vehicle.lastMaintenanceMileage,
      nextMaintenanceMileage: vehicle.nextMaintenanceMileage,
    },
    orders,
    totalOrders: orders.length,
    totalCost: orders.reduce((sum, o) => sum + (o.cost || 0), 0),
  };
};

module.exports = {
  checkAndCreateMaintenanceOrders,
  createRoutineMaintenance,
  createRepairOrder,
  getMaintenanceOrders,
  getMaintenanceOrderById,
  startMaintenance,
  completeMaintenance,
  checkOverdueOrders,
  escalateOrder,
  cancelMaintenanceOrder,
  updateVehicleMileage,
  getVehicleMaintenanceHistory,
  assignTechnician,
  getOrderTypeName,
  getPriorityName,
  MAINTENANCE_INTERVAL,
  TECHNICIAN_SKILLS,
};
