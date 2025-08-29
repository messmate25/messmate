// File: server.js

const express = require("express");
require("dotenv").config();

// --- Import DB Factory ---
const createSequelize = require("./config/database");

// --- Import Model Factories ---
const UserModel = require("./models/user.model");
const MenuItemModel = require("./models/menuItem.model");
const WeeklyMenuModel = require("./models/weeklyMenu.model");
const WeeklySelectionModel = require("./models/weeklySelection.model");
const MealHistoryModel = require("./models/mealHistory.model");
const GuestModel = require("./models/guest.model");

// --- Import Services ---
const { startDefaultMenuJob } = require("./services/cron.service");

// --- Import Routes ---
const authRoutes = require("./routes/auth.routes");
const studentRoutes = require("./routes/student.routes");
const adminRoutes = require("./routes/admin.routes");
const guestRoutes = require("./routes/guest.routes");

const app = express();

// --- Middleware ---
app.use(express.json());

const PORT = process.env.PORT || 3000;

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/guest", guestRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("✅ Mess App Backend is running successfully!");
});

// --- Start Server with DB + Models ---
(async () => {
  try {
    const sequelize = await createSequelize();

    // --- Initialize Models ---
    const User = UserModel(sequelize);
    const MenuItem = MenuItemModel(sequelize);
    const WeeklyMenu = WeeklyMenuModel(sequelize);
    const WeeklySelection = WeeklySelectionModel(sequelize);
    const MealHistory = MealHistoryModel(sequelize);
    const Guest = GuestModel(sequelize);

    // --- Define Associations ---
    // Weekly Menu <-> Menu Item
    MenuItem.hasMany(WeeklyMenu, { foreignKey: "menuItemId" });
    WeeklyMenu.belongsTo(MenuItem, { foreignKey: "menuItemId" });

    // Weekly Selection <-> User & Menu Item
    User.hasMany(WeeklySelection, { foreignKey: "userId" });
    WeeklySelection.belongsTo(User, { foreignKey: "userId" });
    MenuItem.hasMany(WeeklySelection, { foreignKey: "menuItemId" });
    WeeklySelection.belongsTo(MenuItem, { foreignKey: "menuItemId" });

    // Meal History <-> User & Guest
    User.hasMany(MealHistory, { foreignKey: "userId" });
    MealHistory.belongsTo(User, { foreignKey: "userId" });
    Guest.hasMany(MealHistory, { foreignKey: "guestId" });
    MealHistory.belongsTo(Guest, { foreignKey: "guestId" });

    // --- Database Connection ---
    await sequelize.authenticate();
    console.log("✅ Database connection established with Azure SQL.");

    // await sequelize.sync({ alter: true }); // Keeps schema updated without dropping data
    console.log("✅ All models synchronized successfully.");

    // --- Start Cron Jobs ---
    // startDefaultMenuJob();
    console.log("🕒 Cron job for default menu assignment scheduled.");

    // --- Start Express Server ---
    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to connect to DB or start server:", error);
    process.exit(1);
  }
})();
