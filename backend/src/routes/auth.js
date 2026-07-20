const express = require('express');
const jwt = require('jsonwebtoken');

const pool = require('../config/db');
const { getFaceDescriptor, similarity } = require('../face/faceEngine');

const router = express.Router();

const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.5);

function issueToken(employee) {
  return jwt.sign({ id: employee.id, emp_id: employee.emp_id }, process.env.JWT_SECRET, {
    expiresIn: '8h',
  });
}

router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { emp_id } = req.body;
  if (!emp_id) {
    return res.status(400).json({ error: 'emp_id is required' });
  }

  const { rows } = await pool.query('SELECT id, emp_id FROM employees WHERE emp_id = $1', [emp_id]);
  const employee = rows[0];

  if (!employee) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await pool.query(
    'INSERT INTO audit_logs (actor, action, entity, entity_id) VALUES ($1, $2, $3, $4)',
    [employee.emp_id, 'dev_login_bypass', 'employees', employee.id]
  );

  const token = issueToken(employee);
  return res.json({ token });
});

router.post('/face-login', async (req, res) => {
  const { emp_id, face_image } = req.body;

  if (!emp_id || !face_image) {
    return res.status(400).json({ error: 'emp_id and face_image are required' });
  }

  const { rows } = await pool.query(
    'SELECT id, emp_id, face_template FROM employees WHERE emp_id = $1',
    [emp_id]
  );
  const employee = rows[0];

  if (!employee) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const imageBuffer = Buffer.from(face_image, 'base64');
  let descriptor;
  try {
    descriptor = await getFaceDescriptor(imageBuffer, emp_id);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid image data' });
  }

  if (!descriptor) {
    return res.status(400).json({ error: 'No face detected in image' });
  }

  if (!employee.face_template) {
    await pool.query('UPDATE employees SET face_template = $1 WHERE id = $2', [
      JSON.stringify(descriptor),
      employee.id,
    ]);
    await pool.query(
      'INSERT INTO audit_logs (actor, action, entity, entity_id) VALUES ($1, $2, $3, $4)',
      [employee.emp_id, 'face_self_enrolled', 'employees', employee.id]
    );

    const token = issueToken(employee);
    return res.json({ token, enrolled: true });
  }

  const storedDescriptor = JSON.parse(employee.face_template);
  const score = similarity(descriptor, storedDescriptor);

  if (score >= FACE_MATCH_THRESHOLD) {
    const token = issueToken(employee);
    return res.json({ token, enrolled: false });
  }

  await pool.query(
    'INSERT INTO exceptions (type, emp_id, ref_table, ref_id, details) VALUES ($1, $2, $3, $4, $5)',
    ['face_match_failed', employee.emp_id, 'employees', employee.id, `similarity=${score.toFixed(4)}`]
  );

  return res.status(401).json({ error: 'Face match failed' });
});

module.exports = router;
