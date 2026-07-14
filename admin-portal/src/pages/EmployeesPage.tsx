import { useEffect, useMemo, useState } from 'react';
import { Search, Users, Filter, RefreshCw, ChevronDown } from 'lucide-react';
import type { Employee } from '../types';
import { getEmployees } from '../data/api';
import { StatusBadge } from '../components/Badges';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('all');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    getEmployees().then((data) => {
      setEmployees(data);
      setLoading(false);
    });
  }, []);

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department).filter((d): d is string => Boolean(d)))).sort();
  }, [employees]);

  const statuses = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.status).filter((s): s is string => Boolean(s)))).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (dept !== 'all' && e.department !== dept) return false;
      if (status !== 'all' && e.status !== status) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          e.emp_id.toLowerCase().includes(q) ||
          (e.cpr ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, dept, status, search]);

  const reload = () => {
    setLoading(true);
    getEmployees().then((data) => {
      setEmployees(data);
      setLoading(false);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Employee Directory</h2>
          <p className="mt-1 text-sm text-slate-500">{filtered.length} of {employees.length} employees</p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee ID, or CPR..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          <div className="relative">
            <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            >
              <option value="all">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-slate-400">
            <Users size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No employees found</p>
            <p className="text-xs">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium">Department</th>
                  <th className="px-6 py-3 font-medium">Designation</th>
                  <th className="px-6 py-3 font-medium">Cost Center</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Nationality</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-3.5">
                      <div>
                        <p className="font-medium text-slate-700">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.emp_id}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">{emp.department || '—'}</td>
                    <td className="px-6 py-3.5 text-slate-600">{emp.designation || '—'}</td>
                    <td className="px-6 py-3.5 text-slate-600">{emp.cost_center || '—'}</td>
                    <td className="px-6 py-3.5"><StatusBadge status={emp.status} /></td>
                    <td className="px-6 py-3.5 text-slate-600">{emp.nationality || '—'}</td>
                    <td className="px-6 py-3.5 text-slate-500">{emp.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
