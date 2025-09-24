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
        type: DataTypes.DATEONLY,
        allowNull: false,

      },
      status: {
        type: DataTypes.ENUM("ordered", "preparing", "prepared", "served"),
        defaultValue: "ordered",
      },
      estimated_preparation_time: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

    },
    {
      tableName: "guest_orders",
      timestamps: false,
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
