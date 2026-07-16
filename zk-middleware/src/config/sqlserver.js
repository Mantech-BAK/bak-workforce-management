const sql = require('mssql');

const config = {
  server: process.env.ZK_SQL_SERVER,
  database: process.env.ZK_SQL_DATABASE,
  user: process.env.ZK_SQL_USER,
  password: process.env.ZK_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

module.exports = { getPool, sql };
