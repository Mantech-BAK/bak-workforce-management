import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckSquare, ChevronDown, Plus, RefreshCw, Search, X } from 'lucide-react';
import type { Employee, Task } from '../types';
import { createTask, getEmployees, getTasks } from '../data/api';

const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SourceBadge({ source }: { source: string | null }) {
  const s = (source || '').toLowerCase();
  if (s === 'teams') {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
        Teams
      </span>
    );
  }
  if (s === 'admin_portal') {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Admin Portal
      </span>
    );
  }
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {source ? capitalize(source) : 'Unknown'}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string | null }) {
  const p = (priority || '').toLowerCase();
  const style =
    p === 'high'
      ? 'bg-rose-50 text-rose-700'
      : p === 'low'
        ? 'bg-slate-100 text-slate-600'
        : p === 'medium'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {priority || '—'}
    </span>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const style =
    s === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : s === 'cancelled'
        ? 'bg-slate-100 text-slate-500'
        : 'bg-amber-50 text-amber-700';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface AddTaskModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddTaskModal({ onClose, onCreated }: AddTaskModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [taskDate, setTaskDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getEmployees().then(setEmployees);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowEmployeeList(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeEmployees = useMemo(() => employees.filter((e) => (e.status || '').toLowerCase() === 'active'), [employees]);

  const matches = useMemo(() => {
    if (!employeeQuery.trim()) return activeEmployees.slice(0, 20);
    const q = employeeQuery.toLowerCase();
    return activeEmployees.filter((e) => e.name.toLowerCase().includes(q) || e.emp_id.toLowerCase().includes(q)).slice(0, 20);
  }, [activeEmployees, employeeQuery]);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmployeeQuery(`${emp.name} (${emp.emp_id})`);
    setShowEmployeeList(false);
    setFieldErrors((prev) => ({ ...prev, employee: '' }));
  };

  const handleEmployeeQueryChange = (value: string) => {
    setEmployeeQuery(value);
    setSelectedEmployee(null);
    setShowEmployeeList(true);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!selectedEmployee) errors.employee = 'Select an employee from the list.';
    if (!taskDate) errors.taskDate = 'Date is required.';
    if (!description.trim()) errors.description = 'Description is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!validate() || !selectedEmployee) return;

    setSubmitting(true);
    const result = await createTask({
      emp_id: selectedEmployee.emp_id,
      task_date: taskDate,
      location: location.trim() || undefined,
      description: description.trim(),
      priority: priority || undefined,
      remarks: remarks.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Add Task</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {serverError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={16} /> {serverError}
          </div>
        )}

        <div className="space-y-4">
          <div ref={containerRef} className="relative">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Employee</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={employeeQuery}
                onChange={(e) => handleEmployeeQueryChange(e.target.value)}
                onFocus={() => setShowEmployeeList(true)}
                placeholder="Search by name or employee ID..."
                className={`w-full rounded-lg border bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:bg-white ${
                  fieldErrors.employee ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-emerald-400'
                }`}
              />
            </div>
            {showEmployeeList && matches.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {matches.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectEmployee(emp)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{emp.name}</span>
                    <span className="text-xs text-slate-400">{emp.emp_id} · {emp.department || '—'}</span>
                  </button>
                ))}
              </div>
            )}
            {fieldErrors.employee && <p className="mt-1 text-xs text-rose-600">{fieldErrors.employee}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Date</label>
            <input
              type="date"
              value={taskDate}
              onChange={(e) => {
                setTaskDate(e.target.value);
                setFieldErrors((prev) => ({ ...prev, taskDate: '' }));
              }}
              className={`w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:bg-white ${
                fieldErrors.taskDate ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-emerald-400'
              }`}
            />
            {fieldErrors.taskDate && <p className="mt-1 text-xs text-rose-600">{fieldErrors.taskDate}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFieldErrors((prev) => ({ ...prev, description: '' }));
              }}
              rows={3}
              className={`w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:bg-white ${
                fieldErrors.description ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-emerald-400'
              }`}
            />
            {fieldErrors.description && <p className="mt-1 text-xs text-rose-600">{fieldErrors.description}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Priority</label>
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
              >
                <option value="">No priority</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{capitalize(p)}</option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    getTasks({
      date: dateFilter || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }).then((data) => {
      setTasks(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, statusFilter]);

  const statuses = useMemo(() => Array.from(new Set(tasks.map((t) => t.status))).sort(), [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Tasks</h2>
          <p className="mt-1 text-sm text-slate-500">{tasks.length} tasks matching current filters</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            <Plus size={15} /> Add Task
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              Clear date
            </button>
          )}

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            >
              <option value="all">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s} className="capitalize">{capitalize(s)}</option>
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
        ) : tasks.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-slate-400">
            <CheckSquare size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No tasks found</p>
            <p className="text-xs">Try adjusting your filters, or add a new task</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Location</th>
                  <th className="px-6 py-3 font-medium">Priority</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tasks.map((task) => (
                  <tr key={task.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-slate-700">{task.employee_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{task.emp_id}</p>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">{formatDate(task.task_date)}</td>
                    <td className="max-w-xs truncate px-6 py-3.5 text-slate-500" title={task.description ?? ''}>
                      {task.description || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{task.location || '—'}</td>
                    <td className="px-6 py-3.5"><PriorityBadge priority={task.priority} /></td>
                    <td className="px-6 py-3.5"><TaskStatusBadge status={task.status} /></td>
                    <td className="px-6 py-3.5"><SourceBadge source={task.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onCreated={load} />}
    </div>
  );
}
