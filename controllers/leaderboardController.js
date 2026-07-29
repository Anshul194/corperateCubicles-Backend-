import LeaderboardSettings from '../models/LeaderboardSettings.js';
import {
  getLatestSettings,
  updateLeaderboard,
  getGlobalLeaderboard,
  getUserLeaderboard,
  getUserHistory,
  createInitialLeaderboardEntry
} from '../service/leaderboardService.js';

export async function saveLeaderboardSettings(req, res) {
  try {
    const { actionXP, levelRanks } = req.body;
    // Always update the single settings document (upsert)
    let settings = await LeaderboardSettings.findOne();
    if (!settings) {
      settings = await LeaderboardSettings.create({ actionXP, levelRanks });
    } else {
      // Merge/replace actionXP keys
      if (actionXP) {
        for (const [key, value] of Object.entries(actionXP)) {
          settings.actionXP.set(key, value);
        }
      }
      // Replace levelRanks if provided
      if (levelRanks) {
        settings.levelRanks = levelRanks;
      }
      settings.updatedAt = new Date();
      await settings.save();
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getLeaderboardSettings(req, res) {
  try {
    const settings = await getLatestSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function updateLeaderboardEntry(req, res) {
  try {
    const { userId, action, referenceType, referenceId, remark } = req.body;
    const leaderboard = await updateLeaderboard({ userId, action, referenceType, referenceId, remark });
    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getGlobalLeaderboardAPI(req, res) {
  try {
    const leaderboard = await getGlobalLeaderboard();
    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getUserLeaderboardAPI(req, res) {
  try {
    const { userId } = req.params;
    let entry = await getUserLeaderboard(userId);
    
    // If user doesn't exist in leaderboard, create entry with 10 XP
    if (!entry) {
      entry = await createInitialLeaderboardEntry(userId, 10);
    }
    
    res.json({ success: true, entry });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getUserHistoryAPI(req, res) {
  try {
    const { userId } = req.params;
    const history = await getUserHistory(userId);
    res.json({ success: true, history });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}
