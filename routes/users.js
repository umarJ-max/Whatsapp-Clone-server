const router = require('express').Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/update', auth, async (req, res) => {
  try {
    const { name } = req.body;
    await User.findByIdAndUpdate(req.user.id, { name });
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/push-token', auth, async (req, res) => {
  try {
    const { token } = req.body;
    await User.findByIdAndUpdate(req.user.id, { pushToken: token });
    res.json({ message: 'Token saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/match-contacts', auth, async (req, res) => {
  try {
    const { phoneNumbers } = req.body;
    if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
      return res.status(400).json({ message: 'Phone numbers required' });
    }

    // Extract last 10 digits from each number for matching
    const normalized = phoneNumbers
      .map(n => n.replace(/[\s\-\(\)\+]/g, ''))
      .filter(n => n.length >= 7)
      .map(n => n.slice(-10));

    if (normalized.length === 0) return res.json([]);

    const users = await User.find({
      _id: { $ne: req.user.id }
    }).select('-password');

    // Match by last 10 digits
    const matched = users.filter(user => {
      const userLast10 = user.phone.replace(/[\s\-\(\)\+]/g, '').slice(-10);
      return normalized.includes(userLast10);
    });

    res.json(matched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;