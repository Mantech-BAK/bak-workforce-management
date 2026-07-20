const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');

const pool = require('../config/db');
const { todayLocalDateString } = require('../services/attendanceReport');
const { processTeamsTasks } = require('../jobs/teamsTaskProcessor');
const {
  addDays,
  isActiveEmployee,
  lookupProject,
  createTaskRowsFromFields,
} = require('../services/taskRowValidation');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function cellText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  return String(value).trim();
}

router.get('/me/today', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const { rows } = await pool.query(
    'SELECT count(*) FROM tasks WHERE emp_id = $1 AND task_date = $2',
    [req.employee.emp_id, todayLocalDateString()]
  );

  res.json({ count: Number(rows[0].count) });
});

router.get('/me', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const { rows } = await pool.query(
    `SELECT t.id, t.emp_id, t.task_date, t.start_time, t.end_time, t.location, t.description, t.priority, t.remarks,
            t.status, t.source, t.teams_message_id, t.created_at, t.project_code, p.project_name
     FROM tasks t
     LEFT JOIN projects p ON p.project_code = t.project_code
     WHERE t.emp_id = $1 AND t.status != 'completed' AND t.task_date <= $2
     ORDER BY t.task_date ASC`,
    [req.employee.emp_id, todayLocalDateString()]
  );

  res.json(rows);
});

