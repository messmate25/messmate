// File: models/index.js
const createSequelize = require("../config/database");
const UserModel = require("./user.model");
const MenuItemModel = require("./menuItem.model");
const WeeklyMenuModel = require("./weeklyMenu.model");
const WeeklySelectionModel = require("./weeklySelection.model");
const MealHistoryModel = require("./mealHistory.model");
const GuestModel = require("./guest.model");
const GuestOrderItemModel = require("./guestOrderItem.model");
const GuestOrderModel = require("./guestOrder.model");
const TransactionModel = require("./transaction.model");   // ✅

async function initModels() {
  const sequelize = await createSequelize();

  const User = UserModel(sequelize);
  const MenuItem = MenuItemModel(sequelize);
  const WeeklyMenu = WeeklyMenuModel(sequelize);
  const WeeklySelection = WeeklySelectionModel(sequelize);
  const MealHistory = MealHistoryModel(sequelize);
  const Guest = GuestModel(sequelize);
  const GuestOrderItem = GuestOrderItemModel(sequelize);
  const GuestOrder = GuestOrderModel(sequelize);
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
  GuestOrderItem.belongsTo(MenuItem, { foreignKey: "menu_item_id", as: "menuItem" });
  MenuItem.hasMany(GuestOrderItem, { foreignKey: "menu_item_id", as: "orderItems" });
  GuestOrder.hasMany(GuestOrderItem, { foreignKey: "orderId", as: "items" });
  GuestOrderItem.belongsTo(GuestOrder, { foreignKey: "orderId", as: "order" });
  Guest.hasMany(GuestOrder, { foreignKey: "guestId", as: "orders" });
  GuestOrder.belongsTo(Guest, { foreignKey: "guestId", as: "guest" });
  // User <-> Transaction
  User.hasMany(Transaction, { foreignKey: "userId" });
  Transaction.belongsTo(User, { foreignKey: "userId" });

  return {
    sequelize,
    User, Guest,
    MenuItem, WeeklyMenu, WeeklySelection, GuestOrder,        // ✅ returning new model
    GuestOrderItem,   
    MealHistory, Transaction   // ✅ include new model
  };
}

module.exports = initModels;
