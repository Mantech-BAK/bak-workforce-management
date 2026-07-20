const pool = require('../config/db');
const { getWorkScheduleSettings } = require('./workScheduleSettings');

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

function dateToLocalString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Combines a date-only Date (midnight) with a 'HH:MM' or 'HH:MM:SS' time-of-day
// string (as returned by pg for `time` columns, or from work-schedule settings)
// into a single Date on that same calendar day.
function combineDateAndTime(dayDate, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, m, 0, 0);
}

// Fetches one row per (employee, calendar day) with punch-in/OT summary — the
// attendance-anchored group Confirmation Sheet rows are built from. An
// employee/day with no attendance record produces no group and therefore no rows
// at all, regardless of any tasks assigned that day.
async function queryAttendanceDayGroups({ empId, siteId, dateFrom, dateTo } = {}) {
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
       (a.punch_in_time::date) AS day,
       MIN(a.punch_in_time) AS punch_in_time,
       SUM(COALESCE(a.ot_hours, 0)) AS ot_hours
     FROM attendance a
     JOIN employees e ON e.emp_id = a.emp_id
     ${where}
     GROUP BY e.emp_id, e.cpr, e.name, e.designation, e.cost_center, e.ot_eligible, (a.punch_in_time::date)
     ORDER BY (a.punch_in_time::date), e.emp_id`,
    values
  );

  return rows;
}

async function lookupOtApprover(costCenter, otHours) {
  if (!otHours) return null;
  const { rows } = await pool.query(
    `SELECT approver_name
     FROM ot_approval_tiers
     WHERE min_ot_hours <= $1 AND (cost_center = $2 OR cost_center IS NULL)
     ORDER BY (cost_center IS NOT NULL) DESC, min_ot_hours DESC
     LIMIT 1`,
    [otHours, costCenter]
  );
  return rows[0]?.approver_name || null;
}

async function fetchDayTasks(empId, dayString) {
  const { rows } = await pool.query(
    `SELECT t.actual_start_time, t.actual_end_time, t.description, t.remarks, p.project_name, p.project_company_name
     FROM tasks t
     LEFT JOIN projects p ON p.project_code = t.project_code
     WHERE t.emp_id = $1 AND t.task_date = $2
     ORDER BY t.actual_start_time ASC NULLS LAST, t.created_at ASC`,
    [empId, dayString]
  );
  return rows;
}

// Builds the task + "Default Work" gap-fill rows for one employee's one day, walking
// the timeline from punch-in to shift-end and filling any uncovered stretch. Tasks
// keep their own recorded ACTUAL work-session times unconditionally (even if outside
// the punch-in/shift-end window); only the gap-fill math is clipped to that window.
// A task only counts as a real timed block once it has both actual_start_time and
// actual_end_time — one that was never started (or is still in progress, with no
// actual_end_time yet) contributes no time block at all, and its span is simply
// absorbed into whatever Default Work gap surrounds it.
function buildDayTimeline(dayTasks, punchIn, shiftEnd) {
  const timed = [];
  const timeless = [];

  for (const t of dayTasks) {
    if (t.actual_start_time && t.actual_end_time) {
      timed.push({
        start: new Date(t.actual_start_time),
        end: new Date(t.actual_end_time),
        job: t.project_company_name || '',
        projectName: t.project_name || '',
        remarks: t.remarks || '',
      });
    } else {
      // Never started (no actual_start_time), or still in progress (started but no
      // actual_end_time yet) — either way it can't be placed on the gap-fill
      // timeline, but a task that's mid-session still shows its own start time.
      timeless.push({
        start: t.actual_start_time ? new Date(t.actual_start_time) : null,
        end: null,
        job: t.project_company_name || '',
        projectName: t.project_name || '',
        remarks: t.remarks || '',
      });
    }
  }

  const rows = [];
  let cursor = punchIn;

  for (const task of timed) {
    const clippedStart = task.start < shiftEnd ? task.start : shiftEnd;
    if (clippedStart > cursor) {
      rows.push({ start: cursor, end: clippedStart, job: 'Default Work', projectName: 'Default Work', remarks: '' });
    }
    rows.push({ start: task.start, end: task.end, job: task.job, projectName: task.projectName, remarks: task.remarks });
    const clippedEnd = task.end < shiftEnd ? task.end : shiftEnd;
    if (clippedEnd > cursor) cursor = clippedEnd;
  }

  if (cursor < shiftEnd) {
    rows.push({ start: cursor, end: shiftEnd, job: 'Default Work', projectName: 'Default Work', remarks: '' });
  }

  return { timedRows: rows, timelessRows: timeless };
}

// Expands the attendance-day groups into final Confirmation Sheet rows: one row per
// task, "Default Work" rows for uncovered time between punch-in and shift-end, and
// tasks with no start/end time shown with blank time columns. OT hours/eligibility
// approver are attached only to the last chronological row of the day (the last
// timed task or gap) so a reader scanning the OT column doesn't see it repeated
// across every row for the same day.
async function shapeRows(dayGroups) {
  const settings = await getWorkScheduleSettings();
  const out = [];

  for (const group of dayGroups) {
    const dayDate = group.day;
    const dayString = dateToLocalString(dayDate);
    const punchIn = new Date(group.punch_in_time);
    const shiftEnd = combineDateAndTime(dayDate, settings.shiftEndTime);

    const dayTasks = await fetchDayTasks(group.emp_id, dayString);
    const { timedRows, timelessRows } = buildDayTimeline(dayTasks, punchIn, shiftEnd);

    const otHours = Number(group.ot_hours) || 0;
    const approver = await lookupOtApprover(group.cost_center, otHours);

    const lastTimedIndex = timedRows.length - 1;

    const allRows = [...timedRows, ...timelessRows];

    allRows.forEach((row, idx) => {
      const isLastTimedRow = timedRows.length > 0 && idx === lastTimedIndex;
      const workingHours = row.start && row.end ? (row.end - row.start) / 3600000 : null;

      out.push({
        'EMP ID': group.emp_id || '',
        CPR: group.cpr || '',
        'EMPLOYEE NAME': group.employee_name || '',
        DESIGNATION: group.designation || '',
        'COST CENTER': group.cost_center || '',
        'ATTENDANCE DATE': formatDate(dayDate),
        'START DATE': formatDate(dayDate),
        'START TIME': row.start ? formatTime(row.start) : '',
        'END TIME': row.end ? formatTime(row.end) : '',
        'END DATE': formatDate(dayDate),
        'T. WORKING H.': workingHours !== null ? workingHours.toFixed(2) : '',
        JOB: row.job || '',
        'PROJECT NAME': row.projectName || '',
        REMARKS: row.remarks || '',
        'OT ELIGIBLE': group.ot_eligible || '',
        OT: isLastTimedRow ? otHours : '',
        'APPROVAL REQUIRED': isLastTimedRow ? approver || '' : '',
      });
    });
  }

  return out.map((row, idx) => ({ '#': idx + 1, ...row }));
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
  queryAttendance: queryAttendanceDayGroups,
  shapeRows,
  getReportMeta,
  toExclusiveEndBoundary,
  todayLocalDateString,
};
