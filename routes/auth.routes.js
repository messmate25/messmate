// File: routes/auth.routes.js

const express = require('express');
const router = express.Router();

// Import the controller functions
const authController = require('../controllers/auth.controller');

// --- Student/Admin/Super Admin Routes ---
router.post('/register', authController.register);
router.post('/login', authController.login);

// --- Guest Routes ---
router.post('/guest/signup', authController.guestSignup);
router.post('/guest/verify', authController.guestVerifyOTP);

module.exports = router;
