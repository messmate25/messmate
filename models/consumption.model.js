
// File: models/mealConsumption.model.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MealConsumption = sequelize.define('MealConsumption', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    menu_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    consumption_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    meal_type: {
      type: DataTypes.ENUM('breakfast', 'lunch', 'dinner'),
      allowNull: false,
    },
    qr_code_scanned_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Reference to the MealHistory record that was scanned'
    }
  }, {
    tableName: 'meal_consumptions',
    timestamps: true,
    indexes: [
      {
        fields: ['userId', 'menu_item_id', 'consumption_date']
      }
    ]
  });

  return MealConsumption;
};