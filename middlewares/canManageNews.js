// Roles permitted to create/update/delete news and upload news media.
// Modeled on middlewares/isAdmin.js. `news_editor` is a dedicated role in
// models/user.js for the news-editing workflow; `admin`/`instructor` are the
// platform's admin tier (matching ADMIN_ROLES in isAdmin.js).
// SECURITY: `student` must never be here.
const NEWS_MANAGER_ROLES = ['admin', 'instructor', 'news_editor'];

const hasNewsManagerRole = (user) => {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
  return roles.some((r) => NEWS_MANAGER_ROLES.includes(r));
};

export const canManageNews = (req, res, next) => {
  if (hasNewsManagerRole(req.user)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: Admin or News Editor role required',
    data: {},
    err: {
      message: 'Unauthorized access',
      userRole: req.user?.role || 'not authenticated',
    },
  });
};
