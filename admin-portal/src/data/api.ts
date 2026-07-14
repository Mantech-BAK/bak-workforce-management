import type {
  AttendanceRecord,
  AttendanceView,
  AuditLogEntry,
  DashboardStats,
  Employee,
  ExportFormat,
} from '../types';
import { mockAttendanceRecords, mockAuditLogs, mockEmployees } from './mockData';

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

export function computeStats(employees: Employee[]): DashboardStats {
  return {
    activeEmployees: employees.filter((e) => e.status === 'active').length,
    insideGeofence: employees.filter((e) => e.gps === 'inside').length,
    outsideGeofence: employees.filter((e) => e.gps === 'outside').length,
    gpsDisabled: employees.filter((e) => e.gps === 'disabled').length,
    missingPunchOut: employees.filter((e) => e.attendance === 'missing_punch_out').length,
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
