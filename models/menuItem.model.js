// File: models/menuItem.model.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // This model now represents a complete Thali (e.g., "Rice-Chicken Thali")
  const MenuItem = sequelize.define('MenuItem', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'The name of the Thali'
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Description of the Thali or meal'
    },
    image_url: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      comment: 'Public URL of the meal image (stored in Azure Blob)'
    },
    estimated_prep_time: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15, // Default to 15 minutes
      comment: 'Estimated preparation time in minutes for guest orders'
    },
    monthly_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Default free usage limit per month for students'
    },
    weekly_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Default free usage limit per week for students'
    },
    extra_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Cost for guests, or for students exceeding their limit'
    }
  }, {
    tableName: 'menu_items',
    timestamps: false
  });

  return MenuItem;
};
