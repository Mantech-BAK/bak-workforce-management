const ExcelJS = require('exceljs');
const { REPORT_COLUMNS } = require('./attendanceReport');

async function buildExcelBuffer(rows, meta) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');

  const lastCol = REPORT_COLUMNS.length;

  sheet.mergeCells(1, 1, 1, 2);
  sheet.getCell(1, 1).value = 'ISO REF. NO.';
  sheet.mergeCells(1, 3, 1, lastCol);
  sheet.getCell(1, 3).value = meta.isoRefNo;

  sheet.mergeCells(2, 1, 2, 2);
  sheet.getCell(2, 1).value = 'ISO VERSION';
  sheet.mergeCells(2, 3, 2, lastCol);
  sheet.getCell(2, 3).value = meta.isoVersion;

  sheet.mergeCells(3, 1, 3, 2);
  sheet.getCell(3, 1).value = 'ISO DATE';
  sheet.mergeCells(3, 3, 3, lastCol);
  sheet.getCell(3, 3).value = meta.isoDate;

  sheet.mergeCells(4, 1, 4, 2);
  sheet.getCell(4, 1).value = 'MAX OT';
  sheet.mergeCells(4, 3, 4, lastCol);
  sheet.getCell(4, 3).value = meta.maxOt;

  for (let r = 1; r <= 4; r += 1) {
    sheet.getCell(r, 1).font = { bold: true };
  }

  const headerRowIndex = 6;
  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.values = REPORT_COLUMNS;
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  rows.forEach((row, idx) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + idx);
    excelRow.values = REPORT_COLUMNS.map((col) => row[col]);
  });

  sheet.columns.forEach((col, idx) => {
    const header = REPORT_COLUMNS[idx];
    col.width = header === '#' ? 5 : Math.max(header.length + 2, 14);
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildExcelBuffer };
