require('dotenv').config();

const pool = {
  min: 0,
  max: Number(process.env.DB_POOL_MAX || 10),
  acquireTimeoutMillis: Number(process.env.DB_POOL_ACQUIRE_TIMEOUT || 60000),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30000)
};

module.exports = {
  development: {
    client: process.env.DB_CLIENT || 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pos_venda',
      dateStrings: true,
      timezone: '+00:00',
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    },
    pool,
    migrations: {
      directory: './src/database/migrations',
      disableTransactions: true
    },
    seeds: {
      directory: './src/database/seeds'
    }
  },

  production: {
    client: process.env.DB_CLIENT || 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      dateStrings: true,
      timezone: '+00:00',
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    },
    pool,
    migrations: {
      directory: './src/database/migrations',
      disableTransactions: true
    },
    seeds: {
      directory: './src/database/seeds'
    }
  }
};
