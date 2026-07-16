const pool = require('../config/postgres');
const { getPool, sql } = require('../config/sqlserver');
const { getSetting, setSetting } = require('../services/syncSettings');

const WATERMARK_KEY = 'zk_attendance_last_synced';

async function getKnownCprs() {
  const { rows } = await pool.query('SELECT cpr FROM employees WHERE cpr IS NOT NULL');
  return rows.map((r) => r.cpr);
}

async function fetchZkTransactions(cprs, since) {
  if (cprs.length === 0) return [];

  const sqlPool = await getPool();
  const request = sqlPool.request();
  const placeholders = cprs.map((cpr, i) => {
    const paramName = `cpr${i}`;
    request.input(paramName, sql.VarChar, cpr);
    return `@${paramName}`;
  });
  request.input('since', sql.DateTime, since);

  const result = await request.query(`
    SELECT emp_code, punch_time, punch_state, verify_type, latitude, longitude, terminal_alias
    FROM iclock_transaction
    WHERE emp_code IN (${placeholders.join(', ')}) AND punch_time > @since
    ORDER BY punch_time ASC
  `);

  return result.recordset;
}

async function insertAttendanceRow(row) {
  const { emp_code: empCode, punch_time: punchTime, punch_state: punchState, verify_type: verifyType, latitude, longitude, terminal_alias: terminalAlias } = row;

  if (!empCode || !punchTime) {
    throw new Error('missing emp_code or punch_time');
  }

  await pool.query(
    `INSERT INTO zk_attendance_history (cpr, punch_time, punch_state, verify_type, latitude, longitude, terminal_alias)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [empCode, punchTime, punchState || null, verifyType ?? null, latitude ?? null, longitude ?? null, terminalAlias || null]
  );
}

async function syncAttendance() {
  const summary = { checked: 0, fetched: 0, inserted: 0, skipped: 0 };

  const cprs = await getKnownCprs();
  summary.checked = cprs.length;

  const lastSyncedRaw = await getSetting(WATERMARK_KEY);
  const since = lastSyncedRaw ? new Date(lastSyncedRaw) : new Date(Date.now() - 24 * 3600 * 1000);

  let rows;
  try {
    rows = await fetchZkTransactions(cprs, since);
  } catch (err) {
    console.error('syncAttendance: failed to query ZK SQL Server', err.message);
    return summary;
  }

  summary.fetched = rows.length;

  let maxPunchTime = since;
  for (const row of rows) {
    try {
      await insertAttendanceRow(row);
      summary.inserted += 1;
      if (row.punch_time && new Date(row.punch_time) > maxPunchTime) {
        maxPunchTime = new Date(row.punch_time);
      }
    } catch (err) {
      console.error(`syncAttendance: skipping malformed row (emp_code=${row?.emp_code}, punch_time=${row?.punch_time})`, err.message);
      summary.skipped += 1;
    }
  }

  if (maxPunchTime > since) {
    await setSetting(WATERMARK_KEY, maxPunchTime.toISOString());
  }

  return summary;
}

module.exports = { syncAttendance };
