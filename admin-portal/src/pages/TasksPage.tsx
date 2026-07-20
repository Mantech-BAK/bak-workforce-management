import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckSquare, ChevronDown, FileSpreadsheet, Pencil, Plus, RefreshCw, Search, Upload, X } from 'lucide-react';
import type { Employee, Project, Task } from '../types';
import {
  type BulkImportResult,
  createTask,
  getEmployees,
  getTasks,
  importTasksBulk,
  updateTask,
} from '../data/api';
import ProjectSelect from '../components/ProjectSelect';

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
      : s === 'cannot_complete'
        ? 'bg-rose-50 text-rose-700'
        : s === 'cancelled'
          ? 'bg-slate-100 text-slate-500'
          : 'bg-amber-50 text-amber-700';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const short = (t: string) => t.slice(0, 5);
  if (start && end) return `${short(start)}–${short(end)}`;
  return short(start || end || '');
}

const fieldClass = (hasError: boolean) =>
  `w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:bg-white ${
    hasError ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-emerald-400'
  }`;

interface TaskModalProps {
  task?: Task;
  onClose: () => void;
  onSaved: () => void;
}

function TaskModal({ task, onClose, onSaved }: TaskModalProps) {
  const isEdit = Boolean(task);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState(task ? `${task.employee_name ?? task.emp_id} (${task.emp_id})` : '');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    task ? { project_code: task.project_code, project_name: task.project_name ?? `Project ${task.project_code}`, project_company_name: null } : null
  );
  const [taskDate, setTaskDate] = useState(task?.task_date.slice(0, 10) ?? '');
  const [days, setDays] = useState('1');
  const [startTime, setStartTime] = useState(task?.start_time?.slice(0, 5) ?? '');
  const [endTime, setEndTime] = useState(task?.end_time?.slice(0, 5) ?? '');
  const [location, setLocation] = useState(task?.location ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState(task?.priority ?? '');
  const [remarks, setRemarks] = useState(task?.remarks ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isEdit) getEmployees().then(setEmployees);
  }, [isEdit]);

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
    if (!isEdit && !selectedEmployee) errors.employee = 'Select an employee from the list.';
    if (!selectedProject) errors.project = 'Select a project from the list.';
    if (!description.trim()) errors.description = 'Description is required.';
    if (!isEdit) {
      const numDays = Number(days);
      if (!Number.isInteger(numDays) || numDays < 1) errors.days = 'Days must be a positive whole number.';
    }
    if (startTime && endTime && endTime <= startTime) errors.endTime = 'End time must be after start time.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    // submittingRef is a synchronous guard: setSubmitting(true) below doesn't take
    // effect (re-rendering the button as disabled) until the next commit, leaving a
    // window where a second click event can re-enter this handler before React
    // catches up. The ref is set immediately, closing that window.
    if (submittingRef.current) return;
    submittingRef.current = true;

    setServerError(null);
    if (!validate()) {
      submittingRef.current = false;
      return;
    }

    setSubmitting(true);
    const result = isEdit
      ? await updateTask(task!.id, {
          task_date: taskDate || undefined,
          project_code: selectedProject!.project_code,
          start_time: startTime || undefined,
          end_time: endTime || undefined,
          location: location.trim() || undefined,
          description: description.trim(),
          priority: priority || undefined,
          remarks: remarks.trim() || undefined,
        })
      : await createTask({
          emp_id: selectedEmployee!.emp_id,
          project_code: selectedProject!.project_code,
          days: Number(days),
          start_time: startTime || undefined,
          end_time: endTime || undefined,
          location: location.trim() || undefined,
          description: description.trim(),
          priority: priority || undefined,
          remarks: remarks.trim() || undefined,
        });
    setSubmitting(false);
    submittingRef.current = false;

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">{isEdit ? 'Edit Task' : 'Add Task'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {serverError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={16} /> {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div ref={containerRef} className="relative sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Employee</label>
            {isEdit ? (
              <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500">
                {employeeQuery}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={employeeQuery}
                    onChange={(e) => handleEmployeeQueryChange(e.target.value)}
                    onFocus={() => setShowEmployeeList(true)}
                    placeholder="Search by name or employee ID..."
                    className={`${fieldClass(Boolean(fieldErrors.employee))} pl-9`}
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
              </>
            )}
            {fieldErrors.employee && <p className="mt-1 text-xs text-rose-600">{fieldErrors.employee}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Project</label>
            <ProjectSelect
              value={selectedProject}
              onChange={(p) => {
                setSelectedProject(p);
                setFieldErrors((prev) => ({ ...prev, project: '' }));
              }}
              hasError={Boolean(fieldErrors.project)}
            />
            {fieldErrors.project && <p className="mt-1 text-xs text-rose-600">{fieldErrors.project}</p>}
          </div>

          {isEdit ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Date</label>
              <input
                type="date"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                className={fieldClass(false)}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Date</label>
              <input
                type="date"
                value={todayString()}
                disabled
                className={`${fieldClass(false)} cursor-not-allowed bg-slate-100 text-slate-500`}
              />
            </div>
          )}

          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Repeat for how many days</label>
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, days: '' }));
                }}
                className={fieldClass(Boolean(fieldErrors.days))}
              />
              {fieldErrors.days && <p className="mt-1 text-xs text-rose-600">{fieldErrors.days}</p>}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Priority</label>
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={`${fieldClass(false)} appearance-none pr-9`}
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
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setFieldErrors((prev) => ({ ...prev, endTime: '' }));
              }}
              className={fieldClass(false)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setFieldErrors((prev) => ({ ...prev, endTime: '' }));
              }}
              className={fieldClass(Boolean(fieldErrors.endTime))}
            />
            {fieldErrors.endTime && <p className="mt-1 text-xs text-rose-600">{fieldErrors.endTime}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
              className={fieldClass(false)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFieldErrors((prev) => ({ ...prev, description: '' }));
              }}
              rows={2}
              className={fieldClass(Boolean(fieldErrors.description))}
            />
            {fieldErrors.description && <p className="mt-1 text-xs text-rose-600">{fieldErrors.description}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Optional"
              className={fieldClass(false)}
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
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface BulkImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

function BulkImportModal({ onClose, onImported }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    const res = await importTasksBulk(file);
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.result);
    if (res.result.succeeded > 0) onImported();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Import Tasks from Excel</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <p className="mb-4 text-sm text-slate-500">
          Use the Bulk Task Import Excel template distributed to admins. Fill in the yellow cells, leave the
          locked Task Date and Project Name cells as-is, then upload it below.
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Excel File</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
          />
        </div>

        {result && (
          <div className="mb-4 space-y-3">
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {result.succeeded} of {result.total} row{result.total === 1 ? '' : 's'} imported successfully.
            </div>
            {result.failed.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-rose-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-50 text-rose-700">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {result.failed.map((f) => (
                      <tr key={f.row}>
                        <td className="px-3 py-2 font-medium text-slate-600">{f.row}</td>
                        <td className="px-3 py-2 text-slate-600">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={!file || uploading}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            <Upload size={15} /> {uploading ? 'Importing...' : 'Import'}
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <FileSpreadsheet size={15} /> Import from Excel
          </button>
          <button
            onClick={() => setShowAddModal(true)}
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
                <option key={s} value={s} className="capitalize">{capitalize(s.replace(/_/g, ' '))}</option>
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
                  <th className="px-6 py-3 font-medium">Project</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Location</th>
                  <th className="px-6 py-3 font-medium">Priority</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tasks.map((task) => (
                  <tr key={task.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-slate-700">{task.employee_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{task.emp_id}</p>
                    </td>
                    <td className="max-w-[12rem] truncate px-6 py-3.5 text-slate-500" title={task.project_name ?? ''}>
                      {task.project_name || `Code ${task.project_code}`}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">{formatDate(task.task_date)}</td>
                    <td className="px-6 py-3.5 text-slate-500">{formatTimeRange(task.start_time, task.end_time)}</td>
                    <td className="max-w-xs truncate px-6 py-3.5 text-slate-500" title={task.description ?? ''}>
                      {task.description || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{task.location || '—'}</td>
                    <td className="px-6 py-3.5"><PriorityBadge priority={task.priority} /></td>
                    <td className="px-6 py-3.5"><TaskStatusBadge status={task.status} /></td>
                    <td className="px-6 py-3.5"><SourceBadge source={task.source} /></td>
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => setEditingTask(task)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        title="Edit task"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && <TaskModal onClose={() => setShowAddModal(false)} onSaved={load} />}
      {editingTask && <TaskModal task={editingTask} onClose={() => setEditingTask(null)} onSaved={load} />}
      {showImportModal && <BulkImportModal onClose={() => setShowImportModal(false)} onImported={load} />}
    </div>
  );
}
