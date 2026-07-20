const cheerio = require('cheerio');

// Column order matches the Bulk Task Import Excel template exactly (see
// BULK_TEMPLATE_COLUMNS in routes/tasks.js). "Project Name" is present only as a
// human-reference column in the pasted block — it is never read; the real name is
// always looked up from Project Code, same as bulk-import.
const COLUMN_COUNT = 11;
const HEADER_FIRST_CELL = 'employee id';

function decodeHtmlEntities(str) {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

// Extracts rows/cells from the first <table> found in a Teams HTML message body.
// Teams renders a pasted Excel range as a <table>/<tr>/<td> structure; this walks
// it directly via cheerio rather than flattening to plain text first, since
// flattening loses the cell boundaries a tab-based split would otherwise need.
function extractRowsFromHtml(html) {
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (table.length === 0) return null;

  const rows = [];
  table.find('tr').each((_, tr) => {
    const cells = [];
    $(tr)
      .find('td, th')
      .each((__, cell) => {
        cells.push(decodeHtmlEntities($(cell).text()).trim());
      });
    if (cells.length > 0) rows.push(cells);
  });

  return rows.length > 0 ? rows : null;
}

// Fallback for a plain-text paste (Teams sent as contentType 'text', or an HTML
// message with no <table> — e.g. some clients paste as a bare tab-separated block).
function extractRowsFromPlainText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows = lines
    .map((line) => line.split('\t').map((c) => c.trim()))
    .filter((cells) => cells.length > 1);

  return rows.length > 0 ? rows : null;
}

function stripHeaderRow(rows) {
  if (rows.length > 0 && (rows[0][0] || '').trim().toLowerCase() === HEADER_FIRST_CELL) {
    return rows.slice(1);
  }
  return rows;
}

// Pads/truncates a raw cell row to the expected column count and maps it to the
// named fields createTaskRowsFromFields expects, skipping the ignored Project Name
// column (index 3).
function rowToFields(cells) {
  const c = [...cells];
  while (c.length < COLUMN_COUNT) c.push('');

  return {
    empId: c[0],
    taskDate: c[1],
    projectCodeRaw: c[2],
    // c[3] = Project Name — intentionally ignored
    location: c[4],
    description: c[5],
    priorityRaw: c[6],
    startTimeRaw: c[7],
    endTimeRaw: c[8],
    remarks: c[9],
    daysRaw: c[10],
  };
}

// Parses a Teams message body into an ordered list of task-row field objects.
// Returns null if the message doesn't look like a task paste at all (no table, no
// multi-column plain text) so the caller can silently ignore ordinary chat messages.
function parseTaskRows(rawBody, isHtml) {
  const rawRows = isHtml ? extractRowsFromHtml(rawBody) : extractRowsFromPlainText(rawBody);
  if (!rawRows) return null;

  const dataRows = stripHeaderRow(rawRows);
  if (dataRows.length === 0) return null;

  return dataRows.map(rowToFields);
}

module.exports = { parseTaskRows, extractRowsFromHtml, extractRowsFromPlainText };
