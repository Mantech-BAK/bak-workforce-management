require('dotenv').config();

const cron = require('node-cron');

const { syncEmployees } = require('./jobs/syncEmployees');
const { syncAttendance } = require('./jobs/syncAttendance');

async function runSync() {
  console.log(`[${new Date().toISOString()}] zk-middleware: sync run starting`);

  try {
    const employeeSummary = await syncEmployees();
    console.log('zk-middleware: employee sync summary', JSON.stringify(employeeSummary));
  } catch (err) {
    console.error('zk-middleware: employee sync failed', err);
  }

  try {
    const attendanceSummary = await syncAttendance();
    console.log('zk-middleware: attendance sync summary', JSON.stringify(attendanceSummary));
  } catch (err) {
    console.error('zk-middleware: attendance sync failed', err);
  }

  console.log(`[${new Date().toISOString()}] zk-middleware: sync run finished`);
}

runSync().catch((err) => console.error('zk-middleware: initial sync run failed', err));

cron.schedule('*/15 * * * *', () => {
  runSync().catch((err) => console.error('zk-middleware: scheduled sync run failed', err));
});

console.log('zk-middleware: scheduled to run every 15 minutes');
