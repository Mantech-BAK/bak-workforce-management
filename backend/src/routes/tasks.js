const express = require('express');

const pool = require('../config/db');
const { todayLocalDateString } = require('../services/attendanceReport');

const router = express.Router();

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
    `SELECT id, emp_id, task_date, location, description, priority, remarks, status, source, teams_message_id, created_at
     FROM tasks
     WHERE emp_id = $1 AND status != 'completed'
     ORDER BY task_date ASC`,
    [req.employee.emp_id]
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
    `SELECT t.id, t.emp_id, e.name AS employee_name, t.task_date, t.location, t.description,
            t.priority, t.remarks, t.status, t.source, t.teams_message_id, t.created_at
     FROM tasks t
     LEFT JOIN employees e ON e.emp_id = t.emp_id
     ${where}
     ORDER BY t.task_date DESC, t.created_at DESC`,
    values
  );

  res.json(rows);
});

router.post('/create', async (req, res) => {
  const { emp_id: empId, task_date: taskDate, location, description, priority, remarks } = req.body;

  if (!empId || !taskDate || !description) {
    return res.status(400).json({ error: 'emp_id, task_date, and description are required' });
  }

  const employee = await pool.query('SELECT emp_id FROM employees WHERE emp_id = $1 AND status = $2', [
    empId,
    'active',
  ]);
  if (!employee.rows[0]) {
    return res.status(400).json({ error: 'Employee not found or not active' });
  }

  const existing = await pool.query('SELECT id FROM tasks WHERE emp_id = $1 AND task_date = $2', [
    empId,
    taskDate,
  ]);
  if (existing.rows[0]) {
    return res.status(409).json({ error: 'A task already exists for this employee on this date' });
  }

  const { rows } = await pool.query(
    `INSERT INTO tasks (emp_id, task_date, location, description, priority, remarks, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'admin_portal')
     RETURNING id, emp_id, task_date, location, description, priority, remarks, status, source, created_at`,
    [empId, taskDate, location || null, description, priority || null, remarks || null]
  );

  res.status(201).json(rows[0]);
});

const EMPLOYEE_ALLOWED_STATUSES = ['in_progress', 'completed'];

router.patch('/:id/status', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const { status } = req.body;
  if (!EMPLOYEE_ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${EMPLOYEE_ALLOWED_STATUSES.join(', ')}` });
  }

  const task = await pool.query('SELECT id FROM tasks WHERE id = $1 AND emp_id = $2', [
    req.params.id,
    req.employee.emp_id,
  ]);
  if (!task.rows[0]) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { rows } = await pool.query(
    `UPDATE tasks SET status = $1 WHERE id = $2
     RETURNING id, emp_id, task_date, location, description, priority, remarks, status, source, teams_message_id, created_at`,
    [status, req.params.id]
  );

  res.json(rows[0]);
});

module.exports = router;
