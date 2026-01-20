// config/database.js
const { Sequelize } = require("sequelize");
const { DefaultAzureCredential } = require("@azure/identity");
const tedious = require("tedious");
const { DB_NAME, DB_HOST, AZURE_SQL_SCOPE } = require("./constants");

const credential = new DefaultAzureCredential();

async function createSequelize() {

  const sequelize = new Sequelize(DB_NAME, null, null, {
    dialect: "mssql",
    host: DB_HOST,
    dialectModule: tedious,
    logging: false,

    dialectOptions: {
      options: {
        encrypt: true,
      },
    },

    pool: {
      max: 5,
      min: 0,
      idle: 10000,
      acquire: 30000,
    },

    hooks: {
      beforeConnect: async (config) => {
        const token = await credential.getToken(AZURE_SQL_SCOPE);

        config.authentication = {
          type: "azure-active-directory-access-token",
          options: {
            token: token.token,
          },
        };
      },
    },
  });

  return sequelize;
}

module.exports = createSequelize;
