const pool = require('../config/db');

// Finds the highest-threshold tier the given hours qualify for, preferring a
// cost-center-specific tier over a global (cost_center IS NULL) one at the same
// threshold. Shared by the Confirmation Sheet's informational approver display and
// the OT request routing logic — same table, same rule, used from two call sites.
async function lookupOtTier(costCenter, hours) {
  if (!hours) return null;
  const { rows } = await pool.query(
    `SELECT approver_name, approver_email
     FROM ot_approval_tiers
     WHERE min_ot_hours <= $1 AND (cost_center = $2 OR cost_center IS NULL)
     ORDER BY (cost_center IS NOT NULL) DESC, min_ot_hours DESC
     LIMIT 1`,
    [hours, costCenter]
  );
  const row = rows[0];
  if (!row) return null;
  return { approverName: row.approver_name, approverEmail: row.approver_email || null };
}

module.exports = { lookupOtTier };
