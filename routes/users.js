const router = require('express').Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all users except self
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;