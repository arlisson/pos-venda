const knex = require('knex');

const usarLoadInfile = process.env.LEAD_IMPORT_USE_LOAD_INFILE === 'true';

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_venda',
    port: process.env.DB_PORT || 3306,
    dateStrings: true,
    timezone: '+00:00',
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ...(usarLoadInfile ? { flags: ['LOCAL_FILES'] } : {})
  },
  pool: {
    min: 0,
    max: Number(process.env.DB_POOL_MAX || 10),
    acquireTimeoutMillis: Number(process.env.DB_POOL_ACQUIRE_TIMEOUT || 60000),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30000)
  }
});

module.exports = db;
