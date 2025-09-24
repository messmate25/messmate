// File: routes/guest.routes.js

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const guestController = require('../controllers/guest.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminController = require('../controllers/admin.controller');

// All routes in this file are for logged-in guests.
router.use(authMiddleware);

// GET /api/guest/weekly-menu
router.get('/weekly-menu', guestController.getWeeklyMenu);

// POST /api/guest/order
router.post('/order', guestController.placeOrder);
router.get('/guestOrders/:guestId', guestController.getGuestOrdersById);
router.get('/menu-items', adminController.getMenuItems);

module.exports = router;
