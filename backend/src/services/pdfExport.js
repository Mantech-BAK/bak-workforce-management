const PDFDocument = require('pdfkit');
const { REPORT_COLUMNS } = require('./attendanceReport');

const COLUMN_WIDTHS = {
  '#': 24,
  'EMP ID': 50,
  CPR: 55,
  'EMPLOYEE NAME': 100,
  DESIGNATION: 75,
  'COST CENTER': 60,
  'ATTENDANCE DATE': 60,
  'START DATE': 55,
  'START TIME': 45,
  'END TIME': 45,
  'END DATE': 55,
  'T. WORKING H.': 45,
  JOB: 70,
  'PROJECT NAME': 90,
  REMARKS: 90,
  'OT ELIGIBLE': 45,
  OT: 30,
  'APPROVAL REQUIRED': 70,
};

function buildPdfBuffer(rows, meta) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 24, size: 'A3', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const rowHeight = 16;

    doc.fontSize(9).font('Helvetica-Bold');
    [
      ['ISO REF. NO.', meta.isoRefNo],
      ['ISO VERSION', meta.isoVersion],
      ['ISO DATE', meta.isoDate],
      ['MAX OT', meta.maxOt],
    ].forEach(([label, value]) => {
      doc.text(`${label}: `, left, doc.y, { continued: true }).font('Helvetica').text(String(value));
      doc.font('Helvetica-Bold');
    });
    doc.moveDown(0.5);

    function drawHeaderRow() {
      let x = left;
      const y = doc.y;
      doc.fontSize(7).font('Helvetica-Bold');
      REPORT_COLUMNS.forEach((col) => {
        const width = COLUMN_WIDTHS[col];
        doc.rect(x, y, width, rowHeight).stroke();
        doc.text(col, x + 2, y + 4, { width: width - 4, height: rowHeight, ellipsis: true });
        x += width;
      });
      doc.y = y + rowHeight;
    }

    function ensureSpace() {
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ margin: 24, size: 'A3', layout: 'landscape' });
        drawHeaderRow();
      }
    }

    drawHeaderRow();
    doc.font('Helvetica').fontSize(7);

    rows.forEach((row) => {
      ensureSpace();
      let x = left;
      const y = doc.y;
      REPORT_COLUMNS.forEach((col) => {
        const width = COLUMN_WIDTHS[col];
        doc.rect(x, y, width, rowHeight).stroke();
        doc.text(String(row[col] ?? ''), x + 2, y + 4, { width: width - 4, height: rowHeight, ellipsis: true });
        x += width;
      });
      doc.y = y + rowHeight;
    });

    doc.end();
  });
}

module.exports = { buildPdfBuffer };
