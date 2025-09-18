// File: models/guest.model.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Guest = sequelize.define('Guest', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    mobile_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
      // ⚠️ Note: currently used as email instead of phone
    },
    wallet_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: true
    },
    otp_expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('guests'),
      allowNull: false,
      defaultValue: 'guests'
    },
  }, {
    tableName: 'guests',
    timestamps: true
  });

  return Guest;
};
