import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, FileType, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { AttendanceRecord, AttendanceView, ExportFormat } from '../types';
import { exportAttendance, getAttendanceRecords, type AttendanceQuery } from '../data/api';

const VIEWS: { id: AttendanceView; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'employee-wise', label: 'Employee-wise' },
  { id: 'site-wise', label: 'Site-wise' },
];

const EXPORT_FORMATS: { id: ExportFormat; label: string; icon: typeof FileSpreadsheet; color: string }[] = [
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'emerald' },
  { id: 'csv', label: 'CSV', icon: FileText, color: 'blue' },
  { id: 'pdf', label: 'PDF', icon: FileType, color: 'rose' },
];

const COLUMNS: { key: keyof AttendanceRecord; label: string; align?: 'left' | 'center' | 'right' }[] = [
  { key: '#', label: '#', align: 'center' },
  { key: 'EMP ID', label: 'Employee ID' },
  { key: 'CPR', label: 'CPR' },
  { key: 'EMPLOYEE NAME', label: 'Employee Name' },
  { key: 'DESIGNATION', label: 'Designation' },
  { key: 'COST CENTER', label: 'Cost Center' },
  { key: 'ATTENDANCE DATE', label: 'Attendance Date' },
  { key: 'START DATE', label: 'Start Date' },
  { key: 'START TIME', label: 'Start Time' },
  { key: 'END TIME', label: 'End Time' },
  { key: 'END DATE', label: 'End Date' },
  { key: 'T. WORKING H.', label: 'Total Working Hours', align: 'center' },
  { key: 'JOB', label: 'Job' },
  { key: 'PROJECT NAME', label: 'Project Name' },
  { key: 'REMARKS', label: 'Remarks' },
  { key: 'OT ELIGIBLE', label: 'OT Eligible', align: 'center' },
  { key: 'OT', label: 'OT', align: 'center' },
  { key: 'APPROVAL REQUIRED', label: 'Approval Required', align: 'center' },
];

export default function AttendancePage() {
  const [view, setView] = useState<AttendanceView>('daily');
  const [dateInput, setDateInput] = useState('');
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [employeeIdQuery, setEmployeeIdQuery] = useState('');
  const [siteIdInput, setSiteIdInput] = useState('');
  const [siteIdQuery, setSiteIdQuery] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportResult, setExportResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const needsEmployeeId = view === 'employee-wise' && !employeeIdQuery.trim();
  const needsSiteId = view === 'site-wise' && !siteIdQuery.trim();

  const query: AttendanceQuery = {
    view,
    date: dateInput || undefined,
    employeeId: employeeIdQuery || undefined,
    siteId: siteIdQuery || undefined,
  };

  useEffect(() => {
    if (needsEmployeeId || needsSiteId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    getAttendanceRecords(query).then((data) => {
      setRecords(data.map((r, i) => ({ ...r, '#': i + 1 })));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dateInput, employeeIdQuery, siteIdQuery]);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    setExportResult(null);
    const result = await exportAttendance(query, format);
    setExporting(null);
    if (result.ok) {
      setExportResult({ type: 'success', msg: `${format.toUpperCase()} export for ${view} view downloaded.` });
    } else {
      setExportResult({ type: 'error', msg: result.error });
    }
    setTimeout(() => setExportResult(null), 5000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Records</h2>
          <p className="mt-1 text-sm text-slate-500">Confirmation Sheet format — {records.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          {EXPORT_FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            const isLoading = exporting === fmt.id;
            return (
              <button
                key={fmt.id}
                onClick={() => handleExport(fmt.id)}
                disabled={exporting !== null || needsEmployeeId || needsSiteId}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                  fmt.color === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : fmt.color === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                {fmt.label}
              </button>
            );
          })}
        </div>
      </div>

      {exportResult && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            exportResult.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {exportResult.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {exportResult.msg}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        ISO header details (Ref No., Version, Date, Max OT) are embedded automatically in the exported
        Excel/CSV/PDF file — the on-screen list below is plain JSON data and has no header block to show.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                view === v.id ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view === 'daily' && (
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400"
          />
        )}

        {view === 'employee-wise' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEmployeeIdQuery(employeeIdInput);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={employeeIdInput}
              onChange={(e) => setEmployeeIdInput(e.target.value)}
              placeholder="Enter Employee ID"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
            >
              Load
            </button>
          </form>
        )}

        {view === 'site-wise' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSiteIdQuery(siteIdInput);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={siteIdInput}
              onChange={(e) => setSiteIdInput(e.target.value)}
              placeholder="Enter Site (Geofence) ID"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
            >
              Load
            </button>
          </form>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase text-slate-400">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-3 font-medium ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : needsEmployeeId ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-slate-400">
                    Enter an Employee ID above and press Load to view records.
                  </td>
                </tr>
              ) : needsSiteId ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-slate-400">
                    Enter a Site (Geofence) ID above and press Load to view records.
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-slate-400">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr
                    key={`${rec['EMP ID']}-${rec['ATTENDANCE DATE']}-${rec['#']}`}
                    className="transition-colors hover:bg-slate-50"
                  >
                    {COLUMNS.map((col) => (
                      <Cell key={col.key} record={rec} col={col} />
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Cell({
  record,
  col,
}: {
  record: AttendanceRecord;
  col: { key: keyof AttendanceRecord; align?: 'left' | 'center' | 'right' };
}) {
  const value = record[col.key];
  const align = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

  if (col.key === 'OT ELIGIBLE') {
    const isYes = value === 'YES';
    return (
      <td className={`whitespace-nowrap px-3 py-2.5 ${align}`}>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isYes ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {isYes ? 'Yes' : 'No'}
        </span>
      </td>
    );
  }

  if (col.key === 'APPROVAL REQUIRED') {
    const approver = (value as string) || '';
    return (
      <td className={`whitespace-nowrap px-3 py-2.5 ${align}`}>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
            approver ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {approver || 'Not Required'}
        </span>
      </td>
    );
  }

  if (col.key === 'T. WORKING H.' || col.key === 'OT') {
    const isMissing = value === '' || value === undefined || value === null;
    return (
      <td className={`whitespace-nowrap px-3 py-2.5 ${align}`}>
        <span className={`text-xs font-medium ${isMissing ? 'text-rose-500' : 'text-slate-700'}`}>
          {isMissing ? '—' : value}
        </span>
      </td>
    );
  }

  if (col.key === 'REMARKS' && value) {
    return (
      <td className="max-w-[180px] truncate px-3 py-2.5 text-slate-500" title={value as string}>
        {value as string}
      </td>
    );
  }

  return (
    <td className={`whitespace-nowrap px-3 py-2.5 ${align} text-slate-600`}>
      {(value as string | number) || <span className="text-slate-300">—</span>}
    </td>
  );
}
