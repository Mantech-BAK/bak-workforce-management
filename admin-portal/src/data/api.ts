import type {
  AttendanceRecord,
  AttendanceView,
  AuditLogEntry,
  DashboardStats,
  Employee,
  Exception,
  ExportFormat,
  Project,
  Task,
  TaskReport,
} from '../types';
import { mockAttendanceRecords, mockAuditLogs, mockEmployees, mockExceptions, mockProjects, mockTasks } from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const REQUEST_TIMEOUT_MS = 3500;
const ADMIN_TOKEN = 'ghbdgklgnodriert9gjndkdklvbnxk';

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  if (!API_BASE_URL) return fallback;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getEmployees(): Promise<Employee[]> {
  return fetchJson<Employee[]>('/api/employees', mockEmployees);
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  return fetchJson<AuditLogEntry[]>('/api/audit-logs/enrollments', mockAuditLogs);
}

export async function getProjects(): Promise<Project[]> {
  return fetchJson<Project[]>('/api/projects', mockProjects);
}

export interface ExceptionFilters {
  type?: string;
  status?: string;
  empId?: string;
  date?: string;
}

export async function getExceptions(filters: ExceptionFilters = {}): Promise<Exception[]> {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.empId) params.set('emp_id', filters.empId);
  if (filters.date) params.set('date', filters.date);
  const qs = params.toString();
  return fetchJson<Exception[]>(`/api/exceptions${qs ? `?${qs}` : ''}`, mockExceptions);
}

export async function resolveException(
  id: number,
  resolvedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!API_BASE_URL) return { ok: true };
  try {
    const res = await fetch(`${API_BASE_URL}/api/exceptions/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ resolved_by: resolvedBy }),
    });
    if (!res.ok) return { ok: false, error: `Resolve failed: ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error while resolving exception' };
  }
}

export interface TaskFilters {
  date?: string;
  status?: string;
}

export async function getTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.date) params.set('date', filters.date);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return fetchJson<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`, mockTasks);
}

export interface CreateTaskPayload {
  emp_id: string;
  project_code: number;
  days?: number;
  start_time?: string;
  end_time?: string;
  location?: string;
  description: string;
  priority?: string;
  remarks?: string;
}

export async function createTask(
  payload: CreateTaskPayload,
): Promise<{ ok: true; tasks: Task[] } | { ok: false; error: string }> {
  if (!API_BASE_URL) {
    return { ok: false, error: 'No API configured — cannot create tasks in mock mode.' };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || `Request failed: ${res.status}` };
    }
    return { ok: true, tasks: Array.isArray(data) ? data : [data] };
  } catch {
    return { ok: false, error: 'Network error while creating task' };
  }
}

export interface UpdateTaskPayload {
  task_date?: string;
  project_code?: number;
  start_time?: string;
  end_time?: string;
  location?: string;
  description?: string;
  priority?: string;
  remarks?: string;
}

export async function updateTask(
  id: number,
  payload: UpdateTaskPayload,
): Promise<{ ok: true; task: Task } | { ok: false; error: string }> {
  if (!API_BASE_URL) {
    return { ok: false, error: 'No API configured — cannot edit tasks in mock mode.' };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || `Request failed: ${res.status}` };
    }
    return { ok: true, task: data as Task };
  } catch {
    return { ok: false, error: 'Network error while updating task' };
  }
}

export async function getTaskReport(empId: string, from: string, to: string): Promise<TaskReport | null> {
  if (!API_BASE_URL) return null;
  try {
    const params = new URLSearchParams({ emp_id: empId, from, to });
    const res = await fetch(`${API_BASE_URL}/api/tasks/report?${params.toString()}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as TaskReport;
  } catch {
    return null;
  }
}

export function computeStats(employees: Employee[]): DashboardStats {
  const departmentCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const e of employees) {
    const dept = e.department || 'Unassigned';
    departmentCounts.set(dept, (departmentCounts.get(dept) || 0) + 1);
    const status = e.status || 'unknown';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }

  return {
    totalEmployees: employees.length,
    activeEmployees: employees.filter((e) => e.status === 'active').length,
    otEligible: employees.filter((e) => e.ot_eligible === 'YES').length,
    departmentCounts: Array.from(departmentCounts.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count),
    statusCounts: Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// Each AttendanceView maps to one specific backend route — there is no combined
// "all views" endpoint. employee-wise/site-wise require an id before anything can
// be fetched, since the backend routes are scoped by a specific employee or geofence.
export interface AttendanceQuery {
  view: AttendanceView;
  date?: string;
  employeeId?: string;
  siteId?: string;
}

function attendancePath(query: AttendanceQuery): string | null {
  switch (query.view) {
    case 'daily':
      return query.date ? `/api/attendance/daily?date=${encodeURIComponent(query.date)}` : '/api/attendance/daily';
    case 'monthly':
      return '/api/attendance/monthly';
    case 'employee-wise': {
      const id = query.employeeId?.trim();
      return id ? `/api/attendance/employee/${encodeURIComponent(id)}` : null;
    }
    case 'site-wise': {
      const id = query.siteId?.trim();
      return id ? `/api/attendance/site/${encodeURIComponent(id)}` : null;
    }
    default:
      return null;
  }
}

export async function getAttendanceRecords(query: AttendanceQuery): Promise<AttendanceRecord[]> {
  const path = attendancePath(query);
  if (!path) return [];
  return fetchJson<AttendanceRecord[]>(path, mockAttendanceRecords);
}

const EXPORT_FORMAT_PARAM: Record<ExportFormat, string> = { excel: 'xlsx', csv: 'csv', pdf: 'pdf' };

export async function exportAttendance(
  query: AttendanceQuery,
  format: ExportFormat,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const basePath = attendancePath(query);
  if (!basePath) return { ok: false, error: 'Select an employee or site before exporting.' };
  if (!API_BASE_URL) return { ok: true };

  const separator = basePath.includes('?') ? '&' : '?';
  const url = `${API_BASE_URL}${basePath}${separator}format=${EXPORT_FORMAT_PARAM[format]}`;

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } });
    if (!res.ok) return { ok: false, error: `Export failed: ${res.status}` };

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `attendance-${query.view}.${EXPORT_FORMAT_PARAM[format]}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);

    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error during export' };
  }
}
