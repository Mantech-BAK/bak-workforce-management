export type EmployeeStatus = 'active' | 'inactive' | 'suspended';
export type GpsState = 'inside' | 'outside' | 'disabled';
export type AttendanceState = 'clocked_in' | 'clocked_out' | 'missing_punch_out';

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  status: EmployeeStatus;
  gps: GpsState;
  attendance: AttendanceState;
  avatarUrl: string;
  lastSeen: string;
  site: string;
}

export interface AuditLogEntry {
  id: string;
  event_type: string;
  actor_id: string;
  actor_name: string;
  target_id: string;
  target_name: string;
  metadata: Record<string, string>;
  created_at: string;
}

export interface DashboardStats {
  activeEmployees: number;
  insideGeofence: number;
  outsideGeofence: number;
  gpsDisabled: number;
  missingPunchOut: number;
}
