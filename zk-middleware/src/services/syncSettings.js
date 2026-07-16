const pool = require('../config/postgres');

async function getSetting(key) {
  const { rows } = await pool.query('SELECT value FROM sync_settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO sync_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}

module.exports = { getSetting, setSetting };
