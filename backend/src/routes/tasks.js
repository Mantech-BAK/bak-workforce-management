const express = require('express');

const pool = require('../config/db');
const { todayLocalDateString } = require('../services/attendanceReport');
const { processTeamsTasks } = require('../jobs/teamsTaskProcessor');

const router = express.Router();

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + n);
  const pad = (v) => String(v).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

async function isActiveEmployee(empId) {
  const { rows } = await pool.query('SELECT emp_id FROM employees WHERE emp_id = $1 AND status = $2', [empId, 'active']);
  return Boolean(rows[0]);
}

async function lookupProject(projectCode) {
  const { rows } = await pool.query('SELECT project_code, project_name FROM projects WHERE project_code = $1', [projectCode]);
  return rows[0] || null;
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

  const { rows } = await pool.query(
    `UPDATE tasks SET status = $1 WHERE id = $2
     RETURNING id, emp_id, task_date, start_time, end_time, location, description, priority, remarks, status, source, teams_message_id, created_at`,
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

  const { rows } = await pool.query(
    `UPDATE tasks SET task_date = task_date + 1, status = 'pending' WHERE id = $1
     RETURNING id, emp_id, task_date, start_time, end_time, location, description, priority, remarks, status, source, teams_message_id, created_at`,
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

module.exports = router;
