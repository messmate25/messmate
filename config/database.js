// config/database.js - Alternative approach
const { Sequelize } = require("sequelize");
const { DefaultAzureCredential } = require("@azure/identity");
const tedious = require("tedious");
const { DB_NAME, DB_HOST, AZURE_SQL_SCOPE } = require("./constants");

async function createSequelize() {
  // Get token first
  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken(AZURE_SQL_SCOPE);
  
  const sequelize = new Sequelize(DB_NAME, null, null, {
    dialect: "mssql",
    host: DB_HOST,
    dialectModule: tedious,
    logging: console.log, // Enable for debugging
    dialectOptions: {
      authentication: {
        type: "azure-active-directory-access-token",
        options: {
          token: tokenResponse.token
        }
      },
      options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 60000,
        requestTimeout: 60000,
        cryptoCredentialsDetails: {
          minVersion: 'TLSv1.2'
        }
      }
    },
    pool: {
      max: 5,
      min: 0,
      idle: 30000,
      acquire: 60000,
      evict: 1000
    }
  });

  return sequelize;
}