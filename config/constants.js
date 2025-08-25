// File: config/constants.js

require('dotenv').config();

module.exports = {
  DB_NAME: 'messmateDB',
  DB_HOST: 'mess-mate.database.windows.net',
//   DB_USER: process.env.DB_USER,
//   DB_PASSWORD: process.env.DB_PASSWORD,
//   DB_DIALECT: process.env.DB_DIALECT || 'mssql',

  // Azure SQL
  AZURE_SQL_SCOPE: "https://database.windows.net/.default",

  // Server
  PORT: process.env.PORT || 3000,
};
