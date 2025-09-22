// File: models/mealHistory.model.js
const { DataTypes } = require('sequelize');

// models/mealHistory.model.js
module.exports = (sequelize, DataTypes) => {
  const MealHistory = sequelize.define("MealHistory", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    meal_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    meal_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    menu_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    qr_code_data: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_valid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    scanned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "meal_history",
    timestamps: false, // Auto-adds createdAt and updatedAt
  });

  return MealHistory;
};

