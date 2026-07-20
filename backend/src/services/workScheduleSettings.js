const pool = require('../config/db');

const DEFAULTS = {
  work_start_time: '08:00',
  punch_in_grace_minutes: '15',
  shift_end_time: '17:00',
};

function timeStringToMinutes(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatMinutes(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Reads the configurable work-schedule settings from sync_settings, falling back to
// defaults for any key not yet seeded. Shared by the real-time punch-in/punch-out
// exception checks and the Confirmation Sheet's gap-fill boundary.
async function getWorkScheduleSettings() {
  const { rows } = await pool.query('SELECT key, value FROM sync_settings WHERE key = ANY($1)', [Object.keys(DEFAULTS)]);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const workStartTime = map.work_start_time || DEFAULTS.work_start_time;
  const shiftEndTime = map.shift_end_time || DEFAULTS.shift_end_time;
  const graceMinutes = Number(map.punch_in_grace_minutes ?? DEFAULTS.punch_in_grace_minutes);
  const workStartMinutes = timeStringToMinutes(workStartTime);

  return {
    workStartTime,
    shiftEndTime,
    graceMinutes,
    workStartMinutes,
    shiftEndMinutes: timeStringToMinutes(shiftEndTime),
    latePunchInCutoffMinutes: workStartMinutes + graceMinutes,
  };
}

module.exports = { getWorkScheduleSettings, minutesSinceMidnight, timeStringToMinutes, formatMinutes };
