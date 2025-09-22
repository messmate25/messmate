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
      type: DataTypes.DATEONLY,  // YYYY-MM-DD
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
      allowNull: true
    },
    is_valid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    guestId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'meal_history',
    timestamps: true, // Sequelize will manage createdAt & updatedAt
  });

  return MealHistory;
};
