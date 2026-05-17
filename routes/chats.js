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

    res.json(validChats);
  } catch (err) {
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
    const { name, members } = req.body;
    const chat = await Chat.create({
      isGroup: true,
      name,
      members: [...members, req.user.id]
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

router.delete('/:chatId', auth, async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.chatId);
    await Message.deleteMany({ chat: req.params.chatId });
    res.json({ message: 'Chat deleted' });
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

module.exports = router;