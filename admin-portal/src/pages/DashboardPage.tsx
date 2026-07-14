import { useEffect, useState } from 'react';
import { Users, MapPin, MapPinOff, WifiOff, Clock, Activity } from 'lucide-react';
import type { DashboardStats, Employee } from '../types';
import { computeStats, getEmployees } from '../data/api';
import StatCard from '../components/StatCard';
import { AttendanceBadge, GpsBadge, formatRelative } from '../components/Badges';

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

  const total = employees.length;
  const gpsActive = stats.insideGeofence + stats.outsideGeofence;
  const gpsActivePct = total > 0 ? Math.round((gpsActive / total) * 100) : 0;
  const compliancePct = total > 0 ? Math.round(((total - stats.missingPunchOut) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Workforce Overview</h2>
        <p className="mt-1 text-sm text-slate-500">
          Real-time snapshot of your field workforce —{' '}
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active Employees" value={stats.activeEmployees} icon={Users} color="emerald" trend="+2 this week" trendUp />
        <StatCard label="Inside Geofence" value={stats.insideGeofence} icon={MapPin} color="blue" trend={`${gpsActivePct}% GPS active`} trendUp />
        <StatCard label="Outside Geofence" value={stats.outsideGeofence} icon={MapPinOff} color="amber" trend="Review needed" />
        <StatCard label="GPS Disabled" value={stats.gpsDisabled} icon={WifiOff} color="rose" trend="Action required" />
        <StatCard label="Missing Punch-Out" value={stats.missingPunchOut} icon={Clock} color="orange" trend={`${compliancePct}% compliance`} trendUp={compliancePct >= 90} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Activity size={16} className="text-emerald-500" /> GPS Status Distribution
            </h3>
            <span className="text-xs text-slate-400">{total} employees</span>
          </div>
          <div className="space-y-4">
            <StatusBar label="Inside Geofence" value={stats.insideGeofence} total={total} color="bg-blue-500" />
            <StatusBar label="Outside Geofence" value={stats.outsideGeofence} total={total} color="bg-amber-500" />
            <StatusBar label="GPS Disabled" value={stats.gpsDisabled} total={total} color="bg-rose-500" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Attendance Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
              <span className="text-sm font-medium text-emerald-700">Clocked In</span>
              <span className="text-lg font-bold text-emerald-700">{employees.filter((e) => e.attendance === 'clocked_in').length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">Clocked Out</span>
              <span className="text-lg font-bold text-slate-600">{employees.filter((e) => e.attendance === 'clocked_out').length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-orange-50 px-4 py-3">
              <span className="text-sm font-medium text-orange-700">Missing Punch-Out</span>
              <span className="text-lg font-bold text-orange-700">{stats.missingPunchOut}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Recently Active Employees</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <th className="pb-2 font-medium">Employee</th>
                <th className="pb-2 font-medium">Department</th>
                <th className="pb-2 font-medium">GPS</th>
                <th className="pb-2 font-medium">Attendance</th>
                <th className="pb-2 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...employees]
                .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
                .slice(0, 6)
                .map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-3">
                        <img src={emp.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        <div>
                          <p className="font-medium text-slate-700">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-600">{emp.department}</td>
                    <td className="py-2.5"><GpsBadge state={emp.gps} /></td>
                    <td className="py-2.5"><AttendanceBadge state={emp.attendance} /></td>
                    <td className="py-2.5 text-slate-500">{formatRelative(emp.lastSeen)}</td>
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
