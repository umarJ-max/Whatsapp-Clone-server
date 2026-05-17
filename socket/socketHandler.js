const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      onlineUsers.set(userId, socket.id);
      User.findByIdAndUpdate(userId, { isOnline: true }).exec();
      io.emit('userOnline', userId);
    }

    // Join chat room
    socket.on('joinChat', (chatId) => {
      socket.join(chatId);
    });

    // Send message
    socket.on('sendMessage', async ({ chatId, senderId, text }) => {
      try {
        const message = await Message.create({
          chat: chatId, sender: senderId, text, status: 'sent'
        });
        await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });
        const populated = await message.populate('sender', 'name');

        io.to(chatId).emit('newMessage', populated);

        // Mark delivered if recipient is online
        const chat = await Chat.findById(chatId);
        chat.members.forEach(async (memberId) => {
          if (memberId.toString() !== senderId && onlineUsers.has(memberId.toString())) {
            await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
            io.to(chatId).emit('messageStatus', { messageId: message._id, status: 'delivered' });
          }
        });
      } catch (err) {
        console.log(err);
      }
    });

    // Mark messages as read
    socket.on('markRead', async ({ chatId, userId }) => {
      try {
        await Message.updateMany(
          { chat: chatId, sender: { $ne: userId }, status: { $ne: 'read' } },
          { status: 'read' }
        );
        io.to(chatId).emit('messagesRead', { chatId, userId });
      } catch (err) {
        console.log(err);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(userId);
        User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }).exec();
        io.emit('userOffline', userId);
      }
    });
  });
};