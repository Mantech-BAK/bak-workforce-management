const pool = require('../config/db');

const REPORT_COLUMNS = [
  '#',
  'EMP ID',
  'CPR',
  'EMPLOYEE NAME',
  'DESIGNATION',
  'COST CENTER',
  'ATTENDANCE DATE',
  'START DATE',
  'START TIME',
  'END TIME',
  'END DATE',
  'T. WORKING H.',
  'JOB',
  'PROJECT NAME',
  'REMARKS',
  'OT ELIGIBLE',
  'OT',
  'APPROVAL REQUIRED',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(d) {
  if (!d) return '';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function formatTime(d) {
  if (!d) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Normalizes a plain 'YYYY-MM-DD' string into the exclusive end-of-day boundary
// (start of the next day) so date-range filters are inclusive of the given day.
// Uses local calendar arithmetic throughout (no UTC conversion) since punch
// timestamps are stored and displayed as naive local wall-clock values.
function toExclusiveEndBoundary(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

function todayLocalDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function queryAttendance({ empId, siteId, dateFrom, dateTo } = {}) {
  const conditions = [];
  const values = [];
  let i = 1;

  if (empId) {
    conditions.push(`a.emp_id = $${i}`);
    values.push(empId);
    i += 1;
  }
  if (siteId) {
    conditions.push(`a.geofence_id = $${i}`);
    values.push(siteId);
    i += 1;
  }
  if (dateFrom) {
    conditions.push(`a.punch_in_time >= $${i}`);
    values.push(dateFrom);
    i += 1;
  }
  if (dateTo) {
    conditions.push(`a.punch_in_time < $${i}`);
    values.push(dateTo);
    i += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
       e.emp_id,
       e.cpr,
       e.name AS employee_name,
       e.designation,
       e.cost_center,
       e.ot_eligible,
       a.punch_in_time,
       a.punch_out_time,
       a.remarks,
       a.ot_hours,
       p.project_company_name AS job,
       p.project_name,
       tier.approver_name AS ot_approver_name
     FROM attendance a
     JOIN employees e ON e.emp_id = a.emp_id
     LEFT JOIN projects p ON p.project_code = a.job_project_code
     LEFT JOIN LATERAL (
       SELECT approver_name
       FROM ot_approval_tiers t
       WHERE t.min_ot_hours <= a.ot_hours
         AND (t.cost_center = e.cost_center OR t.cost_center IS NULL)
       ORDER BY (t.cost_center IS NOT NULL) DESC, t.min_ot_hours DESC
       LIMIT 1
     ) tier ON true
     ${where}
     ORDER BY a.punch_in_time`,
    values
  );

  return rows;
}

function shapeRows(rawRows) {
  return rawRows.map((r, idx) => {
    const start = r.punch_in_time ? new Date(r.punch_in_time) : null;
    const end = r.punch_out_time ? new Date(r.punch_out_time) : null;
    const workingHours = start && end ? (end - start) / 3600000 : null;

    return {
      '#': idx + 1,
      'EMP ID': r.emp_id || '',
      CPR: r.cpr || '',
      'EMPLOYEE NAME': r.employee_name || '',
      DESIGNATION: r.designation || '',
      'COST CENTER': r.cost_center || '',
      'ATTENDANCE DATE': formatDate(start),
      'START DATE': formatDate(start),
      'START TIME': formatTime(start),
      'END TIME': formatTime(end),
      'END DATE': formatDate(end),
      'T. WORKING H.': workingHours !== null ? workingHours.toFixed(2) : '',
      JOB: r.job || '',
      'PROJECT NAME': r.project_name || '',
      REMARKS: r.remarks || '',
      'OT ELIGIBLE': r.ot_eligible || '',
      OT: r.ot_hours || 0,
      'APPROVAL REQUIRED': r.ot_approver_name || '',
    };
  });
}

async function getReportMeta() {
  const { rows } = await pool.query(
    'SELECT key, value FROM sync_settings WHERE key = ANY($1)',
    [['iso_ref_no', 'iso_version', 'iso_date', 'max_ot_hours']]
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    isoRefNo: map.iso_ref_no || 'N/A',
    isoVersion: map.iso_version || 'N/A',
    isoDate: map.iso_date || 'N/A',
    maxOt: map.max_ot_hours || 'N/A',
  };
}

module.exports = {
  REPORT_COLUMNS,
  queryAttendance,
  shapeRows,
  getReportMeta,
  toExclusiveEndBoundary,
  todayLocalDateString,
};
