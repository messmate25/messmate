// File: config/database.js

const { Sequelize } = require("sequelize");
const { DefaultAzureCredential } = require("@azure/identity");
const tedious = require("tedious");
const { DB_NAME, DB_HOST, AZURE_SQL_SCOPE } = require("./constants");
const { use } = require("react");

async function createSequelize() {
  try {
    // Authenticate with Azure Identity
    const credential = new DefaultAzureCredential();

    // Get AAD access token for Azure SQL
    const accessTokenResponse = await credential.getToken(AZURE_SQL_SCOPE);
    const accessToken = accessTokenResponse.token;

    // Create Sequelize instance with tedious (MSSQL)
    const sequelize = new Sequelize(DB_NAME, null, null, {
      dialect: "mssql",
      host: DB_HOST,
      dialectModule: tedious,
      timezone: "+00:00",
      dialectOptions: {
        authentication: {
          type: "azure-active-directory-access-token",
          options: {
            token: accessToken,
          },
        },
        options: {
          encrypt: true, // Required for Azure SQL
          useUTC: true,
        },

      },
      logging: true, // Disable logging; set true for debugging
    });

    return sequelize;
  } catch (error) {
    console.error("❌ Error creating Sequelize instance:", error);
    throw error;
  }
}

module.exports = createSequelize;
