const pool = require('../config/db');

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + n);
  const pad = (v) => String(v).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

async function isActiveEmployee(empId) {
  const { rows } = await pool.query('SELECT emp_id FROM employees WHERE emp_id = $1 AND status = $2', [empId, 'active']);
  return Boolean(rows[0]);
}

async function lookupProject(projectCode) {
  const { rows } = await pool.query('SELECT project_code, project_name FROM projects WHERE project_code = $1', [projectCode]);
  return rows[0] || null;
}

const PRIORITY_VALUES = ['low', 'medium', 'high'];

function normalizePriority(value) {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  const v = String(value).trim().toLowerCase();
  if (!PRIORITY_VALUES.includes(v)) return { ok: false };
  return { ok: true, value: v };
}

// Accepts a JS Date (as exceljs decodes native Excel date cells, UTC-based) or a
// DD/MM/YYYY string (as typed into a text-formatted cell, or pasted as plain text).
function parseTaskDateCell(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const str = String(value).trim();
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

function parseTimeCell(value) {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return { ok: true, value: `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}` };
  }
  const str = String(value).trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(str)) return { ok: false };
  return { ok: true, value: str };
}

function parseDaysCell(value) {
  if (value === undefined || value === null || value === '') return { ok: true, value: 1 };
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 365) return { ok: false };
  return { ok: true, value: n };
}

async function validateProjectCode(rawValue) {
  const projectCode = Number(rawValue);
  if (rawValue === undefined || rawValue === null || rawValue === '' || !Number.isInteger(projectCode)) {
    return { ok: false, reason: 'Project Code is required and must be a whole number' };
  }
  const project = await lookupProject(projectCode);
  if (!project) return { ok: false, reason: `Project Code ${projectCode} not found` };
  return { ok: true, projectCode };
}

// Validates one logical row (emp_id, task_date, project_code, ...) shared by bulk-import
// and Teams paste ingestion, and inserts the resulting task rows (one per Days). Throws
// with a human-readable message on the first validation failure; the caller is expected
// to catch it and record { row, reason }.
async function createTaskRowsFromFields(fields, source, teamsMessageId) {
  const { empId, taskDate, projectCodeRaw, location, description, priorityRaw, startTimeRaw, endTimeRaw, remarks, daysRaw } = fields;

  if (!empId) throw new Error('Employee ID is required');
  if (!(await isActiveEmployee(empId))) throw new Error(`Employee ID ${empId} not found or not active`);

  const parsedDate = parseTaskDateCell(taskDate);
  if (!parsedDate) throw new Error('Task Date is missing or not a valid date (expected DD/MM/YYYY)');

  const projectResult = await validateProjectCode(projectCodeRaw);
  if (!projectResult.ok) throw new Error(projectResult.reason);

  if (!description) throw new Error('Description is required');

  const priorityResult = normalizePriority(priorityRaw);
  if (!priorityResult.ok) throw new Error('Priority must be Low, Medium, or High');

  const startTimeResult = parseTimeCell(startTimeRaw);
  if (!startTimeResult.ok) throw new Error('Start Time must be in HH:MM format');

  const endTimeResult = parseTimeCell(endTimeRaw);
  if (!endTimeResult.ok) throw new Error('End Time must be in HH:MM format');

  const daysResult = parseDaysCell(daysRaw);
  if (!daysResult.ok) throw new Error('Days must be a whole number between 1 and 365');

  const created = [];
  for (let i = 0; i < daysResult.value; i += 1) {
    const { rows } = await pool.query(
      `INSERT INTO tasks (emp_id, task_date, project_code, start_time, end_time, location, description, priority, remarks, source, teams_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, emp_id, task_date, project_code`,
      [
        empId,
        addDays(parsedDate, i),
        projectResult.projectCode,
        startTimeResult.value,
        endTimeResult.value,
        location || null,
        description,
        priorityResult.value,
        remarks || null,
        source,
        teamsMessageId || null,
      ]
    );
    created.push(rows[0]);
  }

  return created;
}

module.exports = {
  addDays,
  isActiveEmployee,
  lookupProject,
  normalizePriority,
  parseTaskDateCell,
  parseTimeCell,
  parseDaysCell,
  validateProjectCode,
  createTaskRowsFromFields,
};
