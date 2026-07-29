import User from '../models/user.js';
import sendEmail from '../utils/sendEmail.js';
// import sendSMS from '../utils/sendSMS.js'; // optional

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Maximum failed verify attempts before the OTP is invalidated and a new send is required
const MAX_OTP_ATTEMPTS = 5;


// SEND OTP
export const sendOtp = async (req, res) => {
  try {
    const { email, phone, type } = req.body;

    if (!type || (type !== 'email' && type !== 'mobile')) {
      return res.status(400).json({ success: false, message: "Type must be 'email' or 'mobile'" });
    }

    const identifier = type === 'email' ? email : phone;
    if (!identifier) {
      return res.status(400).json({ success: false, message: `${type} is required` });
    }

    // Reject non-string identifiers to prevent NoSQL operator injection (e.g. { "$ne": null })
    if (typeof identifier !== 'string') {
      return res.status(400).json({ success: false, message: `Invalid ${type}` });
    }

    // SECURITY: identical response whether or not the account exists, so this
    // endpoint cannot be used as a user-enumeration oracle (it previously
    // returned 404 'User not found' for unknown identifiers). An OTP is still
    // only generated and sent for real accounts.
    const GENERIC_OTP_RESPONSE = { success: true, message: 'If an account exists, an OTP has been sent.' };

    const filter = type === 'email' ? { email: String(email) } : { phone: String(phone) };
    const user = await User.findOne(filter);
    if (!user) return res.status(200).json(GENERIC_OTP_RESPONSE);

    const otp = generateOtp();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0;
    await user.save();

    if (type === 'email') {
      await sendEmail(email, `Your OTP is ${otp}`, 'OTP Verification');
    } else {
      // await sendSMS(phone, `Your OTP is ${otp}`);
    }

    return res.status(200).json(GENERIC_OTP_RESPONSE);
  } catch (err) {
    console.error('❌ sendOtp Error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    if (!otp || (!email && !phone)) {
      return res.status(400).json({ success: false, message: "OTP and email or phone are required" });
    }

    // Reject non-string identifiers/OTP to prevent NoSQL operator injection (e.g. { "$ne": null })
    if (typeof otp !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const identifier = email !== undefined && email !== '' ? email : phone;
    if (typeof identifier !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid email or phone' });
    }

    const filter = email ? { email: String(email) } : { phone: String(phone) };
    const user = await User.findOne(filter);
    if (!user) {
      // SECURITY: same status + message as a wrong OTP for a real account, so a
      // verify attempt cannot be used to probe whether an identifier is registered
      // (it previously returned 404 'User not found').
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (user.otp !== otp || user.otpExpiry < Date.now()) {
      // Count this failed attempt; invalidate the OTP once the cap is reached.
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
        user.otp = null;
        user.otpExpiry = null;
        user.otpAttempts = 0;
        await user.save();
        return res.status(429).json({ success: false, message: 'Too many invalid attempts. Please request a new OTP.' });
      }
      await user.save();
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Mark verified
    if (email) user.emailVerified = true;
    if (phone) user.mobileVerified = true;

    // Clear OTP fields
    user.otp = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    await user.save();

    return res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('❌ verifyOtp Error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
