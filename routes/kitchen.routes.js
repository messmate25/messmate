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

// Admin routes
router.post('/', protectedAdminRoute, kitchenController.createKitchen);
router.put('/:kitchenId', protectedAdminRoute, kitchenController.updateKitchen);
router.delete('/:kitchenId', protectedAdminRoute, kitchenController.deleteKitchen);
router.get('/', protectedAdminRoute, kitchenController.getAllKitchens);
router.get('/:kitchenId/stats', protectedAdminRoute, kitchenController.getKitchenStats);
module.exports = router;