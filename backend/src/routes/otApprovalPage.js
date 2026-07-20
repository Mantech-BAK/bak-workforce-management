const express = require('express');

const pool = require('../config/db');

const router = express.Router();

// Deliberately not mounted under /api and not gated by requireAuth — reachable only
// by whoever holds the exact emailed token. Not listed in the admin portal at all.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(title, bodyHtml) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 40px auto; color: #1e293b;">
  ${bodyHtml}
</body>
</html>`;
}

router.get('/:token', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.hours_requested, r.reason, to_char(r.request_date, 'YYYY-MM-DD') AS request_date,
            r.status, r.tier_approver, e.name AS employee_name, e.emp_id
     FROM ot_requests r
     JOIN employees e ON e.emp_id = r.emp_id
     WHERE r.token = $1`,
    [req.params.token]
  );
  const request = rows[0];

  if (!request) {
    return res.status(404).send(page('OT Request', '<p>This link is not valid.</p>'));
  }

  if (request.status !== 'pending') {
    return res.send(page('OT Request', `<p>This request has already been <strong>${escapeHtml(request.status)}</strong>.</p>`));
  }

  res.send(
    page(
      'OT Request Approval',
      `
        <h2>OT Request</h2>
        <p><strong>Employee:</strong> ${escapeHtml(request.employee_name)} (${escapeHtml(request.emp_id)})</p>
        <p><strong>Date:</strong> ${escapeHtml(request.request_date)}</p>
        <p><strong>Hours requested:</strong> ${escapeHtml(request.hours_requested)}</p>
        <p><strong>Reason:</strong> ${escapeHtml(request.reason || '(none given)')}</p>
        <form method="POST" action="/ot-requests/${escapeHtml(req.params.token)}/decide" style="display:inline">
          <input type="hidden" name="decision" value="approved">
          <button type="submit" style="background:#059669;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:15px;margin-right:10px;">Approve</button>
        </form>
        <form method="POST" action="/ot-requests/${escapeHtml(req.params.token)}/decide" style="display:inline">
          <input type="hidden" name="decision" value="rejected">
          <button type="submit" style="background:#dc2626;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:15px;">Reject</button>
        </form>
      `
    )
  );
});

router.post('/:token/decide', async (req, res) => {
  const { decision } = req.body;
  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).send(page('OT Request', '<p>Invalid decision.</p>'));
  }

  const existing = await pool.query('SELECT id, status, tier_approver FROM ot_requests WHERE token = $1', [req.params.token]);
  const request = existing.rows[0];
  if (!request) {
    return res.status(404).send(page('OT Request', '<p>This link is not valid.</p>'));
  }
  if (request.status !== 'pending') {
    return res.send(page('OT Request', `<p>This request has already been <strong>${escapeHtml(request.status)}</strong>.</p>`));
  }

  await pool.query(
    `UPDATE ot_requests SET status = $1, decided_at = now(), decided_by = $2 WHERE id = $3 AND status = 'pending'`,
    [decision, request.tier_approver, request.id]
  );

  res.send(page('OT Request', `<p>Request <strong>${escapeHtml(decision)}</strong>. Thank you.</p>`));
});

module.exports = router;
