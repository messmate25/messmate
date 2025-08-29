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


  // associations can go here if needed
})();

module.exports = {
  get User() { return User; },
  get Guest() { return Guest; },
  get sequelize() { return sequelize; }
};
