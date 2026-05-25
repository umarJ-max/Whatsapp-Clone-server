const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

const onlineUsers = new Map();

async function sendPushNotification(pushToken, title, body) {
  if (!pushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: {},
      }),
    });
  } catch (err) {
    console.log('Push notification error:', err.message);
  }
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      onlineUsers.set(userId, socket.id);
      User.findByIdAndUpdate(userId, { isOnline: true }).exec();
      io.emit('userOnline', userId);
    }

    socket.on('joinChat', (chatId) => {
      socket.join(chatId);
    });

    socket.on('sendMessage', async ({ chatId, senderId, text }) => {
      try {
        const chat = await Chat.findById(chatId).populate('members');

        for (const member of chat.members) {
          const memberId = member._id || member;
          const exists = await User.findById(memberId);
          if (!exists) {
            socket.emit('chatError', { message: 'This person is no longer available' });
            return;
          }
        }

        const message = await Message.create({
          chat: chatId, sender: senderId, text, status: 'sent'
        });
        await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });
        const populated = await message.populate('sender', 'name');
        io.to(chatId).emit('newMessage', populated);

        const sender = await User.findById(senderId);

        chat.members.forEach(async (member) => {
          const memberId = member._id || member;
          if (memberId.toString() !== senderId) {
            if (onlineUsers.has(memberId.toString())) {
              await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
              io.to(chatId).emit('messageStatus', { messageId: message._id, status: 'delivered' });
            } else {
              // Send push notification to offline user
              const recipient = await User.findById(memberId);
              if (recipient?.pushToken) {
                const title = chat.isGroup ? `${chat.name}` : sender.name;
                await sendPushNotification(recipient.pushToken, title, text);
              }
            }
          }
        });
      } catch (err) {
        console.log(err);
      }
    });

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

    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(userId);
        User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }).exec();
        io.emit('userOffline', userId);
      }
    });
  });
};