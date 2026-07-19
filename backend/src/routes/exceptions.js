const express = require('express');

const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { type, status, emp_id: empId, date } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;

  if (type) {
    conditions.push(`ex.type = $${i}`);
    values.push(type);
    i += 1;
  }
  if (status) {
    conditions.push(`ex.status = $${i}`);
    values.push(status);
    i += 1;
  }
  if (empId) {
    conditions.push(`ex.emp_id = $${i}`);
    values.push(empId);
    i += 1;
  }
  if (date) {
    conditions.push(`ex.created_at::date = $${i}`);
    values.push(date);
    i += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT ex.id, ex.type, ex.emp_id, e.name AS employee_name, ex.ref_table, ex.ref_id,
            ex.details, ex.status, ex.resolved_by, ex.resolved_at, ex.created_at
     FROM exceptions ex
     LEFT JOIN employees e ON e.emp_id = ex.emp_id
     ${where}
     ORDER BY ex.created_at DESC`,
    values
  );

  res.json(rows);
});

router.post('/:id/resolve', async (req, res) => {
  const { resolved_by: resolvedBy } = req.body;

  if (!resolvedBy) {
    return res.status(400).json({ error: 'resolved_by is required' });
  }

  const { rows } = await pool.query(
    `UPDATE exceptions
     SET status = 'resolved', resolved_by = $1, resolved_at = now()
     WHERE id = $2
     RETURNING id, type, emp_id, ref_table, ref_id, details, status, resolved_by, resolved_at, created_at`,
    [resolvedBy, req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Exception not found' });
  }

  res.json(rows[0]);
});

module.exports = router;
