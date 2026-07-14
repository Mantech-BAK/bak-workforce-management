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
  id: number;
  actor: string;
  action: string;
  entity: string;
  entity_id: number;
  employee_name: string;
  created_at: string;
}

export interface DashboardStats {
  activeEmployees: number;
  insideGeofence: number;
  outsideGeofence: number;
  gpsDisabled: number;
  missingPunchOut: number;
}

export type AttendanceView = 'daily' | 'monthly' | 'employee-wise' | 'site-wise';
export type ExportFormat = 'excel' | 'csv' | 'pdf';

// Mirrors the exact field names returned by GET /api/attendance/{daily,monthly,employee/:id,site/:siteId}.
// 'OT ELIGIBLE' is the literal string 'YES' | 'NO'. 'APPROVAL REQUIRED' is the matched
// approver's name, or '' when no approval tier applies. There is no 'site' field yet —
// the backend has no site/geofence name lookup, only a numeric geofence id used as a filter.
export interface AttendanceRecord {
  '#': number;
  'EMP ID': string;
  CPR: string;
  'EMPLOYEE NAME': string;
  DESIGNATION: string;
  'COST CENTER': string;
  'ATTENDANCE DATE': string;
  'START DATE': string;
  'START TIME': string;
  'END TIME': string;
  'END DATE': string;
  'T. WORKING H.': string;
  JOB: string;
  'PROJECT NAME': string;
  REMARKS: string;
  'OT ELIGIBLE': string;
  OT: string;
  'APPROVAL REQUIRED': string;
}
