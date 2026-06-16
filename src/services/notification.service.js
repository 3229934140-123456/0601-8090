const Notification = require('../models/Notification');
const { sendNotification: socketSend } = require('../config/socket');

const createNotification = async (options) => {
  const {
    recipient,
    recipientType,
    type,
    title,
    content,
    relatedId,
    relatedType,
  } = options;

  const notification = await Notification.create({
    recipient,
    recipientType,
    type,
    title,
    content,
    relatedId,
    relatedType,
  });

  try {
    socketSend(recipient.toString(), type, notification.toObject());
    notification.pushed = true;
    await notification.save();
  } catch (err) {
    console.error('推送通知失败:', err.message);
  }

  return notification;
};

const notifyStudent = async (studentId, type, title, content, relatedId, relatedType) => {
  return createNotification({
    recipient: studentId,
    recipientType: 'student',
    type,
    title,
    content,
    relatedId,
    relatedType,
  });
};

const notifyCoach = async (coachId, type, title, content, relatedId, relatedType) => {
  return createNotification({
    recipient: coachId,
    recipientType: 'coach',
    type,
    title,
    content,
    relatedId,
    relatedType,
  });
};

const notifyAdmin = async (adminId, type, title, content, relatedId, relatedType) => {
  return createNotification({
    recipient: adminId,
    recipientType: 'admin',
    type,
    title,
    content,
    relatedId,
    relatedType,
  });
};

const notifyOperator = async (operatorId, type, title, content, relatedId, relatedType) => {
  return createNotification({
    recipient: operatorId,
    recipientType: 'operator',
    type,
    title,
    content,
    relatedId,
    relatedType,
  });
};

const getNotifications = async (userId, options = {}) => {
  const { page = 1, limit = 20, unreadOnly = false } = options;

  const query = { recipient: userId };
  if (unreadOnly) {
    query.read = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Notification.countDocuments(query);

  return {
    notifications,
    total,
    page,
    limit,
  };
};

const markAsRead = async (notificationId, userId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { read: true, readAt: new Date() },
    { new: true }
  );
};

const markAllAsRead = async (userId) => {
  return Notification.updateMany(
    { recipient: userId, read: false },
    { read: true, readAt: new Date() }
  );
};

const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ recipient: userId, read: false });
};

module.exports = {
  createNotification,
  notifyStudent,
  notifyCoach,
  notifyAdmin,
  notifyOperator,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
