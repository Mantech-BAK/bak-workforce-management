const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT project_code, project_name, project_company_name
     FROM projects
     WHERE status = 'OPEN'
     ORDER BY project_name`
  );
  res.json(rows);
});

module.exports = router;
