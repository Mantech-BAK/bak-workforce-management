import type { AuditLogEntry, DashboardStats, Employee } from '../types';
import { mockAuditLogs, mockEmployees } from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const REQUEST_TIMEOUT_MS = 3500;
const ADMIN_TOKEN = 'wf-admin-2026';

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
  return fetchJson<AuditLogEntry[]>('/api/audit_logs', mockAuditLogs);
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
