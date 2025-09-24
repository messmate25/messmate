// File: models/guestOrder.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const GuestOrder = sequelize.define(
    "GuestOrder",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      guestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      order_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.ENUM("ordered", "preparing", "prepared", "served"),
        defaultValue: "ordered",
      },
      estimated_preparation_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "guest_orders",
      timestamps: true,
    }
  );

  GuestOrder.associate = (models) => {
    GuestOrder.hasMany(models.GuestOrderItem, {
      foreignKey: "orderId",
      as: "items",
      onDelete: "CASCADE",
    });
  };

  return GuestOrder;
};
