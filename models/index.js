// File: models/index.js
const createSequelize = require("../config/database");
const UserModel = require("./user.model");
const MenuItemModel = require("./menuItem.model");
const WeeklyMenuModel = require("./weeklyMenu.model");
const WeeklySelectionModel = require("./weeklySelection.model");
const MealHistoryModel = require("./mealHistory.model");
const GuestModel = require("./guest.model");
const TransactionModel = require("./transaction.model");   // ✅

async function initModels() {
  const sequelize = await createSequelize();

  const User = UserModel(sequelize);
  const MenuItem = MenuItemModel(sequelize);
  const WeeklyMenu = WeeklyMenuModel(sequelize);
  const WeeklySelection = WeeklySelectionModel(sequelize);
  const MealHistory = MealHistoryModel(sequelize);
  const Guest = GuestModel(sequelize);
  const Transaction = TransactionModel(sequelize);   // ✅

  // --- Associations ---

  // Menu <-> WeeklyMenu
  MenuItem.hasMany(WeeklyMenu, { foreignKey: "menuItemId" });
  WeeklyMenu.belongsTo(MenuItem, { foreignKey: "menuItemId" });

  // User <-> WeeklySelection
  User.hasMany(WeeklySelection, { foreignKey: "userId" });
  WeeklySelection.belongsTo(User, { foreignKey: "userId" });
  MenuItem.hasMany(WeeklySelection, { foreignKey: "menuItemId" });
  WeeklySelection.belongsTo(MenuItem, { foreignKey: "menuItemId" });

  // User/Guest <-> MealHistory
  User.hasMany(MealHistory, { foreignKey: "userId" });
  Guest.hasMany(MealHistory, { foreignKey: "guestId" });

  // WeeklySelection <-> MealHistory (link scanned QR back to selection)
  WeeklySelection.hasMany(MealHistory, { foreignKey: "weekly_selection_id" });

  // User <-> Transaction
  User.hasMany(Transaction, { foreignKey: "userId" });
  Transaction.belongsTo(User, { foreignKey: "userId" });

  return { 
    sequelize, 
    User, Guest, 
    MenuItem, WeeklyMenu, WeeklySelection, 
    MealHistory, Transaction   // ✅ include new model
  };
}

module.exports = initModels;
