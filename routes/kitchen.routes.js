const express = require('express');
const router = express.Router();

const kitchenController = require('../controllers/kitchen.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// Protected routes
router.use(authMiddleware);

// Student routes
router.get('/available', kitchenController.getAvailableKitchens);
router.post('/select', kitchenController.selectDefaultKitchen);
router.get('/my-kitchen', kitchenController.getMyKitchen);

// Admin routes
router.post('/', adminMiddleware, kitchenController.createKitchen);
router.put('/:kitchenId', adminMiddleware, kitchenController.updateKitchen);
router.delete('/:kitchenId', adminMiddleware, kitchenController.deleteKitchen);
router.get('/', adminMiddleware, kitchenController.getAllKitchens);
router.get('/:kitchenId/stats', adminMiddleware, kitchenController.getKitchenStats);

module.exports = router;