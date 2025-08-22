// File: models/weeklySelection.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WeeklySelection = sequelize.define('WeeklySelection', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  meal_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  meal_type: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
    allowNull: false
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
}, {
  tableName: 'weekly_selections',
  timestamps: true
});

module.exports = WeeklySelection;
