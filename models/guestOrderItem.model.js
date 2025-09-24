// File: models/guestOrderItem.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const GuestOrderItem = sequelize.define(
    "GuestOrderItem",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      menu_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      tableName: "guest_order_items",
    }
  );

  GuestOrderItem.associate = (models) => {
    GuestOrderItem.belongsTo(models.GuestOrder, {
      foreignKey: "orderId",
      as: "order",
    });
  };

  return GuestOrderItem;
};
