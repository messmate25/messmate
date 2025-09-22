// File: models/mealHistory.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MealHistory = sequelize.define('MealHistory', {
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
    total_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    qr_code_data: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    scanned_at: {
      type: DataTypes.DATE,
      allowNull: true   // ✅ null until admin scans
    },
    is_valid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true   // ✅ helps invalidate expired/used QR
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }

  }, {
    tableName: 'meal_history',
    timestamps: true,   // ✅ track createdAt, updatedAt
  });

  return MealHistory;
};
