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
