// backend/migrations/config.js
require('dotenv').config({ path: '../.env' });

const config = {
  mongodb: {
    url: process.env.MONGODB_URI,
    databaseName: process.env.MONGODB_DB_NAME,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  migrationsDir: "migrations",
  changelogCollectionName: "migrations",
  migrationStrategy: "list",
  shouldExitProcess: true
};

module.exports = config;
