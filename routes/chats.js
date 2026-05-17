const router = require('express').Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

// Get all chats for current user
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ members: req.user.id })
      .populate('members', '-password')
      .populate('lastMessage');
    
    // Filter out chats where any member failed to populate (deleted users)
    const validChats = chats.filter(chat => 
      chat.members.every(member => member !== null)
    );
    
    res.json(validChats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
    });

// Create 1-on-1 chat
router.post('/create', auth, async (req, res) => {
  try {
    const { userId } = req.body;
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

// Create group chat
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

// Get messages for a chat
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;