// src/database/sessionModel.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  staffId: { type: String, required: true },
  userId: { type: String, required: true },
  userLang: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TranslationSession', sessionSchema);
