const router = require('express').Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ members: req.user.id })
      .populate('members', '-password')
      .populate('lastMessage');

    const validChats = chats.filter(chat => {
      return chat.members.every(member => member !== null && member !== undefined);
    });

    const populated = await Promise.all(validChats.map(async (chat) => {
      const chatObj = chat.toObject();
      if (chatObj.isGroup && chatObj.admin) {
        try {
          const adminUser = await User.findById(chatObj.admin).select('name _id');
          chatObj.admin = adminUser;
        } catch (e) {
          chatObj.admin = null;
        }
      }
      return chatObj;
    }));

    res.json(populated);
  } catch (err) {
    console.log('Chat fetch error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post('/create', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const otherUser = await User.findById(userId);
    if (!otherUser) return res.status(404).json({ message: 'User not found' });
    const existing = await Chat.findOne({
      isGroup: false,
      members: { $all: [req.user.id, userId] }
    });
    if (existing) return res.json(existing);
    const chat = await Chat.create({ members: [req.user.id, userId] });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/group', auth, async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const chat = await Chat.create({
      isGroup: true,
      name,
      description: description || '',
      members: [...members, req.user.id],
      admin: req.user.id
    });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:chatId/messages', auth, async (req, res) => {
  try {
    await Message.deleteMany({ chat: req.params.chatId });
    await Chat.findByIdAndUpdate(req.params.chatId, { lastMessage: null });
    res.json({ message: 'Chat cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/message/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not your message' });
    await Message.findByIdAndDelete(req.params.messageId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:chatId', auth, async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.chatId);
    await Message.deleteMany({ chat: req.params.chatId });
    res.json({ message: 'Chat deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:chatId/group', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    const adminId = chat.admin?._id || chat.admin;
    if (adminId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Only admin can update group' });
    const { name, description } = req.body;
    await Chat.findByIdAndUpdate(req.params.chatId, { name, description });
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:chatId/remove-member', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    const adminId = chat.admin?._id || chat.admin;
    if (adminId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Only admin can remove members' });
    await Chat.findByIdAndUpdate(req.params.chatId, {
      $pull: { members: req.body.memberId }
    });
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:chatId/make-admin', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    const adminId = chat.admin?._id || chat.admin;
    if (adminId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Only admin can assign new admin' });
    await Chat.findByIdAndUpdate(req.params.chatId, { admin: req.body.memberId });
    res.json({ message: 'New admin assigned' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:chatId/leave', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    await Chat.findByIdAndUpdate(req.params.chatId, {
      $pull: { members: req.user.id }
    });
    const adminId = chat.admin?._id || chat.admin;
    if (adminId && adminId.toString() === req.user.id) {
      const remaining = chat.members.filter(m => m.toString() !== req.user.id);
      if (remaining.length > 0) {
        await Chat.findByIdAndUpdate(req.params.chatId, { admin: remaining[0] });
      } else {
        await Chat.findByIdAndDelete(req.params.chatId);
      }
    }
    res.json({ message: 'Left group' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;