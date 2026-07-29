import Setting from '../models/setting.js';

// SECURITY: the Setting collection stores secret material (e.g. RAZORPAY_KEY_SECRET,
// read by config/razorpay.js and checkoutController). The unauthenticated /settings
// endpoints must therefore only ever return this explicit ALLOWLIST of public keys.
// The list is derived from what the clients actually read:
//   - frontend  (src/pages/Checkout.jsx):        settings.gstRate, settings.RAZORPAY_KEY_ID
//   - lms_app   (settings_model.dart):           settings.gstRate
// Razorpay's key_id is legitimately public (checkout needs it client-side);
// key_secret and any other *_SECRET/_KEY/password/token values must NEVER be here.
export const PUBLIC_SETTING_KEYS = ['gstRate', 'RAZORPAY_KEY_ID'];

export const getSettings = async (req, res) => {
  try {
    // Validate Content-Type
    if (!req.is('application/json')) {
      return res.status(400).json({ message: "Content-Type must be application/json" });
    }

    const { keys } = req.body;

    // Validate input
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ message: "Keys must be a non-empty array" });
    }

    //console.log("Requested keys:", keys); // Debug log

    // SECURITY: anonymous callers may only read allowlisted public keys.
    // Non-public keys resolve to null (same shape as "key not found") so we
    // neither leak values nor confirm a secret key's existence.
    const allowedKeys = keys.filter((key) => PUBLIC_SETTING_KEYS.includes(key));

    // Fetch settings for the allowed keys only
    const settings = await Setting.find({ key: { $in: allowedKeys } }).select('key value description');

    // Create a response object mapping keys to values
    const result = {};
    keys.forEach(key => {
      const setting = settings.find(s => s.key === key);
      result[key] = setting ? setting.value : null; // Return null if key not found or not public
    });

    return res.status(200).json({
      message: "Settings retrieved successfully",
      settings: result
    });
  } catch (err) {
    console.error("Get Settings Error:", err);
    return res.status(500).json({ message: "Failed to retrieve settings", error: err.message });
  }
};


export const getAllSettings = async (req, res) => {
  try {
    // SECURITY: this is the unauthenticated endpoint the student frontend and
    // mobile app call at startup/checkout — only public allowlisted keys are returned.
    const settings = await Setting.find({ key: { $in: PUBLIC_SETTING_KEYS } }).select('key value description');

    // Create a response object mapping keys to values
    const result = {};
    settings.forEach(setting => {
      result[setting.key] = setting.value;
    });

    return res.status(200).json({
      message: "All settings retrieved successfully",
      settings: result
    });
  } catch (err) {
    console.error("Get All Settings Error:", err);
    return res.status(500).json({ message: "Failed to retrieve all settings", error: err.message });
  }
};

// Admin-only: full, unfiltered settings (including secret material).
// Route must be guarded by accessTokenAutoRefresh + passport jwt + isAdmin.
export const getAllSettingsAdmin = async (req, res) => {
  try {
    const settings = await Setting.find().select('key value description');

    const result = {};
    settings.forEach(setting => {
      result[setting.key] = setting.value;
    });

    return res.status(200).json({
      message: "All settings retrieved successfully",
      settings: result
    });
  } catch (err) {
    console.error("Get All Settings (admin) Error:", err);
    return res.status(500).json({ message: "Failed to retrieve all settings", error: err.message });
  }
};