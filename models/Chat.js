const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  isGroup: { type: Boolean, default: false },
  name: { type: String, default: '' },
  description: { type: String, default: '' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  clearedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clearedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);