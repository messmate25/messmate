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
      // Updated status flow
      status: {
        type: DataTypes.ENUM(
          "pending_payment",
          "confirmed",
          "preparing",
          "on_the_way",
          "delivered",
          "cancelled"
        ),
        defaultValue: "pending_payment",
      },
      estimated_preparation_time: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Payment fields
      payment_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Razorpay payment ID"
      },
      order_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Razorpay order ID"
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Total amount in INR"
      },
      payment_status: {
        type: DataTypes.ENUM("pending", "captured", "failed", "refunded"),
        defaultValue: "pending"
      }
    },
    {
      tableName: "guest_orders",
      timestamps: true, // Enable timestamps for created_at and updated_at
      createdAt: 'order_date_time', // Rename created_at
      updatedAt: 'updated_at'
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