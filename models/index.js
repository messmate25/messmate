// File: models/index.js
const createSequelize = require("../config/database");
const UserModel = require("./user.model");
const MenuItemModel = require("./menuItem.model");
const WeeklyMenuModel = require("./weeklyMenu.model");
const WeeklySelectionModel = require("./weeklySelection.model");
const MealHistoryModel = require("./mealHistory.model");
const GuestModel = require("./guest.model");

async function initModels() {
  const sequelize = await createSequelize();

  const User = UserModel(sequelize);
  const MenuItem = MenuItemModel(sequelize);
  const WeeklyMenu = WeeklyMenuModel(sequelize);
  const WeeklySelection = WeeklySelectionModel(sequelize);
  const MealHistory = MealHistoryModel(sequelize);
  const Guest = GuestModel(sequelize);

  // Associations
  MenuItem.hasMany(WeeklyMenu, { foreignKey: "menuItemId" });
  WeeklyMenu.belongsTo(MenuItem, { foreignKey: "menuItemId" });

  User.hasMany(WeeklySelection, { foreignKey: "userId" });
  WeeklySelection.belongsTo(User, { foreignKey: "userId" });
  MenuItem.hasMany(WeeklySelection, { foreignKey: "menuItemId" });
  WeeklySelection.belongsTo(MenuItem, { foreignKey: "menuItemId" });

  User.hasMany(MealHistory, { foreignKey: "userId" });
  MealHistory.belongsTo(User, { foreignKey: "userId" });
  Guest.hasMany(MealHistory, { foreignKey: "guestId" });
  MealHistory.belongsTo(Guest, { foreignKey: "guestId" });

  return { sequelize, User, Guest };
}

module.exports = initModels;
