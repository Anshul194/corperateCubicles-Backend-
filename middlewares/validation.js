

export const validateResetPassword = (req, res, next) => {
  const { token, newPassword, confirmPassword } = req.body;

  // Check if all required fields are present
  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Token, new password, and confirm password are required",
      data: {},
      err: { message: "Missing required fields" }
    });
  }

  // Check if passwords match
  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "New password and confirm password do not match",
      data: {},
      err: { message: "Password mismatch" }
    });
  }

  // Check password length
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long",
      data: {},
      err: { message: "Password too short" }
    });
  }

  // Check password strength (at least one uppercase, one lowercase, one number)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      data: {},
      err: { message: "Password not strong enough" }
    });
  }

  // Check for common weak passwords
  const commonPasswords = ['password', '123456', 'password123', 'admin', 'qwerty'];
  if (commonPasswords.includes(newPassword.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: "Please choose a stronger password",
      data: {},
      err: { message: "Common password detected" }
    });
  }

  // Validate token format (should be 64 characters hex)
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({
      success: false,
      message: "Invalid token format",
      data: {},
      err: { message: "Malformed token" }
    });
  }

  next();
};

// Additional validation middleware for change password
export const validateChangePassword = (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Old password, new password, and confirm password are required",
      data: {},
      err: { message: "Missing required fields" }
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "New password and confirm password do not match",
      data: {},
      err: { message: "Password mismatch" }
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters long",
      data: {},
      err: { message: "Password too short" }
    });
  }

  if (oldPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password must be different from current password",
      data: {},
      err: { message: "Same password" }
    });
  }

  next();
};

// Validation for forgot password
export const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
      data: {},
      err: { message: "Missing email field" }
    });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address",
      data: {},
      err: { message: "Invalid email format" }
    });
  }

  next();
};