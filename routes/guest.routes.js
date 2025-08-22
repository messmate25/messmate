// File: routes/guest.routes.js

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const guestController = require('../controllers/guest.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes in this file are for logged-in guests.
router.use(authMiddleware);

// GET /api/guest/weekly-menu
router.get('/weekly-menu', guestController.getWeeklyMenu);

// POST /api/guest/order
router.post('/order', guestController.placeOrder);

module.exports = router;
