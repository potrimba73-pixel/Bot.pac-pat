// src/utils/translationSessions.js
const Session = require('../database/sessionModel');

module.exports = {
  async startSession(channelId, staffId, userId, userLang = 'en') {
    await Session.findOneAndUpdate(
      { channelId },
      { staffId, userId, userLang },
      { upsert: true, new: true }
    );
  },

  async getSession(channelId) {
    return await Session.findOne({ channelId });
  },

  async endSession(channelId) {
    await Session.deleteOne({ channelId });
  },

  async isActive(channelId) {
    const session = await Session.findOne({ channelId });
    return !!session;
  }
};
