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

    // Normalize phone numbers - remove spaces, dashes, brackets
    const normalized = phoneNumbers.map(n =>
      n.replace(/[\s\-\(\)\+]/g, '')
    );

    // Find all users except self whose phone matches any contact
    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: normalized.map(n => ({
        phone: { $regex: n.slice(-10), $options: 'i' }
      }))
    }).select('-password');

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;