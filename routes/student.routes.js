// File: routes/student.routes.js

const express = require('express');
const router = express.Router();

// Import the controller and middleware
const studentController = require('../controllers/student.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes in this file are protected by the authMiddleware
router.use(authMiddleware);

// GET /api/student/profile
router.get('/profile', studentController.getProfile);

// GET /api/student/weekly-menu
router.get('/weekly-menu', studentController.getWeeklyMenu);

// POST /api/student/weekly-selection/preview
router.post('/weekly-selection/preview', studentController.previewWeeklySelection);

// POST /api/student/weekly-selection
router.post('/weekly-selection', studentController.submitWeeklySelection);

// 👉 NEW: GET /api/student/weekly-selections (Cart View)
router.get('/weekly-selections', studentController.getWeeklySelections);

// GET /api/student/meal-qr
router.get('/meal-qr', studentController.generateMealQR);

// GET /api/student/usage-stats
router.get('/usage-stats', studentController.getUsageStats);


module.exports = router;
