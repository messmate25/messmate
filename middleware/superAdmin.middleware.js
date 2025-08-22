// File: middleware/superAdmin.middleware.js

const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Super Admin privileges required.' });
  }
};

module.exports = isSuperAdmin;