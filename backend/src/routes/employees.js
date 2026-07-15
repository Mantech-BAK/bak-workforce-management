const express = require('express');

const pool = require('../config/db');

const router = express.Router();

const FILTERABLE_COLUMNS = [
  'status',
  'department',
  'company',
  'designation',
  'cost_center',
  'nationality',
  'office_shift',
];

router.get('/me', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const { rows } = await pool.query(
    'SELECT emp_id, name, designation, department FROM employees WHERE emp_id = $1',
    [req.employee.emp_id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  res.json(rows[0]);
});

router.get('/', async (req, res) => {
  const { search, ...filters } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;

  if (search) {
    conditions.push(`(name ILIKE $${i} OR emp_id ILIKE $${i} OR cpr ILIKE $${i} OR phone ILIKE $${i})`);
    values.push(`%${search}%`);
    i += 1;
  }

  for (const column of FILTERABLE_COLUMNS) {
    if (filters[column]) {
      conditions.push(`${column} = $${i}`);
      values.push(filters[column]);
      i += 1;
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT id, emp_id, cpr, name, designation, cost_center, phone, status, nationality,
            joining_date, company, department, office_shift, ot_eligible, cr_name, cr_number,
            reporting_manager, zk_is_active, zk_hire_date, created_at
     FROM employees
     ${where}
     ORDER BY name`,
    values
  );

  res.json(rows);
});

module.exports = router;
