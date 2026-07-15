const express = require('express');

const pool = require('../config/db');

const router = express.Router();

router.get('/enrollments', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const { rows } = await pool.query(
    `SELECT al.id, al.actor, al.action, al.entity, al.entity_id, al.created_at, e.name AS employee_name
     FROM audit_logs al
     JOIN employees e ON e.id = al.entity_id AND al.entity = 'employees'
     WHERE al.action = 'face_self_enrolled'
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );

  res.json(rows);
});

module.exports = router;
