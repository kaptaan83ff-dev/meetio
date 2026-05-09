// backend/migrate-mongo-config.js
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Fix for Node.js 17+ DNS resolution issues on some Windows setups
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Basic manual .env parsing to avoid dependency on 'dotenv'
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;
    const [key, ...valueParts] = trimmedLine.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

const config = {
  mongodb: {
    url: process.env.MONGODB_URI,
    databaseName: process.env.MONGODB_DB_NAME,
    options: {}
  },
  migrationsDir: "migrations",
  changelogCollectionName: "migrations",
  migrationStrategy: "list",
  shouldExitProcess: true
};

console.log('--- Migration Config Debug ---');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@') : 'MISSING');
console.log('MONGODB_DB_NAME:', process.env.MONGODB_DB_NAME);
console.log('------------------------------');

module.exports = config;
