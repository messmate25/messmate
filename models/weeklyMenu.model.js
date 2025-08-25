// File: models/weeklyMenu.model.js

const { DataTypes } = require('sequelize');
// const sequelize = require('../config/database');

module.exports = (sequelize) => {
  const weeklyMenu = sequelize.define('weeklyMenu', {
    id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  week_start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    unique: 'weekly_menu_unique_constraint'
  },
  day_of_week: {
    type: DataTypes.ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
    allowNull: false,
    unique: 'weekly_menu_unique_constraint'
  },
  meal_type: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
    allowNull: false,
    unique: 'weekly_menu_unique_constraint'
  }
}, {
  tableName: 'weekly_menus',
  timestamps: true,
  uniqueKeys: {
    weekly_menu_unique_constraint: {
      fields: ['week_start_date', 'day_of_week', 'meal_type', 'menuItemId']
    }
  }
});

return weeklyMenu; 
}