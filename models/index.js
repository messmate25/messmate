// File: models/index.js
const createSequelize = require("../config/database");

const UserModel = require("./user.model");
const MenuItemModel = require("./menuItem.model");
const WeeklyMenuModel = require("./weeklyMenu.model");
const WeeklySelectionModel = require("./weeklySelection.model");
const MealHistoryModel = require("./mealHistory.model");
const GuestModel = require("./guest.model");

let sequelize;
let User, MenuItem, WeeklyMenu, WeeklySelection, MealHistory, Guest;

(async () => {
  sequelize = await createSequelize();

  User = UserModel(sequelize);
  MenuItem = MenuItemModel(sequelize);
  WeeklyMenu = WeeklyMenuModel(sequelize);
  WeeklySelection = WeeklySelectionModel(sequelize);
  MealHistory = MealHistoryModel(sequelize);
  Guest = GuestModel(sequelize);

  // associations can go here if needed
})();

module.exports = {
  get User() { return User; },
  get Guest() { return Guest; },
  get sequelize() { return sequelize; }
};
