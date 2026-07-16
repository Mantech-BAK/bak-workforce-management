const cron = require('node-cron');

const pool = require('../config/db');
const { distanceMeters } = require('../services/geo');

const GPS_STALE_MINUTES = 15;
const MISSED_PUNCH_OUT_HOURS = 14;

async function hasOpenException(type, attendanceId) {
  const { rows } = await pool.query(
    `SELECT id FROM exceptions WHERE type = $1 AND ref_table = 'attendance' AND ref_id = $2 AND status = 'open'`,
    [type, attendanceId]
  );
  return !!rows[0];
}

async function createException(type, empId, attendanceId, details) {
  await pool.query(
    `INSERT INTO exceptions (type, emp_id, ref_table, ref_id, details) VALUES ($1, $2, 'attendance', $3, $4)`,
    [type, empId, attendanceId, details]
  );
}

async function checkRow(row) {
  const { id, emp_id, punch_in_time, last_lat, last_lng, last_reported_at, center_lat, center_lng, radius_m } = row;

  const hoursOpen = (Date.now() - new Date(punch_in_time).getTime()) / 3600000;
  if (hoursOpen >= MISSED_PUNCH_OUT_HOURS && !(await hasOpenException('missed_punch_out', id))) {
    await createException(
      'missed_punch_out',
      emp_id,
      id,
      `Still clocked in ${hoursOpen.toFixed(1)}h after punch-in at ${new Date(punch_in_time).toISOString()}`
    );
  }

  const staleMinutes = last_reported_at
    ? (Date.now() - new Date(last_reported_at).getTime()) / 60000
    : (Date.now() - new Date(punch_in_time).getTime()) / 60000;

  if (staleMinutes >= GPS_STALE_MINUTES) {
    if (!(await hasOpenException('gps_disabled', id))) {
      const lastSeen = last_reported_at ? new Date(last_reported_at).toISOString() : 'never (no ping since punch-in)';
      await createException(
        'gps_disabled',
        emp_id,
        id,
        `No location update in ${staleMinutes.toFixed(0)}min (last reported: ${lastSeen})`
      );
    }
    return;
  }

  if (center_lat == null || center_lng == null || last_lat == null || last_lng == null) {
    return;
  }

  const radius = radius_m || 100;
  const distance = distanceMeters(last_lat, last_lng, center_lat, center_lng);
  if (distance > radius && !(await hasOpenException('geofence_violation', id))) {
    await createException('geofence_violation', emp_id, id, `distance=${distance.toFixed(0)}m (radius=${radius}m)`);
  }
}

async function runCheck() {
  const { rows } = await pool.query(`
    SELECT a.id, a.emp_id, a.punch_in_time, a.last_lat, a.last_lng, a.last_reported_at,
           g.center_lat, g.center_lng, g.radius_m
    FROM attendance a
    LEFT JOIN geofences g ON g.id = a.geofence_id
    WHERE a.punch_out_time IS NULL
  `);

  for (const row of rows) {
    try {
      await checkRow(row);
    } catch (err) {
      console.error(`geofenceMonitor: failed to check attendance ${row.id}`, err);
    }
  }
}

function start() {
  cron.schedule('*/2 * * * *', () => {
    runCheck().catch((err) => console.error('geofenceMonitor: run failed', err));
  });
}

module.exports = { start, runCheck };
