const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Kitchen = sequelize.define('Kitchen', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'kitchens',
    timestamps: true
  });

  return Kitchen;
};