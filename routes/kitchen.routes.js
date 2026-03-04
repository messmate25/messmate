const express = require('express');
const router = express.Router();

const kitchenController = require('../controllers/kitchen.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const protectedAdminRoute = [authMiddleware, adminMiddleware];

// Protected routes
router.use(authMiddleware);

// Student routes
router.get('/available', kitchenController.getAvailableKitchens);
router.post('/select', kitchenController.selectDefaultKitchen);
router.get('/my-kitchen', kitchenController.getMyKitchen);


// NEW: Get kitchen weekly menu
router.get('/:kitchenId/weekly-menu', kitchenController.getKitchenWeeklyMenu);

// Admin routes
router.post('/', protectedAdminRoute, kitchenController.createKitchen);
router.put('/:kitchenId', protectedAdminRoute, kitchenController.updateKitchen);
router.delete('/:kitchenId', protectedAdminRoute, kitchenController.deleteKitchen);
router.get('/', protectedAdminRoute, kitchenController.getAllKitchens);
router.get('/:kitchenId/stats', protectedAdminRoute, kitchenController.getKitchenStats);


router.get('/:kitchenId/weekly-menus', protectedAdminRoute, kitchenController.getAllKitchenWeeklyMenus);
module.exports = router;