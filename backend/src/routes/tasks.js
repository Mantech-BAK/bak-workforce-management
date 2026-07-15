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

module.exports = router;
