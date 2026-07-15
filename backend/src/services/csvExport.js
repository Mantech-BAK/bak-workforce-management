const { REPORT_COLUMNS } = require('./attendanceReport');

function escapeCsv(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows, meta) {
  const lines = [];

  lines.push(`ISO REF. NO.,${escapeCsv(meta.isoRefNo)}`);
  lines.push(`ISO VERSION,${escapeCsv(meta.isoVersion)}`);
  lines.push(`ISO DATE,${escapeCsv(meta.isoDate)}`);
  lines.push(`MAX OT,${escapeCsv(meta.maxOt)}`);
  lines.push('');

  lines.push(REPORT_COLUMNS.map(escapeCsv).join(','));
  rows.forEach((row) => {
    lines.push(REPORT_COLUMNS.map((col) => escapeCsv(row[col])).join(','));
  });

  return lines.join('\r\n');
}

module.exports = { buildCsv };
