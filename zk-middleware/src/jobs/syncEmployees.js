const pool = require('../config/postgres');
const { getPool, sql } = require('../config/sqlserver');

async function getKnownCprs() {
  const { rows } = await pool.query('SELECT cpr FROM employees WHERE cpr IS NOT NULL');
  return rows.map((r) => r.cpr);
}

async function fetchZkEmployees(cprs) {
  if (cprs.length === 0) return [];

  const sqlPool = await getPool();
  const request = sqlPool.request();
  const placeholders = cprs.map((cpr, i) => {
    const paramName = `cpr${i}`;
    request.input(paramName, sql.VarChar, cpr);
    return `@${paramName}`;
  });

  const result = await request.query(`
    SELECT pe.emp_code, pe.first_name, pd.dept_name, pe.is_active, pe.hire_date
    FROM personnel_employee pe
    JOIN personnel_department pd ON pd.id = pe.department_id
    WHERE pe.emp_code IN (${placeholders.join(', ')}) AND pe.is_active = 1
  `);

  return result.recordset;
}

async function upsertEmployee(row) {
  const { emp_code: empCode, dept_name: deptName, hire_date: hireDate } = row;

  if (!empCode) {
    throw new Error('missing emp_code');
  }

  await pool.query(
    `UPDATE employees
     SET zk_is_active = true, zk_hire_date = $1, zk_last_synced = now(), department = $2
     WHERE cpr = $3`,
    [hireDate || null, deptName || null, empCode]
  );
}

async function syncEmployees() {
  const summary = { checked: 0, matched: 0, updated: 0, skipped: 0 };

  const cprs = await getKnownCprs();
  summary.checked = cprs.length;

  let zkRows;
  try {
    zkRows = await fetchZkEmployees(cprs);
  } catch (err) {
    console.error('syncEmployees: failed to query ZK SQL Server', err.message);
    return summary;
  }

  summary.matched = zkRows.length;

  for (const row of zkRows) {
    try {
      await upsertEmployee(row);
      summary.updated += 1;
    } catch (err) {
      console.error(`syncEmployees: skipping malformed row (emp_code=${row?.emp_code})`, err.message);
      summary.skipped += 1;
    }
  }

  return summary;
}

module.exports = { syncEmployees };
