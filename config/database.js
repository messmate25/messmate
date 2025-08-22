// File: config/database.js

const { Sequelize } = require('sequelize');
require('dotenv').config(); // This loads the variables from your .env file

// Create a new Sequelize instance to establish the database connection.
// It reads the connection details directly from your .env file for security.
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    logging: false, // Set to console.log to see the raw SQL queries being executed
  }
);

// Export the sequelize instance so it can be used in other parts of the application,
// such as in server.js to sync models and in the model files themselves.
module.exports = sequelize;
