const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');

router.get('/user/:userId', notificationController.getNotifications);
router.post('/:id/read/:userId', notificationController.markAsRead);
router.post('/read-all/:userId', notificationController.markAllAsRead);
router.get('/unread-count/:userId', notificationController.getUnreadCount);

module.exports = router;
