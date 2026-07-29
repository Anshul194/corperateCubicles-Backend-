export default function isUserBanned(req, res, next) {
  if (req.user?.isBanned) {
    return res.status(403).json({
      success: false,
      isBanned:true,
      message: req.user.banReason
        ? `You are blocked due to: ${req.user.banReason}`
        : "You are blocked from accessing this platform.",
      err: { message: "User is banned" }
    });
  }
  next();
}
