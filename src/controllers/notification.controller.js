const notificationService = require('../services/notification.service');

const getNotifications = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await notificationService.getNotifications(userId, req.query);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const notification = await notificationService.markAsRead(id, userId);
    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await notificationService.markAllAsRead(userId);
    res.json({
      success: true,
      modifiedCount: result.nModified || 0,
    });
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const count = await notificationService.getUnreadCount(userId);
    res.json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
