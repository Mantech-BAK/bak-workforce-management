import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { Employee, Exception, TaskReport } from '../types';
import { getExceptions, getTaskReport } from '../data/api';
import EmployeeSelect from '../components/EmployeeSelect';
import StatCard from '../components/StatCard';

function formatTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function TypeBadge({ type }: { type: string }) {
  const t = type.toLowerCase();
  let style = 'bg-slate-100 text-slate-600';
  if (t === 'face_match_failed') {
    style = 'bg-rose-50 text-rose-700';
  } else if (t.includes('geofence') || t.includes('gps')) {
    style = 'bg-orange-50 text-orange-700';
  }
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {formatTypeLabel(type)}
    </span>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function TaskCompletionReport() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [from, setFrom] = useState(todayString());
  const [to, setTo] = useState(todayString());
  const [report, setReport] = useState<TaskReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employee || !from || !to) {
      setReport(null);
      return;
    }
    setLoading(true);
    getTaskReport(employee.emp_id, from, to).then((data) => {
      setReport(data);
      setLoading(false);
    });
  }, [employee, from, to]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">Task Completion Report</h3>
      <p className="mt-1 text-sm text-slate-500">Completed vs. cannot-complete counts for an employee over a date range.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <EmployeeSelect value={employee} onChange={setEmployee} />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
        />
      </div>

      {!employee ? (
        <p className="mt-6 text-sm text-slate-400">Select an employee to see their task completion counts.</p>
      ) : loading ? (
        <div className="mt-6 flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="Completed" value={report?.completed ?? 0} icon={CheckCircle2} color="emerald" />
          <StatCard label="Cannot Complete" value={report?.cannot_complete ?? 0} icon={XCircle} color="rose" />
        </div>
      )}
    </div>
  );
}

function DailyExceptionsReport() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [date, setDate] = useState(todayString());
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employee || !date) {
      setExceptions([]);
      return;
    }
    setLoading(true);
    getExceptions({ empId: employee.emp_id, date }).then((data) => {
      setExceptions(data);
      setLoading(false);
    });
  }, [employee, date]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">Daily Exceptions Report</h3>
      <p className="mt-1 text-sm text-slate-500">Every exception an employee triggered on a specific date.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <EmployeeSelect value={employee} onChange={setEmployee} />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
        />
      </div>

      {!employee ? (
        <p className="mt-6 text-sm text-slate-400">Select an employee to see their exceptions for that day.</p>
      ) : loading ? (
        <div className="mt-6 flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      ) : exceptions.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-slate-400">
          <CheckCircle2 size={32} className="mb-2 opacity-40" />
          <p className="text-sm font-medium">No exceptions on this date</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Details</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {exceptions.map((ex) => (
                <tr key={ex.id}>
                  <td className="px-4 py-2.5"><TypeBadge type={ex.type} /></td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-slate-500" title={ex.details ?? ''}>{ex.details || '—'}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-600">{ex.status}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDateTime(ex.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Reports</h2>
        <p className="mt-1 text-sm text-slate-500">Per-employee task and exception reporting.</p>
      </div>

      {!import.meta.env.VITE_API_BASE_URL && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle size={16} /> No API configured — reports require a live backend connection.
        </div>
      )}

      <TaskCompletionReport />
      <DailyExceptionsReport />
    </div>
  );
}
