const express = require('express');

const pool = require('../config/db');
const {
  queryAttendance,
  shapeRows,
  getReportMeta,
  toExclusiveEndBoundary,
  todayLocalDateString,
} = require('../services/attendanceReport');
const { buildExcelBuffer } = require('../services/excelExport');
const { buildCsv } = require('../services/csvExport');
const { buildPdfBuffer } = require('../services/pdfExport');

const router = express.Router();

router.get('/me/status', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const date = todayLocalDateString();
  const { rows } = await pool.query(
    `SELECT punch_in_time, punch_out_time
     FROM attendance
     WHERE emp_id = $1 AND punch_in_time >= $2 AND punch_in_time < $3
     ORDER BY punch_in_time DESC
     LIMIT 1`,
    [req.employee.emp_id, `${date}T00:00:00`, `${toExclusiveEndBoundary(date)}T00:00:00`]
  );

  const latest = rows[0];
  if (!latest) {
    return res.json({ status: 'not_started', punch_in_time: null, punch_out_time: null });
  }

  res.json({
    status: latest.punch_out_time ? 'clocked_out' : 'clocked_in',
    punch_in_time: latest.punch_in_time,
    punch_out_time: latest.punch_out_time,
  });
});

router.post('/punch-in', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const { project_code, lat, lng } = req.body;
  if (!project_code || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'project_code, lat, and lng are required' });
  }

  const project = await pool.query(
    `SELECT project_code FROM projects WHERE project_code = $1 AND status = 'OPEN'`,
    [project_code]
  );
  if (!project.rows[0]) {
    return res.status(400).json({ error: 'Invalid or closed project_code' });
  }

  const open = await pool.query(
    `SELECT id FROM attendance WHERE emp_id = $1 AND punch_out_time IS NULL ORDER BY punch_in_time DESC LIMIT 1`,
    [req.employee.emp_id]
  );
  if (open.rows[0]) {
    return res.status(409).json({ error: 'Already clocked in' });
  }

  const employee = await pool.query('SELECT cpr FROM employees WHERE emp_id = $1', [req.employee.emp_id]);

  const { rows } = await pool.query(
    `INSERT INTO attendance (emp_id, cpr, punch_in_time, punch_in_lat, punch_in_lng, job_project_code, source)
     VALUES ($1, $2, now(), $3, $4, $5, 'mobile_app')
     RETURNING punch_in_time`,
    [req.employee.emp_id, employee.rows[0]?.cpr || null, lat, lng, project_code]
  );

  res.json({ status: 'clocked_in', punch_in_time: rows[0].punch_in_time });
});

router.post('/punch-out', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const open = await pool.query(
    `SELECT id FROM attendance WHERE emp_id = $1 AND punch_out_time IS NULL ORDER BY punch_in_time DESC LIMIT 1`,
    [req.employee.emp_id]
  );
  if (!open.rows[0]) {
    return res.status(400).json({ error: 'No active punch-in found' });
  }

  const { rows } = await pool.query(
    `UPDATE attendance
     SET punch_out_time = now(), punch_out_lat = $1, punch_out_lng = $2
     WHERE id = $3
     RETURNING punch_in_time, punch_out_time`,
    [lat, lng, open.rows[0].id]
  );

  res.json({ status: 'clocked_out', punch_in_time: rows[0].punch_in_time, punch_out_time: rows[0].punch_out_time });
});

async function respond(req, res, filters) {
  const format = String(req.query.format || 'json').toLowerCase();
  const rawRows = await queryAttendance(filters);
  const rows = shapeRows(rawRows);

  if (format === 'json') {
    return res.json(rows);
  }

  const meta = await getReportMeta();

  if (format === 'xlsx') {
    const buffer = await buildExcelBuffer(rows, meta);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.xlsx"');
    return res.send(buffer);
  }

  if (format === 'csv') {
    const csv = buildCsv(rows, meta);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
    return res.send(csv);
  }

  if (format === 'pdf') {
    const buffer = await buildPdfBuffer(rows, meta);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.pdf"');
    return res.send(buffer);
  }

  return res.status(400).json({ error: 'Unsupported format. Use json, xlsx, csv, or pdf.' });
}

router.get('/daily', async (req, res) => {
  const date = req.query.date || todayLocalDateString();
  await respond(req, res, {
    dateFrom: `${date}T00:00:00`,
    dateTo: `${toExclusiveEndBoundary(date)}T00:00:00`,
  });
});

router.get('/monthly', async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const to = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

  await respond(req, res, { dateFrom: `${from}T00:00:00`, dateTo: `${to}T00:00:00` });
});

router.get('/employee/:id', async (req, res) => {
  const { from, to } = req.query;
  await respond(req, res, {
    empId: req.params.id,
    dateFrom: from ? `${from}T00:00:00` : undefined,
    dateTo: to ? `${toExclusiveEndBoundary(to)}T00:00:00` : undefined,
  });
});

router.get('/site/:siteId', async (req, res) => {
  const { from, to } = req.query;
  await respond(req, res, {
    siteId: req.params.siteId,
    dateFrom: from ? `${from}T00:00:00` : undefined,
    dateTo: to ? `${toExclusiveEndBoundary(to)}T00:00:00` : undefined,
  });
});

module.exports = router;
