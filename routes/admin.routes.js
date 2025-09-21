// File: routes/admin.routes.js

const express = require("express");
const router = express.Router();
const multer = require("multer");

// Multer setup (store file in memory before uploading to Azure)
const upload = multer({ storage: multer.memoryStorage() });

// Import controllers and middleware
const adminController = require("../controllers/admin.controller");
const authMiddleware = require("../middleware/auth.middleware");
const adminMiddleware = require("../middleware/admin.middleware");
const superAdminMiddleware = require("../middleware/superAdmin.middleware");

// Middleware arrays for different levels of access
const protectedAdminRoute = [authMiddleware, adminMiddleware];
const protectedSuperAdminRoute = [authMiddleware, superAdminMiddleware];

// --- Super Admin Routes ---

// --- Admin & Super Admin Routes ---
router.get("/dashboard", protectedAdminRoute, adminController.getDashboardStats);

// ⬇️ Updated: Added multer middleware to handle image upload
router.post(
  "/menu-items",
  protectedAdminRoute,
  upload.single("image"), // Expecting field "image" in form-data
  adminController.addMenuItem
);
router.get("/weekly-menus", protectedAdminRoute, adminController.getWeeklyMenus);
router.post("/weekly-menu", protectedAdminRoute, adminController.setWeeklyMenu);
router.delete("/weekly-menu/:week_start_date", protectedAdminRoute, adminController.deleteWeeklyMenu);

router.get("/menu-items", protectedAdminRoute, adminController.getMenuItems);
router.post("/scan-qr", protectedAdminRoute, adminController.scanMealQR);
router.post("/guest/recharge", protectedAdminRoute, adminController.rechargeGuestWallet);
router.get("/users", protectedAdminRoute, adminController.getAllUsers);
router.get("/users/:userId", protectedAdminRoute, adminController.getUserById);
router.delete("/users/:userId", protectedAdminRoute, adminController.deleteUser);

module.exports = router;
