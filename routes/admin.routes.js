// File: routes/admin.routes.js

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const superAdminMiddleware = require('../middleware/superAdmin.middleware');

// Middleware arrays for different levels of access
const protectedAdminRoute = [authMiddleware, adminMiddleware];
const protectedSuperAdminRoute = [authMiddleware, superAdminMiddleware];

// --- Super Admin Routes ---
router.post('/weekly-menu', protectedSuperAdminRoute, adminController.setWeeklyMenu);

// --- Admin & Super Admin Routes ---
router.get('/dashboard', protectedAdminRoute, adminController.getDashboardStats);
router.post('/menu-items', protectedAdminRoute, adminController.addMenuItem);
router.post('/scan-qr', protectedAdminRoute, adminController.scanMealQR);
router.post('/guest/recharge', protectedAdminRoute, adminController.rechargeGuestWallet);
router.get('/users', protectedAdminRoute, adminController.getAllUsers);
router.get('/users/:userId', protectedAdminRoute, adminController.getUserById);
router.delete('/users/:userId', protectedAdminRoute, adminController.deleteUser);

module.exports = router;
