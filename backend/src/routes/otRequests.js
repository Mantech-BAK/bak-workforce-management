const express = require('express');
const crypto = require('crypto');

const pool = require('../config/db');
const { lookupOtTier } = require('../services/otApproval');
const { sendMail } = require('../services/graphClient');
const { todayLocalDateString } = require('../services/attendanceReport');

// TWO KNOWN PENDING ITEMS before this actually notifies anyone in production:
// 1. ot_approval_tiers.approver_email is NULL for all three tiers (DINIL/ANAND/SEKAR) —
//    real addresses need to be provided and set on that table. Until then, requests
//    still get created but are logged as an 'ot_request_not_emailed' exception instead
//    of being sent.
// 2. The Graph app registration has Mail.ReadWrite but not Mail.Send, which sendMail()
//    actually requires — confirmed live via a 403 ErrorAccessDenied. Someone with
//    tenant admin rights needs to grant it (same class of gap as the Teams
//    ChannelMessage.Read.All permission). Until then every send attempt fails and is
//    logged as an 'ot_request_email_failed' exception, but the request itself still
//    goes through — nothing here is blocked on this, only the notification is.
const router = express.Router();

const WINDOW_SETTING_KEYS = ['ot_request_window_start', 'ot_request_window_end'];

async function getOtRequestWindow() {
  const { rows } = await pool.query('SELECT key, value FROM sync_settings WHERE key = ANY($1)', [WINDOW_SETTING_KEYS]);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { start: map.ot_request_window_start || '16:00', end: map.ot_request_window_end || '17:00' };
}

// Single source of truth for the hard OT cap, shared with the Confirmation Sheet's
// "MAX OT" header (getReportMeta in attendanceReport.js reads this same key) so the
// two can never drift out of sync.
async function getMaxOtHours() {
  const { rows } = await pool.query("SELECT value FROM sync_settings WHERE key = 'max_ot_hours'", []);
  return Number(rows[0]?.value) || 10;
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function timeStringToMinutes(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

// Same rule as employees.ot_eligible everywhere else in this feature: any non-blank
// value other than 'NO' counts as eligible. Provisional pending the corrected Excel
// data upload — the exact matching rule may need adjusting once that's in.
function isOtEligibleValue(value) {
  const v = (value || '').trim().toUpperCase();
  return v !== '' && v !== 'NO';
}

router.get('/window', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }
  const [window, maxHours] = await Promise.all([getOtRequestWindow(), getMaxOtHours()]);
  res.json({ ...window, maxHours });
});

router.post('/', async (req, res) => {
  if (!req.employee) {
    return res.status(403).json({ error: 'Employee token required' });
  }

  const { hours_requested: hoursRequestedRaw, reason } = req.body;
  const hoursRequested = Number(hoursRequestedRaw);
  if (!hoursRequestedRaw || !Number.isFinite(hoursRequested) || hoursRequested <= 0) {
    return res.status(400).json({ error: 'hours_requested must be a positive number' });
  }

  // Hard policy cap — rejected outright, before any tier/approver lookup, since this
  // is not something an approver can override.
  const maxOtHours = await getMaxOtHours();
  if (hoursRequested > maxOtHours) {
    return res.status(400).json({ error: `OT requests cannot exceed ${maxOtHours} hours` });
  }

  const employee = await pool.query(
    'SELECT emp_id, name, cost_center, ot_eligible FROM employees WHERE emp_id = $1',
    [req.employee.emp_id]
  );
  const emp = employee.rows[0];
  if (!emp) {
    return res.status(404).json({ error: 'Employee not found' });
  }
  if (!isOtEligibleValue(emp.ot_eligible)) {
    return res.status(403).json({ error: 'Not eligible for overtime' });
  }

  const window = await getOtRequestWindow();
  const nowMinutes = minutesSinceMidnight(new Date());
  if (nowMinutes < timeStringToMinutes(window.start) || nowMinutes >= timeStringToMinutes(window.end)) {
    return res.status(400).json({ error: `OT requests can only be submitted between ${window.start} and ${window.end}` });
  }

  const tier = await lookupOtTier(emp.cost_center, hoursRequested);
  if (!tier) {
    return res.status(400).json({ error: 'No approver tier matches the requested hours' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const requestDate = todayLocalDateString();

  const { rows } = await pool.query(
    `INSERT INTO ot_requests (emp_id, hours_requested, reason, request_date, tier_approver, approver_email, token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, emp_id, hours_requested, reason, request_date, tier_approver, status, requested_at`,
    [emp.emp_id, hoursRequested, reason || null, requestDate, tier.approverName, tier.approverEmail, token]
  );
  const created = rows[0];

  if (!tier.approverEmail) {
    console.error(
      `otRequests: no approver_email configured for tier '${tier.approverName}' — request ${created.id} created but not emailed`
    );
    await pool.query('INSERT INTO exceptions (type, emp_id, ref_table, ref_id, details) VALUES ($1, $2, $3, $4, $5)', [
      'ot_request_not_emailed',
      emp.emp_id,
      'ot_requests',
      created.id,
      `No approver_email configured for tier '${tier.approverName}'`,
    ]);
  } else {
    const approvalUrl = `${process.env.APP_BASE_URL}/ot-requests/${token}`;
    const html = `
      <p>${emp.name} (${emp.emp_id}) has requested ${hoursRequested} hour(s) of overtime for ${requestDate}.</p>
      <p><strong>Reason:</strong> ${reason ? reason : '(none given)'}</p>
      <p><a href="${approvalUrl}">Review this request</a></p>
    `;
    try {
      await sendMail(tier.approverEmail, `OT request from ${emp.name}`, html);
    } catch (err) {
      console.error(`otRequests: failed to send approval email for request ${created.id}`, err.message);
      await pool.query('INSERT INTO exceptions (type, emp_id, ref_table, ref_id, details) VALUES ($1, $2, $3, $4, $5)', [
        'ot_request_email_failed',
        emp.emp_id,
        'ot_requests',
        created.id,
        err.message,
      ]);
    }
  }

  res.status(201).json(created);
});

module.exports = router;
