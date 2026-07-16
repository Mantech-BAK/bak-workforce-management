const cron = require('node-cron');

const pool = require('../config/db');
const { getChannelMessages, getUserEmail, replyToMessage } = require('../services/graphClient');
const { parseTaskTemplate } = require('../services/teamsTaskParser');

const TEAM_ID = process.env.TEAMS_TEAM_ID;
const CHANNEL_ID = process.env.TEAMS_CHANNEL_ID;
const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];

async function getSetting(key) {
  const { rows } = await pool.query('SELECT value FROM sync_settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO sync_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}

async function processOneMessage(message, authorizedSender, summary) {
  const userId = message.from?.user?.id;
  if (!userId) {
    summary.ignoredSender += 1;
    return;
  }

  const senderEmail = await getUserEmail(userId);
  if (!senderEmail || senderEmail !== authorizedSender.toLowerCase()) {
    summary.ignoredSender += 1;
    return;
  }

  const bodyContent = message.body?.content || '';
  const isHtml = message.body?.contentType === 'html';
  const parsed = parseTaskTemplate(bodyContent, isHtml);
  if (!parsed.matchesTemplate) {
    summary.ignoredTemplate += 1;
    return;
  }

  const { date, empId, location, description, priority, remarks } = parsed.fields;
  const errors = [];

  let employee = null;
  if (!empId) {
    errors.push('Employee ID is empty');
  } else {
    const empResult = await pool.query('SELECT id, emp_id FROM employees WHERE emp_id = $1 AND status = $2', [
      empId,
      'active',
    ]);
    employee = empResult.rows[0] || null;
    if (!employee) errors.push(`Employee ID '${empId}' not found or not active`);
  }

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date).getTime());
  if (!dateValid) {
    errors.push(`Invalid date '${date}' (expected YYYY-MM-DD)`);
  }

  if (!description) {
    errors.push('Task Description is empty');
  }

  const normalizedPriority = (priority || '').toLowerCase();
  if (!ALLOWED_PRIORITIES.includes(normalizedPriority)) {
    errors.push(`Invalid priority '${priority}' (expected low, medium, or high)`);
  }

  if (employee && dateValid) {
    const existing = await pool.query('SELECT id FROM tasks WHERE emp_id = $1 AND task_date = $2', [empId, date]);
    if (existing.rows[0]) {
      errors.push(`A task already exists for employee '${empId}' on ${date}`);
    }
  }

  if (errors.length > 0) {
    await pool.query('INSERT INTO exceptions (type, emp_id, ref_table, ref_id, details) VALUES ($1, $2, $3, $4, $5)', [
      'teams_task_validation_failed',
      empId || null,
      employee ? 'employees' : null,
      employee ? employee.id : null,
      errors.join('; '),
    ]);
    summary.failed += 1;

    await replyToMessage(TEAM_ID, CHANNEL_ID, message.id, `Task could not be created: ${errors.join('; ')}`).catch(
      (err) => console.error('teamsTaskProcessor: failed to post reply', err.message)
    );

    return;
  }

  await pool.query(
    `INSERT INTO tasks (emp_id, task_date, location, description, priority, remarks, source, teams_message_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'teams', $7)`,
    [empId, date, location || null, description, normalizedPriority, remarks || null, message.id]
  );
  summary.created += 1;
}

async function processTeamsTasks() {
  const summary = { fetched: 0, ignoredSender: 0, ignoredTemplate: 0, created: 0, failed: 0 };

  const authorizedSender = await getSetting('teams_authorized_sender');
  if (!authorizedSender) {
    console.error('teamsTaskProcessor: teams_authorized_sender not configured in sync_settings, skipping run');
    return summary;
  }

  const lastProcessedTimeRaw = await getSetting('lastProcessedTime');
  const since = lastProcessedTimeRaw ? new Date(lastProcessedTimeRaw) : new Date(Date.now() - 24 * 3600 * 1000);
  const runStartedAt = new Date();

  let messages;
  try {
    messages = await getChannelMessages(TEAM_ID, CHANNEL_ID);
  } catch (err) {
    console.error('teamsTaskProcessor: failed to fetch channel messages', err.message);
    return summary;
  }

  const relevant = messages
    .filter((m) => m.messageType === 'message' && !m.deletedDateTime)
    .filter((m) => m.createdDateTime && new Date(m.createdDateTime) > since)
    .sort((a, b) => new Date(a.createdDateTime) - new Date(b.createdDateTime));

  summary.fetched = relevant.length;

  for (const message of relevant) {
    try {
      await processOneMessage(message, authorizedSender, summary);
    } catch (err) {
      console.error(`teamsTaskProcessor: error processing message ${message.id}`, err.message);
      summary.failed += 1;
    }
  }

  await setSetting('lastProcessedTime', runStartedAt.toISOString());
  return summary;
}

function start() {
  cron.schedule('*/5 * * * *', () => {
    processTeamsTasks().catch((err) => console.error('teamsTaskProcessor: run failed', err));
  });
}

module.exports = { processTeamsTasks, start };