router.get('/', async (req, res) => {
  const { date, status } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;

  if (date) {
    conditions.push(`t.task_date = $${i}`);
    values.push(date);
    i += 1;
  }
  if (status) {
    conditions.push(`t.status = $${i}`);
    values.push(status);
    i += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT t.id, t.emp_id, e.name AS employee_name, t.task_date, t.start_time, t.end_time, t.location, t.description,
            t.priority, t.remarks, t.status, t.source, t.teams_message_id, t.created_at, t.project_code, p.project_name
     FROM tasks t
     LEFT JOIN employees e ON e.emp_id = t.emp_id
     LEFT JOIN projects p ON p.project_code = t.project_code
     ${where}
     ORDER BY t.task_date DESC, t.created_at DESC`,
    values
  );

  res.json(rows);
});

router.post('/create', async (req, res) => {
  const {
    emp_id: empId,
    project_code: projectCodeRaw,
    days,
    start_time: startTime,
    end_time: endTime,
    location,
    description,
    priority,
    remarks,
  } = req.body;

  if (!empId || !description || !projectCodeRaw) {
    return res.status(400).json({ error: 'emp_id, project_code, and description are required' });
  }

  const numDays = days === undefined ? 1 : Number(days);
  if (!Number.isInteger(numDays) || numDays < 1 || numDays > 365) {
    return res.status(400).json({ error: 'days must be an integer between 1 and 365' });
  }

  if (!(await isActiveEmployee(empId))) {
    return res.status(400).json({ error: 'Employee not found or not active' });
  }

  const projectCode = Number(projectCodeRaw);
  if (!Number.isInteger(projectCode) || !(await lookupProject(projectCode))) {
    return res.status(400).json({ error: 'Project code not found' });
  }

  const today = todayLocalDateString();
  const created = [];
  for (let i = 0; i < numDays; i += 1) {
    const { rows } = await pool.query(
      `INSERT INTO tasks (emp_id, task_date, project_code, start_time, end_time, location, description, priority, remarks, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'admin_portal')
       RETURNING id, emp_id, task_date, project_code, start_time, end_time, location, description, priority, remarks, status, source, created_at`,
      [empId, addDays(today, i), projectCode, startTime || null, endTime || null, location || null, description, priority || null, remarks || null]
    );
    created.push(rows[0]);
  }

  res.status(201).json(numDays === 1 ? created[0] : created);
});

const EDITABLE_FIELDS = ['task_date', 'project_code', 'start_time', 'end_time', 'location', 'description', 'priority', 'remarks'];

router.patch('/:id', async (req, res) => {
  if ('project_code' in req.body) {
    const projectCode = Number(req.body.project_code);
    if (!Number.isInteger(projectCode) || !(await lookupProject(projectCode))) {
      return res.status(400).json({ error: 'Project code not found' });
    }
    req.body.project_code = projectCode;
  }

  const updates = [];
  const values = [];
  let i = 1;

  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) {
      updates.push(`${field} = $${i}`);
      values.push(req.body[field] || null);
      i += 1;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: `No editable fields provided. Editable fields: ${EDITABLE_FIELDS.join(', ')}` });
  }

  values.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${i}
     RETURNING id, emp_id, task_date, project_code, start_time, end_time, location, description, priority, remarks, status, source, teams_message_id, created_at`,
    values
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(rows[0]);
});

const EMPLOYEE_ALLOWED_STATUSES = ['in_progress', 'completed', 'cannot_complete'];

router.patch('/:id/status', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const { status } = req.body;
  if (!EMPLOYEE_ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${EMPLOYEE_ALLOWED_STATUSES.join(', ')}` });
  }

  const task = await pool.query(
    `SELECT id, task_date <= $3 AS is_due FROM tasks WHERE id = $1 AND emp_id = $2`,
    [req.params.id, req.employee.emp_id, todayLocalDateString()]
  );
  if (!task.rows[0]) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!task.rows[0].is_due) {
    return res.status(400).json({ error: 'Task is not due yet' });
  }

  // actual_start_time/actual_end_time track real work-session times (as opposed to
  // start_time/end_time, the admin-planned schedule) for the Confirmation Sheet.
  const actualTimeUpdate =
    status === 'in_progress'
      ? ', actual_start_time = now()'
      : status === 'completed' || status === 'cannot_complete'
        ? ', actual_end_time = now()'
        : '';

  const { rows } = await pool.query(
    `UPDATE tasks SET status = $1${actualTimeUpdate} WHERE id = $2
     RETURNING id, emp_id, task_date, start_time, end_time, actual_start_time, actual_end_time, location, description, priority, remarks, status, source, teams_message_id, created_at`,
    [status, req.params.id]
  );

  res.json(rows[0]);
});

router.post('/:id/reschedule-tomorrow', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const task = await pool.query('SELECT id, task_date FROM tasks WHERE id = $1 AND emp_id = $2', [
    req.params.id,
    req.employee.emp_id,
  ]);
  if (!task.rows[0]) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Clears actual_start_time/actual_end_time rather than preserving them: this row's
  // task_date is moving forward, so yesterday's work-session stamps would otherwise
  // masquerade as today's if the task gets restarted, corrupting that day's
  // Confirmation Sheet gap-fill. The partial time already worked still counts toward
  // the old day's total hours (folded into Default Work once this row no longer
  // matches that day's task_date) — it just loses this specific task's attribution.
  const { rows } = await pool.query(
    `UPDATE tasks SET task_date = task_date + 1, status = 'pending', actual_start_time = NULL, actual_end_time = NULL WHERE id = $1
     RETURNING id, emp_id, task_date, start_time, end_time, actual_start_time, actual_end_time, location, description, priority, remarks, status, source, teams_message_id, created_at`,
    [req.params.id]
  );

  res.json(rows[0]);
});

router.get('/report', async (req, res) => {
  const { emp_id: empId, from, to } = req.query;

  if (!empId || !from || !to) {
    return res.status(400).json({ error: 'emp_id, from, and to are required' });
  }

  const { rows } = await pool.query(
    `SELECT status, count(*) AS count
     FROM tasks
     WHERE emp_id = $1 AND task_date BETWEEN $2 AND $3 AND status IN ('completed', 'cannot_complete')
     GROUP BY status`,
    [empId, from, to]
  );

  const result = { completed: 0, cannot_complete: 0 };
  for (const row of rows) {
    result[row.status] = Number(row.count);
  }

  res.json(result);
});

router.post('/process-teams', async (req, res) => {
  try {
    const summary = await processTeamsTasks();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The canonical Bulk Task Import Excel file is now distributed directly (not
// generated by this app) — it has its own title/instructions rows, a locked
// TODAY()-formula Task Date column, a VLOOKUP-formula Project Name column driven by
// a hidden "Projects" lookup sheet, and a green example row. This route no longer
// assumes a fixed row 1 header / row 2 data layout; it locates the header row by
// content and reads formula cells by their cached result.
function normalizeHeaderLabel(text) {
  return text.replace(/\(.*$/, '').trim().toLowerCase();
}

// Bare column labels the canonical file actually uses (some carry a wrapped
// parenthetical hint, e.g. "Start Time (HH:MM)", "Days (recurring)" — stripped by
// normalizeHeaderLabel before comparison).
const CANONICAL_HEADERS = [
  'Employee ID',
  'Task Date',
  'Project Code',
  'Project Name',
  'Location',
  'Description',
  'Priority',
  'Start Time',
  'End Time',
  'Remarks',
  'Days',
];

function findHeaderRowNumber(sheet) {
  const scanLimit = Math.min(sheet.rowCount, 20);
  for (let r = 1; r <= scanLimit; r += 1) {
    const first = normalizeHeaderLabel(cellText(cellRawValue(sheet.getRow(r).getCell(1))));
    if (first === 'employee id') return r;
  }
  return null;
}

// Unwraps a formula cell ({ formula, result }) to its cached computed value —
// Task Date and Project Name are both locked formulas in the canonical file.
function cellRawValue(cell) {
  const v = cell.value;
  if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'formula' in v) return v.result;
  return v;
}

function isBlankValue(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

router.post('/bulk-import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read the uploaded file. Make sure it is a valid .xlsx file.' });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return res.status(400).json({ error: 'The uploaded file has no worksheet' });
  }

  const headerRowNumber = findHeaderRowNumber(sheet);
  if (headerRowNumber === null) {
    return res.status(400).json({
      error: 'Could not find a header row starting with "Employee ID" in this file. Make sure you are uploading the Bulk Task Import template.',
    });
  }

  const headerRow = sheet.getRow(headerRowNumber);
  for (let col = 0; col < CANONICAL_HEADERS.length; col += 1) {
    const actual = normalizeHeaderLabel(cellText(cellRawValue(headerRow.getCell(col + 1))));
    const expected = CANONICAL_HEADERS[col].toLowerCase();
    if (actual !== expected) {
      return res.status(400).json({
        error: `Column ${col + 1} of the header row is "${cellText(cellRawValue(headerRow.getCell(col + 1))) || '(empty)'}", expected "${CANONICAL_HEADERS[col]}". Make sure you are uploading the Bulk Task Import template with its column order unchanged.`,
      });
    }
  }

  let total = 0;
  let succeeded = 0;
  const failed = [];

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const cells = [];
    for (let col = 1; col <= CANONICAL_HEADERS.length; col += 1) cells.push(cellRawValue(row.getCell(col)));
    if (cells.every(isBlankValue)) continue;

    total += 1;
    try {
      // Column 4 (Project Name) is intentionally never read here — it's a
      // locked lookup formula for whoever fills out the sheet, always ignored in
      // favor of looking up the real name from Project Code.
      await createTaskRowsFromFields(
        {
          empId: cellText(cells[0]),
          taskDate: cells[1],
          projectCodeRaw: cells[2],
          location: cellText(cells[4]),
          description: cellText(cells[5]),
          priorityRaw: cells[6],
          startTimeRaw: cells[7],
          endTimeRaw: cells[8],
          remarks: cellText(cells[9]),
          daysRaw: cells[10],
        },
        'admin_portal'
      );

      succeeded += 1;
    } catch (err) {
      failed.push({ row: rowNumber, reason: err.message });
    }
  }

  res.json({ total, succeeded, failed });
});

module.exports = router;
