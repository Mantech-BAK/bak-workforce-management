import { useEffect, useState } from 'react';
import { Users, UserCheck, Clock3, Building2, Activity } from 'lucide-react';
import type { DashboardStats, Employee } from '../types';
import { computeStats, getEmployees } from '../data/api';
import StatCard from '../components/StatCard';
import { StatusBadge, formatRelative } from '../components/Badges';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployees().then((data) => {
      setEmployees(data);
      setStats(computeStats(data));
      setLoading(false);
    });
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
      </div>
    );
  }

  const activePct = stats.totalEmployees > 0 ? Math.round((stats.activeEmployees / stats.totalEmployees) * 100) : 0;
  const otPct = stats.totalEmployees > 0 ? Math.round((stats.otEligible / stats.totalEmployees) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Workforce Overview</h2>
        <p className="mt-1 text-sm text-slate-500">
          Real-time snapshot of your field workforce —{' '}
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Employees" value={stats.totalEmployees} icon={Users} color="blue" />
        <StatCard label="Active Employees" value={stats.activeEmployees} icon={UserCheck} color="emerald" trend={`${activePct}% of workforce`} trendUp />
        <StatCard label="OT Eligible" value={stats.otEligible} icon={Clock3} color="amber" trend={`${otPct}% of workforce`} />
        <StatCard label="Departments" value={stats.departmentCounts.length} icon={Building2} color="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Activity size={16} className="text-emerald-500" /> Employees by Department
            </h3>
            <span className="text-xs text-slate-400">{stats.totalEmployees} employees</span>
          </div>
          <div className="space-y-4">
            {stats.departmentCounts.slice(0, 6).map((d) => (
              <StatusBar key={d.department} label={d.department} value={d.count} total={stats.totalEmployees} color="bg-blue-500" />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Employees by Status</h3>
          <div className="space-y-3">
            {stats.statusCounts.map((s) => (
              <div key={s.status} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <StatusBadge status={s.status} />
                <span className="text-lg font-bold text-slate-700">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Recently Added Employees</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <th className="pb-2 font-medium">Employee</th>
                <th className="pb-2 font-medium">Department</th>
                <th className="pb-2 font-medium">Designation</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...employees]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 6)
                .map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="py-2.5">
                      <div>
                        <p className="font-medium text-slate-700">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.emp_id}</p>
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-600">{emp.department || '—'}</td>
                    <td className="py-2.5 text-slate-600">{emp.designation || '—'}</td>
                    <td className="py-2.5"><StatusBadge status={emp.status} /></td>
                    <td className="py-2.5 text-slate-500">{formatRelative(emp.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="text-slate-400">{value} ({Math.round(pct)}%)</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
