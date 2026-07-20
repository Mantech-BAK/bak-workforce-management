const cron = require('node-cron');

const pool = require('../config/db');
const { getChannelMessages, getUserEmail, replyToMessage } = require('../services/graphClient');
const { parseTaskRows } = require('../services/teamsTaskParser');
const { createTaskRowsFromFields } = require('../services/taskRowValidation');

const TEAM_ID = process.env.TEAMS_TEAM_ID;
const CHANNEL_ID = process.env.TEAMS_CHANNEL_ID;

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

function buildFailureReply(failed) {
  const lines = failed.map((f) => `Row ${f.row}: ${f.reason}`);
  return `${failed.length} row${failed.length === 1 ? '' : 's'} could not be imported:\n${lines.join('\n')}`;
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
  const rows = parseTaskRows(bodyContent, isHtml);
  if (!rows) {
    summary.ignoredNotAPaste += 1;
    return;
  }

  summary.rowsTotal += rows.length;
  const failed = [];

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1;
    try {
      await createTaskRowsFromFields(rows[i], 'teams', message.id);
      summary.rowsSucceeded += 1;
    } catch (err) {
      failed.push({ row: rowNumber, reason: err.message });
      await pool.query('INSERT INTO exceptions (type, emp_id, details) VALUES ($1, $2, $3)', [
        'teams_task_validation_failed',
        rows[i].empId || null,
        `Row ${rowNumber}: ${err.message}`,
      ]);
    }
  }

  summary.rowsFailed += failed.length;

  if (failed.length > 0) {
    await replyToMessage(TEAM_ID, CHANNEL_ID, message.id, buildFailureReply(failed)).catch((err) =>
      console.error('teamsTaskProcessor: failed to post reply', err.message)
    );
  }
}

async function processTeamsTasks() {
  const summary = {
    fetched: 0,
    ignoredSender: 0,
    ignoredNotAPaste: 0,
    rowsTotal: 0,
    rowsSucceeded: 0,
    rowsFailed: 0,
  };

  const authorizedSender = await getSetting('teams_authorized_sender');
  if (!authorizedSender) {
    console.error('teamsTaskProcessor: teams_authorized_sender not configured in sync_settings, skipping run');
    return summary;
  }

  // Keyed to the channel ID rather than a single global 'lastProcessedTime': switching
  // TEAMS_CHANNEL_ID to a different channel then automatically starts fresh (no old
  // watermark to falsely suppress that channel's older messages), and switching back
  // to a previously-watched channel resumes from where it left off instead of
  // re-processing everything since a stale 24h-ago fallback.
  const watermarkKey = `lastProcessedTime:${CHANNEL_ID}`;
  const lastProcessedTimeRaw = await getSetting(watermarkKey);
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
    }
  }

  await setSetting(watermarkKey, runStartedAt.toISOString());
  return summary;
}

function start() {
  cron.schedule('*/5 * * * *', () => {
    processTeamsTasks().catch((err) => console.error('teamsTaskProcessor: run failed', err));
  });
}

module.exports = { processTeamsTasks, start };
