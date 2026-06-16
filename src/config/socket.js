const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('客户端连接:', socket.id);

    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`用户 ${userId} 加入房间`);
    });

    socket.on('disconnect', () => {
      console.log('客户端断开:', socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io 未初始化');
  }
  return io;
};

const sendNotification = (userId, type, data) => {
  if (!io) return;
  io.to(userId).emit('notification', {
    type,
    data,
    timestamp: new Date(),
  });
};

const broadcastNotification = (type, data) => {
  if (!io) return;
  io.emit('notification', {
    type,
    data,
    timestamp: new Date(),
  });
};

module.exports = {
  initSocket,
  getIO,
  sendNotification,
  broadcastNotification,
};
