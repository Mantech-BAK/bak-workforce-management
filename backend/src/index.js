require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const pool = require('./config/db');
const requireAuth = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const employeesRoutes = require('./routes/employees');
const auditLogsRoutes = require('./routes/auditLogs');
const attendanceRoutes = require('./routes/attendance');
const exceptionsRoutes = require('./routes/exceptions');
const tasksRoutes = require('./routes/tasks');
const projectsRoutes = require('./routes/projects');

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/auth', authRoutes);

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ employee: req.employee });
});

app.use('/api/employees', requireAuth, employeesRoutes);
app.use('/api/audit-logs', requireAuth, auditLogsRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/exceptions', requireAuth, exceptionsRoutes);
app.use('/api/tasks', requireAuth, tasksRoutes);
app.use('/api/projects', requireAuth, projectsRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
