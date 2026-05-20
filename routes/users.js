const router = require('express').Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all users except self
router.put('/update', auth, async (req, res) => {
  try {
    const { name } = req.body;
    await User.findByIdAndUpdate(req.user.id, { name });
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;